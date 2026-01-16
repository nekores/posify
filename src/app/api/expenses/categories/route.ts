import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const categories = await prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    return NextResponse.json({ error: 'Failed to fetch expense categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { name, description } = data;

    const category = await prisma.expenseCategory.create({
      data: {
        name,
        description: description || null,
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Error creating expense category:', error);
    return NextResponse.json({ error: 'Failed to create expense category' }, { status: 500 });
  }
}

