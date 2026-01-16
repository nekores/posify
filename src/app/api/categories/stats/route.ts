import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/categories/stats
export async function GET(request: NextRequest) {
  try {
    // Get total products
    const totalProducts = await prisma.product.count({
      where: { isActive: true },
    });

    // Get uncategorized products (no category assigned)
    const uncategorizedProducts = await prisma.product.count({
      where: {
        isActive: true,
        categoryId: null,
      },
    });

    return NextResponse.json({
      totalProducts,
      uncategorizedProducts,
    });
  } catch (error) {
    console.error('Error fetching category stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

