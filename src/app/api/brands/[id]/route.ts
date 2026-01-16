import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// PUT /api/brands/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Check for duplicate name (excluding current)
    const existing = await prisma.brand.findFirst({
      where: {
        name: { equals: body.name, mode: 'insensitive' },
        id: { not: params.id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Brand "${body.name}" already exists` },
        { status: 400 }
      );
    }

    const brand = await prisma.brand.update({
      where: { id: params.id },
      data: {
        name: body.name,
        description: body.description,
      },
    });

    return NextResponse.json(brand);
  } catch (error) {
    console.error('Error updating brand:', error);
    return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 });
  }
}

// DELETE /api/brands/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if brand has products
    const productCount = await prisma.product.count({
      where: { brandId: params.id },
    });

    if (productCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete brand. It has ${productCount} products assigned.` },
        { status: 400 }
      );
    }

    await prisma.brand.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting brand:', error);
    return NextResponse.json({ error: 'Failed to delete brand' }, { status: 500 });
  }
}

