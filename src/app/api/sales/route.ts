import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Generate invoice number
async function generateInvoiceNo() {
  const today = new Date();
  const prefix = `INV${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const lastSale = await prisma.sale.findFirst({
    where: {
      invoiceNo: { startsWith: prefix },
    },
    orderBy: { invoiceNo: 'desc' },
  });

  if (lastSale) {
    const lastNum = parseInt(lastSale.invoiceNo.slice(-5)) || 0;
    return `${prefix}${String(lastNum + 1).padStart(5, '0')}`;
  }

  return `${prefix}00001`;
}

// GET /api/sales
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const customerId = searchParams.get('customerId');

    const where = {
      ...(startDate && endDate && {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
      ...(customerId && { customerId }),
    };

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          customer: true,
          user: { select: { username: true } },
          items: {
            include: {
              product: { select: { name: true, sku: true } },
            },
          },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    return NextResponse.json({
      data: sales,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales' },
      { status: 500 }
    );
  }
}

// POST /api/sales - Create new sale
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      customerId,
      items,
      discount = 0,
      discountPercent = 0,
      tax = 0,
      paid = 0,
      paymentType = 'cash',
      notes,
      isReturn = false,
      isCashSale = true,
      collection = 0, // Amount collected towards old balance
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items in sale' },
        { status: 400 }
      );
    }

    // Validate items have required fields
    for (const item of items) {
      if (!item.productId) {
        return NextResponse.json(
          { error: 'Each item must have a productId' },
          { status: 400 }
        );
      }
      if (!item.unitPrice || item.unitPrice <= 0) {
        return NextResponse.json(
          { error: 'Each item must have a valid unitPrice' },
          { status: 400 }
        );
      }
    }

    // ✅ SERVER-SIDE STOCK VALIDATION (prevents negative stock)
    if (!isReturn) {
      for (const item of items) {
        // Calculate current stock from inventory
        const inventorySum = await prisma.inventory.aggregate({
          where: { productId: item.productId },
          _sum: { quantity: true },
        });
        const currentStock = inventorySum._sum.quantity || 0;
        
        if (currentStock < item.quantity) {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: { name: true },
          });
          return NextResponse.json(
            { 
              error: `Insufficient stock for "${product?.name || 'Product'}". Available: ${currentStock}, Requested: ${item.quantity}` 
            },
            { status: 400 }
          );
        }
      }
    }

    const invoiceNo = await generateInvoiceNo();

    // Calculate tax from product taxRate if not provided in items
    let calculatedTax = 0;
    for (const item of items) {
      if (!item.tax || item.tax === 0) {
        // Get product taxRate and calculate tax
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { taxRate: true },
        });
        if (product && product.taxRate) {
          const itemSubtotal = item.unitPrice * item.quantity - (item.discount || 0);
          item.tax = (itemSubtotal * Number(product.taxRate)) / 100;
        }
      }
      calculatedTax += item.tax || 0;
    }

    // Use calculated tax if tax not provided at sale level
    const finalTax = tax > 0 ? tax : calculatedTax;

    // Calculate totals (negative for returns)
    const multiplier = isReturn ? -1 : 1;
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.unitPrice * item.quantity - (item.discount || 0),
      0
    ) * multiplier;
    const total = (Math.abs(subtotal) - discount + finalTax) * multiplier;
    const actualPaid = isCashSale ? Math.abs(total) : paid;
    const due = Math.abs(total) - actualPaid;

    // Get user ID from session - verify it exists in database
    let userId: string | null = null;
    let storeId: string | null = session.user.storeId || null;
    
    if (session.user.id) {
      // Verify the user exists
      const userExists = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, storeId: true },
      });
      if (userExists) {
        userId = userExists.id;
        storeId = userExists.storeId || storeId;
      }
    }

    // Create sale with items and payment in transaction
    const sale = await prisma.$transaction(async (tx) => {
      // Create sale
      const newSale = await tx.sale.create({
        data: {
          invoiceNo,
          customerId: customerId || null,
          userId,
          storeId,
          subtotal: Math.abs(subtotal),
          discount,
          discountPercent,
          tax: finalTax,
          total: Math.abs(total),
          paid: actualPaid,
          due,
          status: 'completed',
          isReturn,
          notes,
          date: new Date(),
        },
      });

      // Create sale items and update inventory
      for (const item of items) {
        // Create sale item
        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            quantity: isReturn ? -Math.abs(item.quantity) : item.quantity,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice || 0,
            discount: item.discount || 0,
            tax: item.tax || 0,
            total: (item.unitPrice * item.quantity - (item.discount || 0) + (item.tax || 0)) * multiplier,
            isReturn,
          },
        });

        // Update inventory (negative for sale, positive for return)
        await tx.inventory.create({
          data: {
            productId: item.productId,
            quantity: isReturn ? Math.abs(item.quantity) : -item.quantity,
            costPrice: item.costPrice || 0,
            type: isReturn ? 'sale_return' : 'sale',
            notes: isReturn ? `Return: ${invoiceNo}` : `Sale: ${invoiceNo}`,
          },
        });
      }

      // Create payment record for sale payment
      if (actualPaid > 0) {
        await tx.payment.create({
          data: {
            saleId: newSale.id,
            customerId: customerId || null,
            amount: isReturn ? -actualPaid : actualPaid,
            paymentType,
            date: new Date(),
          },
        });
      }

      // Handle collection towards old balance
      if (customerId && collection > 0) {
        await tx.payment.create({
          data: {
            saleId: newSale.id, // Link collection to sale for proper deletion
            customerId,
            amount: collection,
            paymentType: paymentType, // Use same payment type as sale
            reference: `Collection with ${invoiceNo}`,
            notes: 'old_balance_collection', // Mark as collection for old balance
            date: new Date(),
          },
        });

        // Record in customer ledger
        await tx.customerLedger.create({
          data: {
            customerId,
            saleId: newSale.id, // Link to sale for proper deletion
            credit: collection,
            debit: 0,
            balance: 0, // Will be calculated
            description: `Collection with sale ${invoiceNo}`,
            date: new Date(),
          },
        });

        // Reduce customer balance
        await tx.customer.update({
          where: { id: customerId },
          data: {
            balance: { decrement: collection },
          },
        });
      }

      // Update customer ledger and balance
      if (customerId) {
        if (isReturn) {
          // For returns: credit customer, decrease balance
          await tx.customerLedger.create({
            data: {
              customerId,
              saleId: newSale.id,
              debit: 0,
              credit: Math.abs(total),
              balance: -Math.abs(total),
              description: `Return ${invoiceNo}`,
              date: new Date(),
            },
          });

          await tx.customer.update({
            where: { id: customerId },
            data: { balance: { decrement: Math.abs(total) } },
          });
        } else if (!isCashSale && due > 0) {
          // Credit sale with due amount
          await tx.customerLedger.create({
            data: {
              customerId,
              saleId: newSale.id,
              debit: Math.abs(total),
              credit: actualPaid,
              balance: due,
              description: `Sale ${invoiceNo}`,
              date: new Date(),
            },
          });

          await tx.customer.update({
            where: { id: customerId },
            data: { balance: { increment: due } },
          });
        }
      }

      // ✅ ACCOUNTING ENTRIES WITH TAX
      // Create transaction group for this sale
      const transactionGroup = await tx.transactionGroup.create({
        data: {
          reference: invoiceNo,
          description: `Sale ${invoiceNo}`,
          date: new Date(),
        },
      });

      // Get required accounts
      const [cashAccount, salesRevenueAccount, taxPayableAccount, accountsReceivableAccount, cogsAccount, inventoryAccount] = await Promise.all([
        // Cash in Hand
        tx.account.findFirst({
          where: {
            OR: [
              { name: { contains: 'Cash in Hand', mode: 'insensitive' } },
              { code: '1001' },
            ],
          },
        }),
        // Sales Revenue
        tx.account.findFirst({
          where: {
            OR: [
              { name: { contains: 'Sales Revenue', mode: 'insensitive' } },
              { code: '4001' },
            ],
          },
        }),
        // Tax Payable
        tx.account.findFirst({
          where: {
            OR: [
              { name: { contains: 'Tax Payable', mode: 'insensitive' } },
              { code: '2002' },
            ],
          },
        }),
        // Accounts Receivable
        tx.account.findFirst({
          where: {
            OR: [
              { name: { contains: 'Accounts Receivable', mode: 'insensitive' } },
              { code: '1003' },
            ],
          },
        }),
        // Cost of Goods Sold
        tx.account.findFirst({
          where: {
            OR: [
              { name: { contains: 'Cost of Goods Sold', mode: 'insensitive' } },
              { code: '5001' },
            ],
          },
        }),
        // Inventory
        tx.account.findFirst({
          where: {
            OR: [
              { name: { contains: 'Inventory', mode: 'insensitive' } },
              { code: '1004' },
            ],
          },
        }),
      ]);

      if (!isReturn && salesRevenueAccount) {
        // Calculate net revenue (subtotal - discount, WITHOUT tax)
        const netRevenue = Math.abs(subtotal) - discount;
        
        // For cash sales: Debit Cash, Credit Sales Revenue (net), Credit Tax Payable
        if (isCashSale && actualPaid > 0 && cashAccount) {
          // Transaction 1: Debit Cash, Credit Sales Revenue (net revenue)
          await tx.transaction.create({
            data: {
              groupId: transactionGroup.id,
              debitAccountId: cashAccount.id,
              creditAccountId: salesRevenueAccount.id,
              amount: netRevenue,
              description: `Sale ${invoiceNo} - Revenue`,
              saleId: newSale.id,
              date: new Date(),
            },
          });

          // Update account balances
          await tx.account.update({
            where: { id: cashAccount.id },
            data: { balance: { increment: netRevenue } },
          });
          await tx.account.update({
            where: { id: salesRevenueAccount.id },
            data: { balance: { decrement: netRevenue } },
          });

          // Transaction 2: Debit Cash, Credit Tax Payable (if tax exists)
          if (finalTax > 0 && taxPayableAccount) {
            await tx.transaction.create({
              data: {
                groupId: transactionGroup.id,
                debitAccountId: cashAccount.id,
                creditAccountId: taxPayableAccount.id,
                amount: finalTax,
                description: `Sale ${invoiceNo} - Tax collected`,
                saleId: newSale.id,
                date: new Date(),
              },
            });

            await tx.account.update({
              where: { id: cashAccount.id },
              data: { balance: { increment: finalTax } },
            });
            await tx.account.update({
              where: { id: taxPayableAccount.id },
              data: { balance: { decrement: finalTax } },
            });
          }
        }

        // For credit sales: Debit Accounts Receivable, Credit Sales Revenue (net), Credit Tax Payable
        if (!isCashSale && due > 0 && accountsReceivableAccount) {
          // Transaction 1: Debit Accounts Receivable, Credit Sales Revenue (net revenue)
          await tx.transaction.create({
            data: {
              groupId: transactionGroup.id,
              debitAccountId: accountsReceivableAccount.id,
              creditAccountId: salesRevenueAccount.id,
              amount: netRevenue,
              description: `Sale ${invoiceNo} - Revenue`,
              saleId: newSale.id,
              date: new Date(),
            },
          });

          await tx.account.update({
            where: { id: accountsReceivableAccount.id },
            data: { balance: { increment: netRevenue } },
          });
          await tx.account.update({
            where: { id: salesRevenueAccount.id },
            data: { balance: { decrement: netRevenue } },
          });

          // Transaction 2: Debit Accounts Receivable, Credit Tax Payable (if tax exists)
          if (finalTax > 0 && taxPayableAccount) {
            await tx.transaction.create({
              data: {
                groupId: transactionGroup.id,
                debitAccountId: accountsReceivableAccount.id,
                creditAccountId: taxPayableAccount.id,
                amount: finalTax,
                description: `Sale ${invoiceNo} - Tax collected`,
                saleId: newSale.id,
                date: new Date(),
              },
            });

            await tx.account.update({
              where: { id: accountsReceivableAccount.id },
              data: { balance: { increment: finalTax } },
            });
            await tx.account.update({
              where: { id: taxPayableAccount.id },
              data: { balance: { decrement: finalTax } },
            });
          }
        }

        // Cost of Goods Sold (COGS) - Calculate total cost
        const totalCost = items.reduce((sum: number, item: any) => {
          return sum + (item.costPrice || 0) * item.quantity;
        }, 0);

        if (totalCost > 0 && cogsAccount && inventoryAccount) {
          // Transaction: Debit COGS, Credit Inventory
          await tx.transaction.create({
            data: {
              groupId: transactionGroup.id,
              debitAccountId: cogsAccount.id,
              creditAccountId: inventoryAccount.id,
              amount: totalCost,
              description: `Sale ${invoiceNo} - COGS`,
              saleId: newSale.id,
              date: new Date(),
            },
          });

          await tx.account.update({
            where: { id: cogsAccount.id },
            data: { balance: { increment: totalCost } },
          });
          await tx.account.update({
            where: { id: inventoryAccount.id },
            data: { balance: { decrement: totalCost } },
          });
        }
      }

      return newSale;
    });

    // Fetch complete sale with relations
    const completeSale = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        customer: true,
        user: { select: { username: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
        payments: true,
      },
    });

    return NextResponse.json(completeSale, { status: 201 });
  } catch (error: any) {
    console.error('Error creating sale:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create sale',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

