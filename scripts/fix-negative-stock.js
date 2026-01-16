const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixNegativeStock() {
  console.log('=== CHECKING FOR NEGATIVE STOCK ===\n');
  
  const products = await prisma.product.findMany();
  let fixed = 0;
  let negativeProducts = [];
  
  for (const product of products) {
    // Calculate current stock from inventory
    const inventory = await prisma.inventory.aggregate({
      where: { productId: product.id },
      _sum: { quantity: true },
    });
    
    const currentStock = inventory._sum.quantity || 0;
    
    if (currentStock < 0) {
      negativeProducts.push({ name: product.name, stock: currentStock });
      
      // Create adjustment to bring stock to 0
      const adjustmentQty = Math.abs(currentStock);
      
      await prisma.inventory.create({
        data: {
          productId: product.id,
          quantity: adjustmentQty,
          costPrice: product.costPrice || 0,
          type: 'adjustment',
          notes: `Stock adjustment: Fixed negative stock from ${currentStock} to 0`,
        },
      });
      
      console.log(`📦 ${product.name}: ${currentStock} → 0 (added +${adjustmentQty})`);
      fixed++;
    }
  }
  
  if (fixed === 0) {
    console.log('✅ No products with negative stock found!');
  } else {
    console.log(`\n=== FIXED ${fixed} PRODUCTS ===`);
  }
  
  // Final verification
  console.log('\n=== FINAL VERIFICATION ===');
  let stillNegative = 0;
  for (const product of products) {
    const inventory = await prisma.inventory.aggregate({
      where: { productId: product.id },
      _sum: { quantity: true },
    });
    const stock = inventory._sum.quantity || 0;
    if (stock < 0) {
      console.log(`❌ Still negative: ${product.name} = ${stock}`);
      stillNegative++;
    }
  }
  
  if (stillNegative === 0) {
    console.log('✅ All products now have stock >= 0');
  } else {
    console.log(`\n⚠️ ${stillNegative} products still have negative stock`);
  }
  
  await prisma.$disconnect();
}

fixNegativeStock().catch(console.error);
