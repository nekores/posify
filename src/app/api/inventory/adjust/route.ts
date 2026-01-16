import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { productId, quantity, type, notes } = data;

    // Get product
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // ✅ SERVER-SIDE STOCK VALIDATION for Subtract operations
    if (type === 'subtract' || type === 'remove') {
      const inventorySum = await prisma.inventory.aggregate({
        where: { productId },
        _sum: { quantity: true },
      });
      const currentStock = inventorySum._sum.quantity || 0;
      
      if (currentStock < quantity) {
        return NextResponse.json(
          { 
            error: `Cannot subtract ${quantity} from "${product.name}". Current stock: ${currentStock}` 
          },
          { status: 400 }
        );
      }
    }

    // Get the LATEST purchase price for this product (not WAC, actual last purchase)
    const latestPurchaseItem = await prisma.purchaseItem.findFirst({
      where: { 
        productId,
        isReturn: false, // Only regular purchases, not returns
      },
      orderBy: { createdAt: 'desc' },
      select: { unitPrice: true },
    });

    // Use latest purchase price if available, otherwise fall back to product's current costPrice
    const costPriceToUse = latestPurchaseItem 
      ? Number(latestPurchaseItem.unitPrice) 
      : Number(product.costPrice);

    // Create inventory adjustment
    const adjustedQuantity = type === 'add' ? quantity : -quantity;

    const inventory = await prisma.inventory.create({
      data: {
        productId,
        quantity: adjustedQuantity,
        costPrice: costPriceToUse,
        type: 'adjustment',
        notes: notes || `Stock ${type === 'add' ? 'added' : 'subtracted'}`,
      },
    });

    return NextResponse.json({ 
      inventory,
      priceUsed: costPriceToUse,
      priceSource: latestPurchaseItem ? 'Latest Purchase' : 'Product Default'
    });
  } catch (error) {
    console.error('Error adjusting inventory:', error);
    return NextResponse.json({ error: 'Failed to adjust inventory' }, { status: 500 });
  }
}

