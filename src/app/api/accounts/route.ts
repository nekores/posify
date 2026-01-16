import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        group: {
          select: { name: true, type: true },
        },
      },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });

    const groups = await prisma.accountGroup.findMany({
      include: {
        accounts: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ accounts, groups });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { code, name, groupId, type } = data;

    // Check if code already exists
    const existing = await prisma.account.findUnique({
      where: { code },
    });

    if (existing) {
      return NextResponse.json({ error: 'Account code already exists' }, { status: 400 });
    }

    const account = await prisma.account.create({
      data: {
        code,
        name,
        groupId,
        type,
        balance: 0,
      },
      include: {
        group: true,
      },
    });

    return NextResponse.json({ account });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

