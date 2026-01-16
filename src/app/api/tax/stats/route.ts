import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;
    
    // This year start and end
    const thisYearStart = new Date(currentYear, 0, 1);
    const thisYearEnd = new Date(currentYear, 11, 31, 23, 59, 59);
    
    // Last year start and end
    const lastYearStart = new Date(lastYear, 0, 1);
    const lastYearEnd = new Date(lastYear, 11, 31, 23, 59, 59);
    
    // This month start and end
    const thisMonthStart = new Date(currentYear, now.getMonth(), 1);
    const thisMonthEnd = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59);
    
    // Last month start and end
    const lastMonthStart = new Date(currentYear, now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(currentYear, now.getMonth(), 0, 23, 59, 59);

    // Get tax from sales (this year)
    const thisYearSales = await prisma.sale.aggregate({
      where: {
        date: { gte: thisYearStart, lte: thisYearEnd },
        isReturn: false,
      },
      _sum: { tax: true },
    });

    // Get tax from sales (last year)
    const lastYearSales = await prisma.sale.aggregate({
      where: {
        date: { gte: lastYearStart, lte: lastYearEnd },
        isReturn: false,
      },
      _sum: { tax: true },
    });

    // Get tax from purchases (this year) - for reference
    const thisYearPurchases = await prisma.purchase.aggregate({
      where: {
        date: { gte: thisYearStart, lte: thisYearEnd },
        isReturn: false,
      },
      _sum: { tax: true },
    });

    // Get tax from purchases (last year)
    const lastYearPurchases = await prisma.purchase.aggregate({
      where: {
        date: { gte: lastYearStart, lte: lastYearEnd },
        isReturn: false,
      },
      _sum: { tax: true },
    });

    // This year tax = sales tax - purchase tax (net tax collected)
    const thisYearTax = Number(thisYearSales._sum.tax || 0) - Number(thisYearPurchases._sum.tax || 0);
    const lastYearTax = Number(lastYearSales._sum.tax || 0) - Number(lastYearPurchases._sum.tax || 0);

    // This month tax
    const thisMonthSales = await prisma.sale.aggregate({
      where: {
        date: { gte: thisMonthStart, lte: thisMonthEnd },
        isReturn: false,
      },
      _sum: { tax: true },
    });

    const thisMonthPurchases = await prisma.purchase.aggregate({
      where: {
        date: { gte: thisMonthStart, lte: thisMonthEnd },
        isReturn: false,
      },
      _sum: { tax: true },
    });

    const thisMonthTax = Number(thisMonthSales._sum.tax || 0) - Number(thisMonthPurchases._sum.tax || 0);

    // Last month tax
    const lastMonthSales = await prisma.sale.aggregate({
      where: {
        date: { gte: lastMonthStart, lte: lastMonthEnd },
        isReturn: false,
      },
      _sum: { tax: true },
    });

    const lastMonthPurchases = await prisma.purchase.aggregate({
      where: {
        date: { gte: lastMonthStart, lte: lastMonthEnd },
        isReturn: false,
      },
      _sum: { tax: true },
    });

    const lastMonthTax = Number(lastMonthSales._sum.tax || 0) - Number(lastMonthPurchases._sum.tax || 0);

    // Daily tax (last 7 days)
    const dailyTax: Array<{ date: string; tax: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);

      const daySales = await prisma.sale.aggregate({
        where: {
          date: { gte: dateStart, lte: dateEnd },
          isReturn: false,
        },
        _sum: { tax: true },
      });

      const dayPurchases = await prisma.purchase.aggregate({
        where: {
          date: { gte: dateStart, lte: dateEnd },
          isReturn: false,
        },
        _sum: { tax: true },
      });

      const dayTax = Number(daySales._sum.tax || 0) - Number(dayPurchases._sum.tax || 0);
      dailyTax.push({
        date: dateStart.toISOString(),
        tax: dayTax,
      });
    }

    // Monthly tax (this year)
    const monthlyTax: Array<{ month: string; tax: number }> = [];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(currentYear, month, 1);
      const monthEnd = new Date(currentYear, month + 1, 0, 23, 59, 59);

      const monthSales = await prisma.sale.aggregate({
        where: {
          date: { gte: monthStart, lte: monthEnd },
          isReturn: false,
        },
        _sum: { tax: true },
      });

      const monthPurchases = await prisma.purchase.aggregate({
        where: {
          date: { gte: monthStart, lte: monthEnd },
          isReturn: false,
        },
        _sum: { tax: true },
      });

      const monthTax = Number(monthSales._sum.tax || 0) - Number(monthPurchases._sum.tax || 0);
      monthlyTax.push({
        month: monthNames[month],
        tax: monthTax,
      });
    }

    return NextResponse.json({
      thisYear: thisYearTax,
      lastYear: lastYearTax,
      thisMonth: thisMonthTax,
      lastMonth: lastMonthTax,
      dailyTax,
      monthlyTax,
    });
  } catch (error) {
    console.error('Error fetching tax stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax statistics', details: String(error) },
      { status: 500 }
    );
  }
}
