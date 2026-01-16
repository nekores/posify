const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('=== CHECKING FOR ANY NEGATIVE STOCK ===\n');
  
  const products = await prisma.product.findMany();
  let negativeCount = 0;
  
  for (const p of products) {
    const inv = await prisma.inventory.aggregate({
      where: { productId: p.id },
      _sum: { quantity: true }
    });
    
    const stock = inv._sum.quantity || 0;
    
    if (stock < 0) {
      console.log('❌ NEGATIVE: ' + p.name + ' = ' + stock);
      negativeCount++;
    }
  }
  
  if (negativeCount === 0) {
    console.log('✅ NO NEGATIVE STOCK FOUND!');
    console.log('\nAll products are either 0 or positive.');
    console.log('\n📋 Products with 0 stock are showing as "Out of Stock" - this is CORRECT behavior.');
  } else {
    console.log('\n⚠️ Found ' + negativeCount + ' products with negative stock');
  }
  
  // Count summary
  let zeroStock = 0;
  let positiveStock = 0;
  
  for (const p of products) {
    const inv = await prisma.inventory.aggregate({
      where: { productId: p.id },
      _sum: { quantity: true }
    });
    const stock = inv._sum.quantity || 0;
    if (stock === 0) zeroStock++;
    else if (stock > 0) positiveStock++;
  }
  
  console.log('\n=== STOCK SUMMARY ===');
  console.log('Products with 0 stock (Out of Stock): ' + zeroStock);
  console.log('Products with positive stock (In Stock): ' + positiveStock);
  console.log('Total products: ' + products.length);
  
  await prisma.$disconnect();
}

check();
