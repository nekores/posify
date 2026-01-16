import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: supplierId } = params;

    // Fetch ledger entries for this supplier
    const ledgerEntries = await prisma.supplierLedger.findMany({
      where: { supplierId },
      orderBy: { date: 'desc' },
      include: {
        purchase: {
          select: {
            id: true,
            invoiceNo: true,
            isReturn: true,
          },
        },
      },
    });

    return NextResponse.json({ data: ledgerEntries });
  } catch (error) {
    console.error('Error fetching supplier ledger:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor ledger' },
      { status: 500 }
    );
  }
}

