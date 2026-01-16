import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    // Get dashboard statistics with individual try-catch for better error handling
    let todaySales: { _sum: { total: any }, _count: number } = { _sum: { total: null }, _count: 0 };
    let monthSales: { _sum: { total: any }, _count: number } = { _sum: { total: null }, _count: 0 };
    let totalProducts = 0;
    let totalCustomers = 0;
    let todayExpenses: { _sum: { amount: any } } = { _sum: { amount: null } };
    let recentSales: any[] = [];
    let totalCashInHand = 0;
    let dailySales: any[] = [];

    try {
      // Today's sales - simplified query without status filter
      todaySales = await prisma.sale.aggregate({
        where: {
          date: { gte: today, lt: tomorrow },
          isReturn: false,
        },
        _sum: { total: true },
        _count: true,
      });
    } catch (e) {
      console.error('Error fetching today sales:', e);
    }
      
    try {
      // This month's sales
      monthSales = await prisma.sale.aggregate({
        where: {
          date: { gte: startOfMonth, lte: endOfMonth },
          isReturn: false,
        },
        _sum: { total: true },
        _count: true,
      });
    } catch (e) {
      console.error('Error fetching month sales:', e);
    }
      
    try {
      // Total active products
      totalProducts = await prisma.product.count({
        where: { isActive: true },
      });
    } catch (e) {
      console.error('Error counting products:', e);
    }
      
    try {
      // Total active customers
      totalCustomers = await prisma.customer.count({
        where: { isActive: true },
      });
    } catch (e) {
      console.error('Error counting customers:', e);
    }
      
    try {
      // Today's expenses
      todayExpenses = await prisma.expense.aggregate({
        where: {
          date: { gte: today, lt: tomorrow },
        },
        _sum: { amount: true },
      });
    } catch (e) {
      console.error('Error fetching today expenses:', e);
    }
      
    try {
      // Recent sales
      recentSales = await prisma.sale.findMany({
        where: { isReturn: false },
        include: {
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    } catch (e) {
      console.error('Error fetching recent sales:', e);
    }

    try {
      // Get cash in hand from accounts table (single source of truth)
      const cashAccount = await prisma.account.findFirst({
        where: {
          name: { contains: 'Cash In Hand', mode: 'insensitive' },
        },
        select: { balance: true },
      });
      
      totalCashInHand = Number(cashAccount?.balance || 0);
    } catch (e) {
      console.error('Error getting cash in hand:', e);
    }

    try {
      // Daily sales for chart (last 7 days)
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const sales = await prisma.sale.aggregate({
          where: {
            date: { gte: date, lt: nextDate },
            isReturn: false,
          },
          _sum: { total: true },
        });

        dailySales.push({
          date: date.toISOString().split('T')[0],
          total: Number(sales._sum.total || 0),
        });
      }
    } catch (e) {
      console.error('Error fetching daily sales:', e);
    }

    return NextResponse.json({
      todaySales: {
        total: Number(todaySales._sum.total || 0),
        count: todaySales._count || 0,
      },
      monthSales: {
        total: Number(monthSales._sum.total || 0),
        count: monthSales._count || 0,
      },
      totalProducts,
      totalCustomers,
      todayExpenses: Number(todayExpenses._sum.amount || 0),
      cashInHand: totalCashInHand,
      recentSales: recentSales.map((sale) => ({
        id: sale.id,
        invoiceNo: sale.invoiceNo,
        customer: sale.customer?.name || 'Walk-in',
        total: Number(sale.total),
        date: sale.date,
      })),
      dailySales,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: String(error) },
      { status: 500 }
    );
  }
}

