import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/customer-types/[id] - Get single customer type
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const type = await prisma.customerType.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { customers: true },
        },
      },
    });

    if (!type) {
      return NextResponse.json(
        { error: 'Customer type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(type);
  } catch (error) {
    console.error('Error fetching customer type:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer type' },
      { status: 500 }
    );
  }
}

// PUT /api/customer-types/[id] - Update customer type
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, discount, isActive } = body;

    // Check if name already exists (excluding current type)
    if (name) {
      const existing = await prisma.customerType.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          id: { not: params.id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'A customer type with this name already exists' },
          { status: 400 }
        );
      }
    }

    const type = await prisma.customerType.update({
      where: { id: params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(discount !== undefined && { discount: Math.max(0, Math.min(100, Number(discount))) }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        _count: {
          select: { customers: true },
        },
      },
    });

    return NextResponse.json(type);
  } catch (error) {
    console.error('Error updating customer type:', error);
    return NextResponse.json(
      { error: 'Failed to update customer type' },
      { status: 500 }
    );
  }
}

// DELETE /api/customer-types/[id] - Delete customer type
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if type has customers
    const type = await prisma.customerType.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { customers: true },
        },
      },
    });

    if (!type) {
      return NextResponse.json(
        { error: 'Customer type not found' },
        { status: 404 }
      );
    }

    if (type._count.customers > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${type._count.customers} customer(s) are using this type. Reassign them first.` },
        { status: 400 }
      );
    }

    await prisma.customerType.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer type:', error);
    return NextResponse.json(
      { error: 'Failed to delete customer type' },
      { status: 500 }
    );
  }
}

