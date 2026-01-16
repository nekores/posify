import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/collections/[id] - Get single collection
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Collections are stored as customerLedger entries with credit > 0
    const collection = await prisma.customerLedger.findUnique({
      where: { id: params.id },
      include: {
        customer: { select: { id: true, name: true, balance: true } },
        sale: { select: { id: true, invoiceNo: true } },
      },
    });

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    return NextResponse.json(collection);
  } catch (error) {
    console.error('Error fetching collection:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collection' },
      { status: 500 }
    );
  }
}

// DELETE /api/collections/[id] - Delete a collection and revert customer balance
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
        { error: 'Only administrators can delete collections' },
        { status: 403 }
      );
    }

    // Get the collection from customerLedger (collections are credit entries)
    const ledgerEntry = await prisma.customerLedger.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        sale: { select: { id: true, invoiceNo: true } },
      },
    });

    if (!ledgerEntry) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    // Make sure this is a collection (credit entry), not a sale (debit entry)
    if (Number(ledgerEntry.credit) <= 0) {
      return NextResponse.json(
        { error: 'This is not a collection entry. It appears to be a sale entry.' },
        { status: 400 }
      );
    }

    const collectionAmount = Number(ledgerEntry.credit);
    const customerName = ledgerEntry.customer?.name || 'Unknown';

    // Perform deletion in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Add back the collected amount to customer balance
      if (ledgerEntry.customerId) {
        await tx.customer.update({
          where: { id: ledgerEntry.customerId },
          data: {
            balance: { increment: collectionAmount },
          },
        });
      }

      // 2. Decrease Cash in Hand account (revert the cash that was received)
      const cashAccount = await tx.account.findFirst({
        where: { 
          name: { contains: 'Cash in Hand', mode: 'insensitive' }
        },
      });

      // Find Cash Receivable account (customer owes us)
      let arAccount = await tx.account.findFirst({
        where: { 
          OR: [
            { name: { contains: 'Cash Receiveable', mode: 'insensitive' } },
            { name: { contains: 'Accounts Receivable', mode: 'insensitive' } },
          ]
        },
      });

      if (cashAccount) {
        await tx.account.update({
          where: { id: cashAccount.id },
          data: {
            balance: { decrement: collectionAmount },
          },
        });

        // 3. Create a transaction record for audit trail (only if AR account exists)
        // Debit = where money goes TO, Credit = where money comes FROM
        if (arAccount) {
          await tx.transaction.create({
            data: {
              debitAccountId: arAccount.id, // AR increases (customer owes us again)
              creditAccountId: cashAccount.id, // Cash decreases
              amount: collectionAmount,
              description: `Reverted collection for ${customerName} - Collection deleted`,
              date: new Date(),
            },
          });
        }
      }

      // 4. If ledger entry has a linked payment, delete it first (due to FK constraint)
      if (ledgerEntry.paymentId) {
        try {
          await tx.payment.delete({
            where: { id: ledgerEntry.paymentId },
          });
        } catch (e) {
          // Payment might not exist or already deleted, ignore
        }
      }

      // 5. Delete the ledger entry
      await tx.customerLedger.delete({
        where: { id: params.id },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Collection of ${collectionAmount.toLocaleString()} from ${customerName} deleted successfully.`,
      deletedCollection: {
        id: params.id,
        amount: collectionAmount,
        customer: customerName,
        linkedSale: ledgerEntry.sale?.invoiceNo || null,
      },
      note: 'Customer balance has been updated and Cash in Hand has been adjusted.',
    });
  } catch (error: any) {
    console.error('Error deleting collection:', error);
    return NextResponse.json(
      { error: `Failed to delete collection: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
