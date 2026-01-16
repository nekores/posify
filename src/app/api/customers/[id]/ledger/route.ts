import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/customers/[id]/ledger - Get customer ledger
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const where: any = {
      customerId: params.id,
    };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate);
      if (toDate) where.date.lte = new Date(toDate + 'T23:59:59');
    }

    const ledger = await prisma.customerLedger.findMany({
      where,
      include: {
        sale: {
          select: {
            invoiceNo: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({
      data: ledger,
      total: ledger.length,
    });
  } catch (error) {
    console.error('Error fetching customer ledger:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ledger' },
      { status: 500 }
    );
  }
}

