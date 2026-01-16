import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// PUT /api/categories/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Check for duplicate name (excluding current)
    const existing = await prisma.category.findFirst({
      where: {
        name: { equals: body.name, mode: 'insensitive' },
        id: { not: params.id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Category "${body.name}" already exists` },
        { status: 400 }
      );
    }

    const category = await prisma.category.update({
      where: { id: params.id },
      data: {
        name: body.name,
        description: body.description,
        parentId: body.parentId || null,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE /api/categories/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if category has products
    const productCount = await prisma.product.count({
      where: { categoryId: params.id },
    });

    if (productCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete category. It has ${productCount} products assigned.` },
        { status: 400 }
      );
    }

    // Check if category has children
    const childCount = await prisma.category.count({
      where: { parentId: params.id },
    });

    if (childCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete category. It has ${childCount} sub-categories.` },
        { status: 400 }
      );
    }

    await prisma.category.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}

