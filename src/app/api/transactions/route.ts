import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        debitAccount: {
          select: { name: true, code: true },
        },
        creditAccount: {
          select: { name: true, code: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { debitAccountId, creditAccountId, amount, description } = data;

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        debitAccountId,
        creditAccountId,
        amount,
        description: description || null,
      },
      include: {
        debitAccount: true,
        creditAccount: true,
      },
    });

    // Update account balances
    // Debit increases asset/expense, decreases liability/equity/income
    // Credit decreases asset/expense, increases liability/equity/income
    await prisma.account.update({
      where: { id: debitAccountId },
      data: {
        balance: {
          increment: amount,
        },
      },
    });

    await prisma.account.update({
      where: { id: creditAccountId },
      data: {
        balance: {
          decrement: amount,
        },
      },
    });

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}

