import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/purchases/[id] - Get single purchase
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id: params.id },
      include: {
        supplier: true,
        user: { select: { username: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true, costPrice: true } },
          },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    return NextResponse.json(purchase);
  } catch (error) {
    console.error('Error fetching purchase:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase' },
      { status: 500 }
    );
  }
}

// DELETE /api/purchases/[id] - Delete purchase/return and revert stock + finances
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission
    if (session.user.role !== 'ADMINISTRATOR' && session.user.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'You do not have permission to delete purchases' },
        { status: 403 }
      );
    }

    // Get purchase with items
    const purchase = await prisma.purchase.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        supplier: true,
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    const isReturn = purchase.isReturn;
    const paid = Number(purchase.paid);
    const total = Number(purchase.total);
    const due = Number(purchase.due);

    // ✅ SERVER-SIDE STOCK VALIDATION for deleting regular Purchases
    // When deleting a purchase (not return), stock will be REMOVED
    if (!isReturn) {
      for (const item of purchase.items) {
        const inventorySum = await prisma.inventory.aggregate({
          where: { productId: item.productId },
          _sum: { quantity: true },
        });
        const currentStock = inventorySum._sum.quantity || 0;
        
        if (currentStock < item.quantity) {
          return NextResponse.json(
            { 
              error: `Cannot delete purchase. Would cause negative stock for "${item.product?.name}". Current stock: ${currentStock}, Purchase quantity: ${item.quantity}. Sell less of this product first.` 
            },
            { status: 400 }
          );
        }
      }
    }

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      // ========================================
      // 1. REVERT INVENTORY
      // ========================================
      for (const item of purchase.items) {
        if (isReturn) {
          // RETURN DELETION: The return had DECREASED stock, so we need to ADD it back
          await tx.inventory.create({
            data: {
              productId: item.productId,
              quantity: item.quantity, // Positive to add back
              costPrice: item.unitPrice,
              type: 'adjustment',
              notes: `Reverted from deleted purchase return: ${purchase.invoiceNo}`,
            },
          });
        } else {
          // PURCHASE DELETION: The purchase had INCREASED stock, so we need to REMOVE it
          await tx.inventory.create({
            data: {
              productId: item.productId,
              quantity: -item.quantity, // Negative to remove
              costPrice: item.unitPrice,
              type: 'adjustment',
              notes: `Reverted from deleted purchase: ${purchase.invoiceNo}`,
            },
          });
        }
      }

      // ========================================
      // 2. REVERT SUPPLIER BALANCE
      // ========================================
      if (purchase.supplierId) {
        if (isReturn) {
          // RETURN DELETION: The return had DECREASED supplier balance, so we need to ADD it back
          await tx.supplier.update({
            where: { id: purchase.supplierId },
            data: {
              balance: { increment: total }, // Add back the return amount
            },
          });
        } else if (due > 0) {
          // PURCHASE DELETION: The purchase had INCREASED supplier balance (due amount), so we need to REDUCE it
          await tx.supplier.update({
            where: { id: purchase.supplierId },
            data: {
              balance: { decrement: due },
            },
          });
        }
      }

      // ========================================
      // 3. REVERT CASH IN HAND (if cash payment/refund was made)
      // ========================================
      // Find the supplier payment to check payment type
      const supplierPayment = await tx.supplierPayment.findFirst({
        where: { purchaseId: purchase.id },
      });

      if (supplierPayment && supplierPayment.paymentType === 'cash') {
        const cashAccount = await tx.account.findFirst({
          where: {
            OR: [
              { name: { contains: 'Cash in Hand', mode: 'insensitive' } },
              { name: { contains: 'Cash In Hand', mode: 'insensitive' } },
              { code: '1001' },
            ],
          },
        });

        if (cashAccount) {
          const paymentAmount = Math.abs(Number(supplierPayment.amount));

          if (isReturn) {
            // RETURN DELETION: Cash refund was received (increased cash), so DECREASE it
            await tx.account.update({
              where: { id: cashAccount.id },
              data: {
                balance: { decrement: paymentAmount },
              },
            });
          } else {
            // PURCHASE DELETION: Cash was paid out (decreased cash), so INCREASE it
            await tx.account.update({
              where: { id: cashAccount.id },
              data: {
                balance: { increment: paymentAmount },
              },
            });
          }
        }
      }

      // ========================================
      // 4. DELETE RELATED RECORDS
      // ========================================
      
      // Delete transactions
      await tx.transaction.deleteMany({
        where: { purchaseId: purchase.id },
      });

      // Delete supplier ledger entries
      await tx.supplierLedger.deleteMany({
        where: { purchaseId: purchase.id },
      });

      // Delete supplier payments
      await tx.supplierPayment.deleteMany({
        where: { purchaseId: purchase.id },
      });

      // Delete inventory entries related to this purchase
      await tx.inventory.deleteMany({
        where: {
          notes: {
            contains: purchase.invoiceNo,
          },
        },
      });

      // Delete purchase items
      await tx.purchaseItem.deleteMany({
        where: { purchaseId: purchase.id },
      });

      // Delete the purchase
      await tx.purchase.delete({
        where: { id: purchase.id },
      });
    });

    const actionType = isReturn ? 'Purchase Return' : 'Purchase';
    return NextResponse.json({
      success: true,
      message: `${actionType} ${purchase.invoiceNo} deleted successfully.`,
      details: {
        invoiceNo: purchase.invoiceNo,
        type: isReturn ? 'return' : 'purchase',
        total: total,
        stockReverted: true,
        supplierBalanceReverted: purchase.supplierId ? true : false,
        cashInHandReverted: true,
      },
    });
  } catch (error) {
    console.error('Error deleting purchase:', error);
    return NextResponse.json(
      { error: 'Failed to delete purchase. Please try again.' },
      { status: 500 }
    );
  }
}
