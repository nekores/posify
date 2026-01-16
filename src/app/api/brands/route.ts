import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/brands
export async function GET(request: NextRequest) {
  try {
    const brands = await prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });

    return NextResponse.json({ data: brands });
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 });
  }
}

// POST /api/brands
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check for duplicate name
    const existing = await prisma.brand.findFirst({
      where: { name: { equals: body.name, mode: 'insensitive' } },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Brand "${body.name}" already exists` },
        { status: 400 }
      );
    }

    const brand = await prisma.brand.create({
      data: {
        name: body.name,
        description: body.description,
      },
    });

    return NextResponse.json(brand, { status: 201 });
  } catch (error) {
    console.error('Error creating brand:', error);
    return NextResponse.json({ error: 'Failed to create brand' }, { status: 500 });
  }
}

