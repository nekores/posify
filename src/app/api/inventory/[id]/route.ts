import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const inventoryId = params.id;

    // Get the inventory entry
    const inventoryEntry = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      include: { product: true },
    });

    if (!inventoryEntry) {
      return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
    }

    // Only allow deleting adjustment type entries
    if (inventoryEntry.type !== 'adjustment') {
      return NextResponse.json(
        { error: 'Only manual adjustments can be deleted. Purchase/Sale entries cannot be deleted from here.' },
        { status: 400 }
      );
    }

    // Check if reverting this adjustment would cause negative stock
    const currentStockResult = await prisma.inventory.aggregate({
      where: { productId: inventoryEntry.productId },
      _sum: { quantity: true },
    });
    const currentStock = currentStockResult._sum.quantity || 0;

    // If the adjustment was adding stock, deleting it will subtract
    // If the adjustment was subtracting stock, deleting it will add back
    const stockAfterDelete = currentStock - inventoryEntry.quantity;

    if (stockAfterDelete < 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete this adjustment. It would result in negative stock (${stockAfterDelete}) for "${inventoryEntry.product.name}". Current stock: ${currentStock}, Adjustment quantity: ${inventoryEntry.quantity > 0 ? '+' : ''}${inventoryEntry.quantity}` 
        },
        { status: 400 }
      );
    }

    // Delete the inventory entry
    await prisma.inventory.delete({
      where: { id: inventoryId },
    });

    return NextResponse.json({ 
      success: true,
      message: `Adjustment deleted. Stock ${inventoryEntry.quantity > 0 ? 'decreased' : 'increased'} by ${Math.abs(inventoryEntry.quantity)} for ${inventoryEntry.product.name}`,
      previousStock: currentStock,
      newStock: stockAfterDelete,
    });
  } catch (error) {
    console.error('Error deleting adjustment:', error);
    return NextResponse.json({ error: 'Failed to delete adjustment' }, { status: 500 });
  }
}

