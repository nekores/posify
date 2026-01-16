/**
 * Inventory Management Library
 * Implements Weighted Average Cost (WAC) method
 */

import prisma from './prisma';
import { Decimal } from '@prisma/client/runtime/library';

interface StockInfo {
  totalQuantity: number;
  totalCost: number;
  averageCost: number;
}

/**
 * Calculate current stock quantity for a product
 */
export async function getProductStock(productId: string, storeId?: string): Promise<number> {
  const where = { productId, ...(storeId && { storeId }) };

  const [inventory, purchases, sales] = await Promise.all([
    // Opening stock
    prisma.inventory.aggregate({
      where,
      _sum: { quantity: true },
    }),
    // Purchases (add to stock)
    prisma.purchaseItem.aggregate({
      where: { productId, isReturn: false },
      _sum: { quantity: true },
    }),
    // Sales (reduce from stock)
    prisma.saleItem.aggregate({
      where: { productId, isReturn: false },
      _sum: { quantity: true },
    }),
  ]);

  const openingStock = inventory._sum.quantity || 0;
  const purchasedQty = purchases._sum.quantity || 0;
  const soldQty = sales._sum.quantity || 0;

  // Also consider returns
  const [purchaseReturns, saleReturns] = await Promise.all([
    prisma.purchaseItem.aggregate({
      where: { productId, isReturn: true },
      _sum: { quantity: true },
    }),
    prisma.saleItem.aggregate({
      where: { productId, isReturn: true },
      _sum: { quantity: true },
    }),
  ]);

  const purchaseReturnQty = Math.abs(purchaseReturns._sum.quantity || 0);
  const saleReturnQty = Math.abs(saleReturns._sum.quantity || 0);

  return openingStock + purchasedQty - purchaseReturnQty - soldQty + saleReturnQty;
}

/**
 * Calculate Weighted Average Cost for a product
 * WAC = (Existing Stock Value + New Purchase Value) / Total Quantity
 */
export async function calculateWeightedAverageCost(productId: string): Promise<StockInfo> {
  // Get opening inventory with costs
  const inventories = await prisma.inventory.findMany({
    where: { productId },
  });

  // Get all purchases with costs
  const purchaseItems = await prisma.purchaseItem.findMany({
    where: { productId, isReturn: false },
  });

  // Get all sales to deduct from stock
  const saleItems = await prisma.saleItem.findMany({
    where: { productId, isReturn: false },
  });

  // Calculate total inventory value
  let totalQuantity = 0;
  let totalCost = 0;

  // Add opening stock
  for (const inv of inventories) {
    totalQuantity += inv.quantity;
    totalCost += inv.quantity * Number(inv.costPrice);
  }

  // Add purchases
  for (const item of purchaseItems) {
    totalQuantity += item.quantity;
    totalCost += item.quantity * Number(item.unitPrice);
  }

  // Deduct sales (at average cost at time of sale, but we use current average for simplicity)
  const soldQty = saleItems.reduce((sum, item) => sum + item.quantity, 0);
  
  // Calculate average before deducting sales
  const avgCostBeforeSales = totalQuantity > 0 ? totalCost / totalQuantity : 0;
  
  // Remaining stock
  totalQuantity -= soldQty;
  totalCost -= soldQty * avgCostBeforeSales;

  // Prevent negative stock/cost
  totalQuantity = Math.max(0, totalQuantity);
  totalCost = Math.max(0, totalCost);

  const averageCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;

  return {
    totalQuantity,
    totalCost,
    averageCost: Math.round(averageCost * 100) / 100, // Round to 2 decimals
  };
}

/**
 * Update product cost price using Weighted Average Cost method
 * Called after a new purchase is added
 */
export async function updateProductCostAfterPurchase(
  productId: string,
  newQuantity: number,
  newUnitCost: number,
  newSalePrice?: number
): Promise<void> {
  // Get current stock info
  const currentStock = await getProductStock(productId);
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) return;

  const currentCost = Number(product.costPrice);

  // Calculate new weighted average cost
  const existingValue = currentStock * currentCost;
  const newValue = newQuantity * newUnitCost;
  const totalQty = currentStock + newQuantity;
  
  const newAverageCost = totalQty > 0 
    ? (existingValue + newValue) / totalQty 
    : newUnitCost;

  // Update product
  const updateData: any = {
    costPrice: Math.round(newAverageCost * 100) / 100,
    updatedAt: new Date(),
  };

  // Optionally update sale price
  if (newSalePrice && newSalePrice > 0) {
    updateData.salePrice = newSalePrice;
  }

  await prisma.product.update({
    where: { id: productId },
    data: updateData,
  });
}

/**
 * Calculate profit margin for a sale
 */
export function calculateProfit(salePrice: number, costPrice: number, quantity: number): {
  profit: number;
  profitMargin: number;
} {
  const totalRevenue = salePrice * quantity;
  const totalCost = costPrice * quantity;
  const profit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  return {
    profit: Math.round(profit * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
  };
}

/**
 * Get stock valuation report
 */
export async function getStockValuation(): Promise<{
  totalProducts: number;
  totalQuantity: number;
  totalValue: number;
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    avgCost: number;
    value: number;
  }>;
}> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, sku: true },
  });

  const items = await Promise.all(
    products.map(async (product) => {
      const stockInfo = await calculateWeightedAverageCost(product.id);
      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku || '',
        quantity: stockInfo.totalQuantity,
        avgCost: stockInfo.averageCost,
        value: Math.round(stockInfo.totalQuantity * stockInfo.averageCost * 100) / 100,
      };
    })
  );

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => sum + item.value, 0);

  return {
    totalProducts: items.filter(i => i.quantity > 0).length,
    totalQuantity,
    totalValue: Math.round(totalValue * 100) / 100,
    items: items.filter(i => i.quantity > 0),
  };
}

