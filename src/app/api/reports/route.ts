import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const dateFilter = {
      gte: from ? new Date(from) : new Date(new Date().setDate(1)), // Start of month
      lte: to ? new Date(to + 'T23:59:59') : new Date(), // End of day
    };

    // Sales Report
    const sales = await prisma.sale.findMany({
      where: {
        date: dateFilter,
        status: 'completed',
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0);
    const totalCost = sales.reduce(
      (sum, s) => sum + s.items.reduce((iSum, item) => iSum + Number(item.costPrice) * item.quantity, 0),
      0
    );
    const grossProfit = totalRevenue - totalCost;

    // Top products
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        const pid = item.productId;
        if (!productSales[pid]) {
          productSales[pid] = { name: item.product.name, quantity: 0, revenue: 0 };
        }
        productSales[pid].quantity += item.quantity;
        productSales[pid].revenue += Number(item.total);
      });
    });
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Daily sales
    const dailySalesMap: Record<string, { total: number; count: number }> = {};
    sales.forEach((sale) => {
      const date = sale.date.toISOString().split('T')[0];
      if (!dailySalesMap[date]) {
        dailySalesMap[date] = { total: 0, count: 0 };
      }
      dailySalesMap[date].total += Number(sale.total);
      dailySalesMap[date].count += 1;
    });
    const dailySales = Object.entries(dailySalesMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Purchase Report
    const purchases = await prisma.purchase.findMany({
      where: {
        date: dateFilter,
      },
      include: {
        supplier: true,
      },
    });

    const totalPurchaseAmount = purchases.reduce((sum, p) => sum + Number(p.total), 0);

    // Top suppliers
    const supplierPurchases: Record<string, { name: string; amount: number }> = {};
    purchases.forEach((purchase) => {
      if (purchase.supplier) {
        const sid = purchase.supplierId!;
        if (!supplierPurchases[sid]) {
          supplierPurchases[sid] = { name: purchase.supplier.name, amount: 0 };
        }
        supplierPurchases[sid].amount += Number(purchase.total);
      }
    });
    const topSuppliers = Object.values(supplierPurchases)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Inventory Report
    const inventory = await prisma.inventory.findMany({
      include: {
        product: true,
      },
    });

    // Group inventory by product
    const productStock: Record<string, { quantity: number; value: number; minStock: number }> = {};
    inventory.forEach((inv) => {
      const pid = inv.productId;
      if (!productStock[pid]) {
        productStock[pid] = { quantity: 0, value: 0, minStock: inv.product.minStock };
      }
      productStock[pid].quantity += inv.quantity;
      productStock[pid].value += inv.quantity * Number(inv.costPrice);
    });

    const productStockList = Object.values(productStock);
    const totalProducts = productStockList.length;
    const totalStockValue = productStockList.reduce((sum, p) => sum + p.value, 0);
    const lowStockCount = productStockList.filter((p) => p.quantity > 0 && p.quantity <= p.minStock).length;
    const outOfStockCount = productStockList.filter((p) => p.quantity <= 0).length;

    // Expense Report
    const expenses = await prisma.expense.findMany({
      where: {
        date: dateFilter,
      },
      include: {
        category: true,
      },
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // By category
    const expenseByCategory: Record<string, number> = {};
    expenses.forEach((expense) => {
      const category = expense.category?.name || 'Uncategorized';
      if (!expenseByCategory[category]) {
        expenseByCategory[category] = 0;
      }
      expenseByCategory[category] += Number(expense.amount);
    });
    const byCategory = Object.entries(expenseByCategory).map(([category, amount]) => ({
      category,
      amount,
    }));

    return NextResponse.json({
      salesReport: {
        totalSales: sales.length,
        totalRevenue,
        totalCost,
        grossProfit,
        topProducts,
        dailySales,
      },
      purchaseReport: {
        totalPurchases: purchases.length,
        totalAmount: totalPurchaseAmount,
        topSuppliers,
      },
      inventoryReport: {
        totalProducts,
        totalValue: totalStockValue,
        lowStockCount,
        outOfStockCount,
      },
      expenseReport: {
        totalExpenses,
        byCategory,
      },
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

