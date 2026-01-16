import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/purchases/next-invoice - Generate next unique invoice number
export async function GET(request: NextRequest) {
  try {
    // Get the last purchase to determine the next invoice number
    const lastPurchase = await prisma.purchase.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { invoiceNo: true },
    });

    let nextNumber = 1;

    if (lastPurchase?.invoiceNo) {
      // Try to extract number from various formats
      // Format 1: "PUR-000001" or "123456"
      const numMatch = lastPurchase.invoiceNo.match(/(\d+)$/);
      if (numMatch) {
        nextNumber = parseInt(numMatch[1], 10) + 1;
      }
    }

    // Also check total count as a fallback
    const totalCount = await prisma.purchase.count();
    if (totalCount >= nextNumber) {
      nextNumber = totalCount + 1;
    }

    // Generate the invoice number
    const invoiceNo = String(nextNumber).padStart(6, '0');

    // Verify it's unique (in case of concurrent requests)
    const exists = await prisma.purchase.findUnique({
      where: { invoiceNo },
    });

    if (exists) {
      // If exists, find the max and add 1
      const maxPurchase = await prisma.purchase.findFirst({
        orderBy: { invoiceNo: 'desc' },
        select: { invoiceNo: true },
      });
      
      if (maxPurchase?.invoiceNo) {
        const maxNum = parseInt(maxPurchase.invoiceNo.replace(/\D/g, ''), 10) || 0;
        const newInvoiceNo = String(maxNum + 1).padStart(6, '0');
        return NextResponse.json({ invoiceNo: newInvoiceNo });
      }
      
      // Ultimate fallback with timestamp
      const timestamp = Date.now().toString().slice(-10);
      return NextResponse.json({ invoiceNo: timestamp });
    }

    return NextResponse.json({ invoiceNo });
  } catch (error) {
    console.error('Error generating invoice number:', error);
    // Fallback to timestamp-based invoice number
    const timestamp = Date.now().toString().slice(-10);
    return NextResponse.json({ invoiceNo: timestamp });
  }
}

