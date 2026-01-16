import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/customer-types - List all customer types
export async function GET(request: NextRequest) {
  try {
    const types = await prisma.customerType.findMany({
      include: {
        _count: {
          select: { customers: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      data: types,
      total: types.length,
    });
  } catch (error) {
    console.error('Error fetching customer types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer types' },
      { status: 500 }
    );
  }
}

// POST /api/customer-types - Create new customer type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, discount = 0, isActive = true } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Type name is required' },
        { status: 400 }
      );
    }

    // Check if name already exists
    const existing = await prisma.customerType.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A customer type with this name already exists' },
        { status: 400 }
      );
    }

    const type = await prisma.customerType.create({
      data: {
        name: name.trim(),
        discount: Math.max(0, Math.min(100, Number(discount))),
        isActive,
      },
      include: {
        _count: {
          select: { customers: true },
        },
      },
    });

    return NextResponse.json(type, { status: 201 });
  } catch (error) {
    console.error('Error creating customer type:', error);
    return NextResponse.json(
      { error: 'Failed to create customer type' },
      { status: 500 }
    );
  }
}

