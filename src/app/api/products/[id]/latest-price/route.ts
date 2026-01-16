import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;

    // Get the latest purchase item for this product (not returns)
    const latestPurchaseItem = await prisma.purchaseItem.findFirst({
      where: {
        productId,
        isReturn: false,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        unitPrice: true,
        createdAt: true,
        purchase: {
          select: {
            invoiceNo: true,
            date: true,
            supplier: {
              select: { name: true }
            }
          }
        }
      },
    });

    // Get product default prices
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        costPrice: true,
        salePrice: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({
      latestPurchasePrice: latestPurchaseItem ? Number(latestPurchaseItem.unitPrice) : null,
      latestPurchaseDate: latestPurchaseItem?.purchase.date || null,
      latestPurchaseInvoice: latestPurchaseItem?.purchase.invoiceNo || null,
      latestPurchaseVendor: latestPurchaseItem?.purchase.supplier?.name || null,
      currentCostPrice: Number(product.costPrice),
      currentSalePrice: Number(product.salePrice),
      priceSource: latestPurchaseItem ? 'Latest Purchase' : 'Product Default',
    });
  } catch (error) {
    console.error('Error fetching latest price:', error);
    return NextResponse.json({ error: 'Failed to fetch latest price' }, { status: 500 });
  }
}

