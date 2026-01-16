import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/suppliers/[id]/purchases - Get purchases for a supplier
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const unpaidOnly = searchParams.get('unpaidOnly') === 'true';

    const where: any = {
      supplierId: params.id,
      isReturn: false,
    };

    if (unpaidOnly) {
      where.due = { gt: 0 };
    }

    const purchases = await prisma.purchase.findMany({
      where,
      select: {
        id: true,
        invoiceNo: true,
        date: true,
        total: true,
        paid: true,
        due: true,
        isReturn: true,
        status: true,
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({
      data: purchases,
      total: purchases.length,
    });
  } catch (error) {
    console.error('Error fetching vendor purchases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchases' },
      { status: 500 }
    );
  }
}

