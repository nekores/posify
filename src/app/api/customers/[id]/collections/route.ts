import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// POST /api/customers/[id]/collections - Create a cash collection
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { amount, note } = data;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Get customer
    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Generate transaction number
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.customerLedger.count({
      where: {
        date: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
        },
      },
    });
    const transactionNo = `COL-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

    // Create collection in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create ledger entry (credit = payment received)
      const ledgerEntry = await tx.customerLedger.create({
        data: {
          customerId: params.id,
          debit: 0,
          credit: amount,
          balance: Number(customer.balance) - amount,
          description: note || 'Cash collection',
          date: new Date(),
        },
      });

      // Update customer balance
      await tx.customer.update({
        where: { id: params.id },
        data: {
          balance: { decrement: amount },
        },
      });

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          customerId: params.id,
          amount,
          paymentType: 'cash',
          date: new Date(),
          notes: 'Cash collection',
          reference: transactionNo,
        },
      });

      // Update Cash in Hand account (increase cash received)
      const cashAccount = await tx.account.findFirst({
        where: { 
          name: { contains: 'Cash in Hand', mode: 'insensitive' }
        },
      });

      // Find Cash Receivable for proper double-entry (customer owes us)
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
            balance: { increment: amount },
          },
        });

        // Create transaction record for audit trail (only if AR account exists)
        // Debit = where money goes TO, Credit = where money comes FROM
        if (arAccount) {
          await tx.transaction.create({
            data: {
              debitAccountId: cashAccount.id, // Cash increases (debit)
              creditAccountId: arAccount.id, // AR decreases (credit)
              amount: amount,
              description: `Cash collection from ${customer.name} - ${transactionNo}`,
              date: new Date(),
            },
          });
        }
      }

      return { ledgerEntry, payment, transactionNo };
    });

    // Get updated customer
    const updatedCustomer = await prisma.customer.findUnique({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Collection recorded successfully',
      transactionNo: result.transactionNo,
      amount,
      balanceAfter: updatedCustomer?.balance,
    });
  } catch (error) {
    console.error('Error creating collection:', error);
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    );
  }
}

