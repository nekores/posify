import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const date = searchParams.get('date');
    const invoiceNo = searchParams.get('invoiceNo');
    const supplierId = searchParams.get('supplierId');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (date) {
      const dateStart = new Date(date);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);
      where.date = {
        gte: dateStart,
        lte: dateEnd,
      };
    }

    if (invoiceNo) {
      where.invoiceNo = {
        contains: invoiceNo,
        mode: 'insensitive',
      };
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: {
          supplier: true,
          user: {
            select: { username: true },
          },
          items: {
            include: {
              product: {
                select: { name: true, sku: true },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.purchase.count({ where }),
    ]);

    return NextResponse.json({
      data: purchases,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { 
      supplierId, 
      items, 
      discount = 0, 
      tax = 0, 
      paid = 0, 
      invoiceNo: customInvoiceNo,
      date,
      notes,
      paymentType = 'cash',
      isReturn = false, // Handle purchase returns
    } = data;

    // Calculate tax from items if not provided
    let calculatedTax = 0;
    if (tax === 0) {
      // Calculate tax from item taxRate if tax not provided
      for (const item of items) {
        if (item.tax) {
          calculatedTax += Number(item.tax);
        } else {
          // Get product taxRate and calculate tax
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: { taxRate: true },
          });
          if (product && product.taxRate) {
            const itemSubtotal = Number(item.unitPrice) * item.quantity + (Number(item.freightIn) || 0);
            const itemTax = (itemSubtotal * Number(product.taxRate)) / 100;
            calculatedTax += itemTax;
            item.tax = itemTax;
          }
        }
      }
    }
    
    // Use provided tax or calculated tax
    const finalTax = tax > 0 ? tax : calculatedTax;
    
    // Calculate totals (subtotal is before tax)
    const subtotal = items.reduce((sum: number, item: any) => {
      const itemSubtotal = Number(item.unitPrice) * item.quantity + (Number(item.freightIn) || 0);
      return sum + itemSubtotal;
    }, 0);
    const total = subtotal - discount + finalTax;
    const due = total - paid;

    // ✅ SERVER-SIDE STOCK VALIDATION for Purchase Returns
    // Cannot return more than available stock
    if (isReturn) {
      for (const item of items) {
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
              error: `Cannot return "${product?.name || 'Product'}". Stock available: ${currentStock}, Trying to return: ${item.quantity}` 
            },
            { status: 400 }
          );
        }
      }
    }

    // Generate or validate invoice number
    let invoiceNo = customInvoiceNo;
    
    // If invoice number is provided, check if it's unique
    if (invoiceNo) {
      const existing = await prisma.purchase.findUnique({
        where: { invoiceNo },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Invoice number ${invoiceNo} already exists. Please use a different number.` },
          { status: 400 }
        );
      }
    } else {
      // Generate a new unique invoice number
      const lastPurchase = await prisma.purchase.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { invoiceNo: true },
      });
      
      let nextNumber = 1;
      if (lastPurchase?.invoiceNo) {
        const numMatch = lastPurchase.invoiceNo.match(/(\d+)$/);
        if (numMatch) {
          nextNumber = parseInt(numMatch[1], 10) + 1;
        }
      }
      
      // Also check total count
      const totalCount = await prisma.purchase.count();
      if (totalCount >= nextNumber) {
        nextNumber = totalCount + 1;
      }
      
      invoiceNo = String(nextNumber).padStart(6, '0');
      
      // Ensure uniqueness
      let attempts = 0;
      while (attempts < 100) {
        const exists = await prisma.purchase.findUnique({
          where: { invoiceNo },
        });
        if (!exists) break;
        nextNumber++;
        invoiceNo = String(nextNumber).padStart(6, '0');
        attempts++;
      }
    }

    // Create purchase with items in a transaction
    const purchase = await prisma.$transaction(async (tx) => {
      // Create purchase
      const newPurchase = await tx.purchase.create({
        data: {
          invoiceNo,
          supplierId: supplierId || null,
          userId: session.user.id,
          storeId: session.user.storeId,
          subtotal,
          discount,
          tax: finalTax,
          total,
          paid,
          due,
          status: due <= 0 ? 'completed' : 'pending',
          isReturn, // Mark as return if applicable
          notes,
          date: date ? new Date(date) : new Date(),
        },
      });

      // Create purchase items
      for (const item of items) {
        await tx.purchaseItem.create({
          data: {
            purchaseId: newPurchase.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            tax: item.tax || 0,
            total: (Number(item.unitPrice) * item.quantity) + (Number(item.freightIn) || 0) + (item.tax || 0),
          },
        });

        // Record inventory entry
        // For returns, quantity is negative (stock decreases)
        await tx.inventory.create({
          data: {
            productId: item.productId,
            quantity: isReturn ? -item.quantity : item.quantity,
            costPrice: item.unitPrice,
            type: isReturn ? 'purchase_return' : 'purchase',
            notes: isReturn ? `Purchase Return: ${invoiceNo}` : `Purchase: ${invoiceNo}`,
          },
        });

        // Get current product for WAC calculation (only for regular purchases, not returns)
        if (!isReturn) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (product) {
            // Calculate current stock
            const inventorySum = await tx.inventory.aggregate({
              where: {
                productId: item.productId,
                type: { in: ['opening', 'adjustment', 'purchase', 'sale_return'] },
              },
              _sum: { quantity: true },
            });
            const currentStock = inventorySum._sum.quantity || 0;

            // Calculate new weighted average cost (excluding current purchase which is already added)
            const previousStock = currentStock - item.quantity;
            const previousValue = Number(product.costPrice) * previousStock;
            const newPurchaseValue = item.unitPrice * item.quantity;
            
            const newTotalStock = currentStock;
            const newTotalValue = previousValue + newPurchaseValue;
            
            const newAverageCost = newTotalStock > 0 ? newTotalValue / newTotalStock : item.unitPrice;

            // Update product cost and optionally sale price
            const updateData: any = {
              costPrice: newAverageCost,
            };

            // Update sale price if provided
            if (item.salePrice !== undefined && item.salePrice !== null && item.salePrice > 0) {
              updateData.salePrice = item.salePrice;
            }

            await tx.product.update({
              where: { id: item.productId },
              data: updateData,
            });
          }
        }
      }

      // Update supplier balance
      if (supplierId) {
        if (isReturn) {
          // For returns: DECREASE supplier balance (we get credit from supplier)
          await tx.supplier.update({
            where: { id: supplierId },
            data: {
              balance: { decrement: total }, // Reduce what we owe them
            },
          });

          // Create supplier ledger entry for return
          await tx.supplierLedger.create({
            data: {
              supplierId,
              purchaseId: newPurchase.id,
              debit: 0,
              credit: total, // Credit to us (reduces our liability)
              balance: -total,
              description: `Purchase Return: ${invoiceNo}`,
              date: new Date(),
            },
          });
        } else if (due > 0) {
          // For regular purchases with due amount: INCREASE supplier balance
          await tx.supplier.update({
            where: { id: supplierId },
            data: {
              balance: { increment: due },
            },
          });

          // Create supplier ledger entry
          await tx.supplierLedger.create({
            data: {
              supplierId,
              purchaseId: newPurchase.id,
              debit: total,
              credit: paid,
              balance: due,
              description: `Purchase: ${invoiceNo}`,
              date: new Date(),
            },
          });
        }
      }

      // Record payment if paid > 0
      if (paid > 0 && !isReturn) {
        // Regular purchase payment to supplier
        await tx.supplierPayment.create({
          data: {
            supplierId: supplierId,
            purchaseId: newPurchase.id,
            amount: paid,
            paymentType,
            date: new Date(),
          },
        });

        // Update Cash in Hand if cash payment
        if (paymentType === 'cash') {
          const cashAccount = await tx.account.findFirst({
            where: {
              OR: [
                { name: { contains: 'Cash in Hand', mode: 'insensitive' } },
                { name: { contains: 'Cash In Hand', mode: 'insensitive' } },
                { code: '1001' },
              ],
            },
          });

          if (cashAccount) {
            // Decrease Cash in Hand (money going out)
            await tx.account.update({
              where: { id: cashAccount.id },
              data: {
                balance: { decrement: paid },
              },
            });

            // Record transaction for audit trail
            await tx.transaction.create({
              data: {
                debitAccountId: cashAccount.id, // For purchase, we're spending from cash
                creditAccountId: cashAccount.id, // Simplified - ideally would be inventory account
                amount: paid,
                description: `Purchase payment: ${invoiceNo}`,
                purchaseId: newPurchase.id,
                date: new Date(),
              },
            });
          }
        }
      } else if (paid > 0 && isReturn) {
        // For returns, record the refund received from supplier
        await tx.supplierPayment.create({
          data: {
            supplierId: supplierId,
            purchaseId: newPurchase.id,
            amount: -paid, // Negative amount indicates refund received
            paymentType,
            notes: 'Refund received for purchase return',
            date: new Date(),
          },
        });

        // Update Cash in Hand if cash refund received
        if (paymentType === 'cash') {
          const cashAccount = await tx.account.findFirst({
            where: {
              OR: [
                { name: { contains: 'Cash in Hand', mode: 'insensitive' } },
                { name: { contains: 'Cash In Hand', mode: 'insensitive' } },
                { code: '1001' },
              ],
            },
          });

          if (cashAccount) {
            // Increase Cash in Hand (money coming in from refund)
            await tx.account.update({
              where: { id: cashAccount.id },
              data: {
                balance: { increment: paid },
              },
            });

            // Record transaction for audit trail
            await tx.transaction.create({
              data: {
                debitAccountId: cashAccount.id,
                creditAccountId: cashAccount.id, // Simplified
                amount: paid,
                description: `Purchase return refund: ${invoiceNo}`,
                purchaseId: newPurchase.id,
                date: new Date(),
              },
            });
          }
        }
      }

      return newPurchase;
    });

    // Fetch complete purchase
    const completePurchase = await prisma.purchase.findUnique({
      where: { id: purchase.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        supplier: true,
      },
    });

    return NextResponse.json(completePurchase, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase:', error);
    return NextResponse.json({ error: 'Failed to create purchase' }, { status: 500 });
  }
}
