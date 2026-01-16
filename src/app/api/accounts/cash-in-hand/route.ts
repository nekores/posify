import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Get Cash in Hand account
    const cashAccount = await prisma.account.findFirst({
      where: {
        OR: [
          { name: { contains: 'Cash in Hand', mode: 'insensitive' } },
          { name: { contains: 'Cash-in-Hand', mode: 'insensitive' } },
          { name: { equals: 'Cash', mode: 'insensitive' } },
        ],
      },
    });

    if (!cashAccount) {
      // If no cash account exists, calculate from transactions
      // Cash in = cash sales + cash collections
      // Cash out = cash expenses + cash refunds (returns)
      
      const [cashSales, cashCollections, cashExpenses, cashReturns] = await Promise.all([
        // Cash sales (payments linked to sales with cash payment type)
        prisma.payment.aggregate({
          where: {
            paymentType: 'cash',
            saleId: { not: null },
          },
          _sum: { amount: true },
        }),
        // Cash collections from customers
        prisma.payment.aggregate({
          where: {
            paymentType: 'cash',
            saleId: null,
            customerId: { not: null },
          },
          _sum: { amount: true },
        }),
        // Cash expenses
        prisma.expense.aggregate({
          where: {
            paymentType: 'cash',
          },
          _sum: { amount: true },
        }),
        // Cash refunds (returns - negative sales)
        prisma.sale.aggregate({
          where: {
            isReturn: true,
            paymentType: 'cash',
          },
          _sum: { total: true },
        }),
      ]);

      const totalCashIn = 
        Number(cashSales._sum.amount || 0) + 
        Number(cashCollections._sum.amount || 0);
      
      const totalCashOut = 
        Number(cashExpenses._sum.amount || 0) + 
        Math.abs(Number(cashReturns._sum.total || 0));

      const balance = totalCashIn - totalCashOut;

      return NextResponse.json({
        balance,
        accountName: 'Cash in Hand (Calculated)',
        breakdown: {
          cashSales: Number(cashSales._sum.amount || 0),
          cashCollections: Number(cashCollections._sum.amount || 0),
          cashExpenses: Number(cashExpenses._sum.amount || 0),
          cashReturns: Math.abs(Number(cashReturns._sum.total || 0)),
        },
      });
    }

    return NextResponse.json({
      balance: Number(cashAccount.balance || 0),
      accountName: cashAccount.name,
      accountId: cashAccount.id,
    });
  } catch (error) {
    console.error('Error fetching cash in hand:', error);
    return NextResponse.json({ error: 'Failed to fetch cash in hand' }, { status: 500 });
  }
}

