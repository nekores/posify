import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/products/next-barcode
export async function GET(request: NextRequest) {
  try {
    // Find the highest numeric barcode
    const products = await prisma.product.findMany({
      where: {
        barcode: { not: null },
      },
      select: { barcode: true },
    });

    let maxBarcode = 1000000000; // Start from 1 billion (10 digits)

    for (const product of products) {
      if (product.barcode) {
        const numericBarcode = parseInt(product.barcode, 10);
        if (!isNaN(numericBarcode) && numericBarcode >= maxBarcode) {
          maxBarcode = numericBarcode;
        }
      }
    }

    const nextBarcode = (maxBarcode + 1).toString();

    return NextResponse.json({ nextBarcode });
  } catch (error) {
    console.error('Error generating next barcode:', error);
    return NextResponse.json({ error: 'Failed to generate barcode' }, { status: 500 });
  }
}

