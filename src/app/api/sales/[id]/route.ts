import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/sales/[id] - Get single sale
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        user: { select: { username: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true, costPrice: true } },
          },
        },
        payments: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    return NextResponse.json(sale);
  } catch (error) {
    console.error('Error fetching sale:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sale' },
      { status: 500 }
    );
  }
}

// DELETE /api/sales/[id] - Delete sale and revert stock/finances
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission (only admin can delete)
    if (session.user.role !== 'ADMINISTRATOR') {
      return NextResponse.json(
        { error: 'Only administrators can delete sales' },
        { status: 403 }
      );
    }

    // Get the sale with all related data
    const sale = await prisma.sale.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
        customer: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    // ✅ SERVER-SIDE STOCK VALIDATION for deleting Return sales
    // When deleting a return, stock will be REMOVED (reversed)
    if (sale.isReturn) {
      for (const item of sale.items) {
        const inventorySum = await prisma.inventory.aggregate({
          where: { productId: item.productId },
          _sum: { quantity: true },
        });
        const currentStock = inventorySum._sum.quantity || 0;
        const quantityToRemove = Math.abs(item.quantity);
        
        if (currentStock < quantityToRemove) {
          return NextResponse.json(
            { 
              error: `Cannot delete return. Would cause negative stock for "${item.product?.name}". Current: ${currentStock}, Would remove: ${quantityToRemove}` 
            },
            { status: 400 }
          );
        }
      }
    }

    // Perform deletion in a transaction to ensure data integrity
    await prisma.$transaction(async (tx) => {
      // 1. Revert inventory - Add back sold quantities
      // We create inventory adjustment records to track the reversal
      for (const item of sale.items) {
        if (!item.isReturn) {
          // For regular sales, add back the quantity
          await tx.inventory.create({
            data: {
              productId: item.productId,
              quantity: item.quantity, // Positive = adding back
              costPrice: item.costPrice,
              type: 'adjustment',
              notes: `Reverted from deleted sale: ${sale.invoiceNo}`,
            },
          });
        } else {
          // For returns that were recorded, remove the returned quantity
          await tx.inventory.create({
            data: {
              productId: item.productId,
              quantity: -Math.abs(item.quantity), // Remove what was returned
              costPrice: item.costPrice,
              type: 'adjustment',
              notes: `Reverted return from deleted sale: ${sale.invoiceNo}`,
            },
          });
        }
      }

      // 2. Revert customer balance if there was a credit sale
      if (sale.customerId && Number(sale.due) > 0) {
        // Reduce the customer's balance (they no longer owe this)
        await tx.customer.update({
          where: { id: sale.customerId },
          data: {
            balance: { decrement: Number(sale.due) },
          },
        });
      }

      // 3. If it was a return sale, revert the credit given to customer
      if (sale.customerId && sale.isReturn) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: {
            balance: { increment: Number(sale.total) },
          },
        });
      }

      // 4. Revert collections (payments for old balance) linked to this sale
      // Find payments marked as old_balance_collection
      const collectionPayments = sale.payments.filter(p => p.notes === 'old_balance_collection');
      for (const collection of collectionPayments) {
        // Add back the collected amount to customer balance
        if (sale.customerId) {
          await tx.customer.update({
            where: { id: sale.customerId },
            data: {
              balance: { increment: Number(collection.amount) },
            },
          });
        }
      }

      // 5. Delete customer ledger entries for this sale (includes collection entries)
      await tx.customerLedger.deleteMany({
        where: { saleId: sale.id },
      });

      // 6. Delete payments associated with this sale (includes collection payments)
      await tx.payment.deleteMany({
        where: { saleId: sale.id },
      });

      // 7. Delete accounting transactions associated with this sale
      // First find transactions to delete their groups if needed
      const transactions = await tx.transaction.findMany({
        where: { saleId: sale.id },
        select: { groupId: true }
      });
      
      // Delete the transactions
      await tx.transaction.deleteMany({
        where: { saleId: sale.id },
      });

      // Cleanup empty transaction groups
      const groupIds = transactions.map(t => t.groupId).filter((id): id is string => id !== null);
      if (groupIds.length > 0) {
        // Find groups that have no more transactions
        for (const groupId of new Set(groupIds)) {
          const count = await tx.transaction.count({
            where: { groupId }
          });
          if (count === 0) {
            await tx.transactionGroup.delete({
              where: { id: groupId }
            });
          }
        }
      }

      // 8. Delete sale items
      await tx.saleItem.deleteMany({
        where: { saleId: sale.id },
      });

      // 9. Finally, delete the sale
      await tx.sale.delete({
        where: { id: sale.id },
      });
    });

    // Count collections that were reverted
    const collectionPayments = sale.payments.filter(p => p.notes === 'old_balance_collection');
    const totalCollectionReverted = collectionPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    return NextResponse.json({
      success: true,
      message: `Sale ${sale.invoiceNo} deleted successfully. Stock and finances have been reverted.`,
      deletedSale: {
        invoiceNo: sale.invoiceNo,
        total: sale.total,
        itemsCount: sale.items.length,
        collectionsReverted: collectionPayments.length,
        collectionAmountReverted: totalCollectionReverted,
      },
    });
  } catch (error) {
    console.error('Error deleting sale:', error);
    return NextResponse.json(
      { error: 'Failed to delete sale. Please try again.' },
      { status: 500 }
    );
  }
}

// PATCH /api/sales/[id] - Update sale status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status, notes } = body;

    const sale = await prisma.sale.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        customer: true,
        items: true,
      },
    });

    return NextResponse.json(sale);
  } catch (error) {
    console.error('Error updating sale:', error);
    return NextResponse.json(
      { error: 'Failed to update sale' },
      { status: 500 }
    );
  }
}

