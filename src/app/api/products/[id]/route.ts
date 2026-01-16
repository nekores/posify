import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/products/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        brand: true,
        unit: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

// PUT /api/products/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const productId = params.id;

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Validate for duplicate SKU (excluding current product)
    if (body.sku) {
      const duplicateSku = await prisma.product.findFirst({
        where: {
          sku: body.sku,
          id: { not: productId },
        },
      });
      if (duplicateSku) {
        return NextResponse.json(
          { error: `SKU "${body.sku}" already exists for product "${duplicateSku.name}"` },
          { status: 400 }
        );
      }
    }

    // Validate for duplicate barcode (excluding current product)
    if (body.barcode) {
      const duplicateBarcode = await prisma.product.findFirst({
        where: {
          barcode: body.barcode,
          id: { not: productId },
        },
      });
      if (duplicateBarcode) {
        return NextResponse.json(
          { error: `Barcode "${body.barcode}" already exists for product "${duplicateBarcode.name}"` },
          { status: 400 }
        );
      }
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name: body.name,
        sku: body.sku,
        barcode: body.barcode,
        description: body.description,
        categoryId: body.categoryId || null,
        brandId: body.brandId || null,
        unitId: body.unitId || null,
        costPrice: body.costPrice || 0,
        salePrice: body.salePrice || 0,
        packPrice: body.packPrice,
        packSize: body.packSize,
        minStock: body.minStock || 0,
        maxStock: body.maxStock,
        taxRate: body.taxRate || 0,
        image: body.image,
      },
      include: {
        category: true,
        brand: true,
        unit: true,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

// DELETE /api/products/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;

    // Check if product has any inventory, purchases, or sales
    const [inventoryCount, purchaseCount, saleCount] = await Promise.all([
      prisma.inventory.count({ where: { productId } }),
      prisma.purchaseItem.count({ where: { productId } }),
      prisma.saleItem.count({ where: { productId } }),
    ]);

    if (inventoryCount > 0 || purchaseCount > 0 || saleCount > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete product with existing inventory, purchases, or sales history',
          details: {
            inventory: inventoryCount,
            purchases: purchaseCount,
            sales: saleCount,
          }
        },
        { status: 400 }
      );
    }

    await prisma.product.delete({
      where: { id: productId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}

