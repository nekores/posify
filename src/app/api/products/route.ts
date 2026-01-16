import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Generate next barcode as auto-incrementing number
async function generateNextBarcode(): Promise<string> {
  // Find the highest numeric barcode
  const products = await prisma.product.findMany({
    where: {
      barcode: { not: null },
    },
    select: { barcode: true },
    orderBy: { createdAt: 'desc' },
  });

  let maxBarcode = 1000000000; // Start from 1 billion (10 digits)

  for (const product of products) {
    if (product.barcode) {
      const numericBarcode = parseInt(product.barcode, 10);
      if (!isNaN(numericBarcode) && numericBarcode >= maxBarcode) {
        maxBarcode = numericBarcode;
      }
    }
  }

  // Increment and return
  const nextBarcode = (maxBarcode + 1).toString();
  
  // Ensure uniqueness (in case of race condition)
  const existing = await prisma.product.findFirst({
    where: { barcode: nextBarcode },
  });
  
  if (existing) {
    // Recursively try next number
    return generateNextBarcode();
  }

  return nextBarcode;
}

// GET /api/products
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where = {
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
          { barcode: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(categoryId && { categoryId }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          brand: true,
          unit: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    // Calculate stock for each product from inventory table
    // Inventory table tracks ALL stock movements:
    // - Opening stock (type: 'opening')
    // - Purchases (type: 'purchase') - positive
    // - Purchase returns (type: 'purchase_return') - negative
    // - Sales (type: 'sale') - negative
    // - Sale returns (type: 'sale_return') - positive
    // - Adjustments (type: 'adjustment') - positive or negative
    const productsWithStock = await Promise.all(
      products.map(async (product) => {
        const inventory = await prisma.inventory.aggregate({
          where: { productId: product.id },
          _sum: { quantity: true },
        });

        const stock = inventory._sum.quantity || 0;

        return {
          ...product,
          stock,
        };
      })
    );

    return NextResponse.json({
      data: productsWithStock,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST /api/products
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate for duplicate SKU
    if (body.sku) {
      const existingSku = await prisma.product.findFirst({
        where: { sku: body.sku },
      });
      if (existingSku) {
        return NextResponse.json(
          { error: `SKU "${body.sku}" already exists for product "${existingSku.name}"` },
          { status: 400 }
        );
      }
    }

    // Auto-generate barcode if not provided
    let barcode = body.barcode;
    if (!barcode) {
      barcode = await generateNextBarcode();
    } else {
      // Validate for duplicate barcode if provided
      const existingBarcode = await prisma.product.findFirst({
        where: { barcode: barcode },
      });
      if (existingBarcode) {
        return NextResponse.json(
          { error: `Barcode "${barcode}" already exists for product "${existingBarcode.name}"` },
          { status: 400 }
        );
      }
    }

    const product = await prisma.product.create({
      data: {
        name: body.name,
        sku: body.sku,
        barcode: barcode,
        description: body.description,
        categoryId: body.categoryId,
        brandId: body.brandId,
        unitId: body.unitId,
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

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

