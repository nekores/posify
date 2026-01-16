import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// POST /api/suppliers/payments - Record a supplier payment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { supplierId, amount, paymentType = 'cash', reference, notes, date } = data;

    if (!supplierId) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 });
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 });
    }

    // Get supplier
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    if (amount > Number(supplier.balance)) {
      return NextResponse.json(
        { error: 'Payment amount cannot exceed outstanding balance' },
        { status: 400 }
      );
    }

    // Process payment in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create supplier payment record
      const payment = await tx.supplierPayment.create({
        data: {
          supplierId,
          amount,
          paymentType,
          reference,
          notes,
          date: date ? new Date(date) : new Date(),
        },
      });

      // 2. Update supplier balance
      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          balance: { decrement: amount },
        },
      });

      // 3. Create supplier ledger entry
      await tx.supplierLedger.create({
        data: {
          supplierId,
          paymentId: payment.id,
          debit: 0,
          credit: amount,
          balance: Number(supplier.balance) - amount,
          description: `Payment: ${reference || 'Cash payment'}`,
          date: date ? new Date(date) : new Date(),
        },
      });

      // 4. Update Cash in Hand if cash payment
      if (paymentType === 'cash') {
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
          // Decrease Cash in Hand (money going out)
          await tx.account.update({
            where: { id: cashAccount.id },
            data: {
              balance: { decrement: amount },
            },
          });

          // Record transaction for audit
          await tx.transaction.create({
            data: {
              debitAccountId: cashAccount.id,
              creditAccountId: cashAccount.id, // Simplified
              amount,
              description: `Supplier payment to ${supplier.name}`,
              date: date ? new Date(date) : new Date(),
            },
          });
        }
      }

      return payment;
    });

    // Get updated supplier
    const updatedSupplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    return NextResponse.json({
      success: true,
      message: `Payment of Rs ${amount.toLocaleString()} recorded successfully`,
      payment: result,
      supplier: {
        id: updatedSupplier?.id,
        name: updatedSupplier?.name,
        previousBalance: Number(supplier.balance),
        amountPaid: amount,
        newBalance: Number(updatedSupplier?.balance || 0),
      },
    });
  } catch (error) {
    console.error('Error recording vendor payment:', error);
    return NextResponse.json(
      { error: 'Failed to record payment' },
      { status: 500 }
    );
  }
}

// GET /api/suppliers/payments - Get all supplier payments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (supplierId) {
      where.supplierId = supplierId;
    }

    const [payments, total] = await Promise.all([
      prisma.supplierPayment.findMany({
        where,
        include: {
          supplier: {
            select: { name: true },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.supplierPayment.count({ where }),
    ]);

    return NextResponse.json({
      data: payments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching vendor payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

