import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/customers
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const hasBalance = searchParams.get('hasBalance');

    const where: any = {
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { mobile: { contains: search, mode: 'insensitive' as const } },
          { businessName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    if (hasBalance === 'true') {
      where.balance = { gt: 0 };
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          customerType: true,
          _count: {
            select: {
              sales: true,
              ledger: true,
              payments: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json({
      data: customers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

// POST /api/customers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Create customer with opening balance in transaction
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          name: body.name,
          businessName: body.businessName || null,
          email: body.email || null,
          phone: body.phone || null,
          mobile: body.mobile || null,
          cnic: body.cnic || null,
          address: body.address || null,
          city: body.city || null,
          region: body.region || null,
          customerTypeId: body.customerTypeId || null,
          creditLimit: body.creditLimit || 0,
          openingBalance: body.openingBalance || 0,
          balance: body.openingBalance || 0, // Initial balance = opening balance
        },
        include: {
          customerType: true,
        },
      });

      // If opening balance, create ledger entry
      if (body.openingBalance && body.openingBalance > 0) {
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            debit: body.openingBalance,
            credit: 0,
            balance: body.openingBalance,
            description: 'Opening Balance',
            date: new Date(),
          },
        });
      }

      return customer;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}
