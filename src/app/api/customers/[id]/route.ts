import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/customers/[id] - Get single customer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            sales: true,
            ledger: true,
            payments: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    );
  }
}

// PUT /api/customers/[id] - Update customer
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();

    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: {
        name: data.name,
        businessName: data.businessName || null,
        email: data.email || null,
        phone: data.phone || null,
        mobile: data.mobile || null,
        cnic: data.cnic || null,
        address: data.address || null,
        city: data.city || null,
        region: data.region || null,
        creditLimit: data.creditLimit || 0,
        openingBalance: data.openingBalance || 0,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}

// DELETE /api/customers/[id] - Delete customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // First, get the customer to check balance
    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        balance: true,
        _count: {
          select: {
            sales: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check if customer has outstanding balance (positive = owes us, negative = we owe them)
    const balance = Number(customer.balance);
    if (balance !== 0) {
      const message = balance > 0 
        ? `Cannot delete customer "${customer.name}". They have an outstanding balance of Rs ${balance.toLocaleString()} to pay.`
        : `Cannot delete customer "${customer.name}". They have a credit balance of Rs ${Math.abs(balance).toLocaleString()} to receive.`;
      
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    // Check if customer has sales
    if (customer._count.sales > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete customer "${customer.name}". They have ${customer._count.sales} sale(s) in the system. You can deactivate them instead.`,
          salesCount: customer._count.sales 
        },
        { status: 400 }
      );
    }

    // Safe to delete - no balance and no sales
    // Delete ledger entries first (if any from opening balance etc.)
    await prisma.customerLedger.deleteMany({
      where: { customerId: params.id },
    });

    // Delete any payments associated with this customer
    await prisma.payment.deleteMany({
      where: { customerId: params.id },
    });

    // Delete customer
    await prisma.customer.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ 
      success: true,
      message: `Customer "${customer.name}" has been deleted successfully.`
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    );
  }
}

