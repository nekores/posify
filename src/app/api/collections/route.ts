import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

// GET /api/collections - Get all cash collections
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const customerId = searchParams.get('customerId');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const skip = (page - 1) * limit;

    const where: any = {
      credit: { gt: 0 }, // Collections are credits
    };

    if (customerId) {
      where.customerId = customerId;
    }

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate);
      if (toDate) where.date.lte = new Date(toDate + 'T23:59:59');
    }

    const [collections, total] = await Promise.all([
      prisma.customerLedger.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              balance: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.customerLedger.count({ where }),
    ]);

    // Format the response
    const formattedCollections = collections.map((c, index) => ({
      id: c.id,
      date: c.date,
      amount: c.credit,
      customerId: c.customerId,
      customer: c.customer,
      description: c.description,
      transactionNo: `COL-${c.id.slice(-8).toUpperCase()}`,
      balanceAfter: c.balance,
    }));

    return NextResponse.json({
      data: formattedCollections,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    );
  }
}

