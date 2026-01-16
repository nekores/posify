const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  console.log('=== VERIFYING STOCK CALCULATION ===\n');
  
  // Check specific products user mentioned
  const productNames = [
    'Body Spray Afshan 200ml',
    'Body Spray Fogg 120ml',
    'SFR Adidas Shoes',
    'SFR Combo Sneakers',
    'SFR Cockers Shoes',
    'SFR KIds SR008',
    'SFR Ladies foam chappal TE1',
    'SFR Ladies shoes TE1',
    'SFR Shoe TE1',
    'SFR Shoe TE4',
    'SFR Shoe TE6',
    'SFR Sneaker Venron Sabni',
    'SPT Denim Cotton Pent (32 Waist)',
    'SPT Denim Cotton Pent (30 Waist)',
    'SPT Jeans (30 Waist)',
  ];
  
  for (const name of productNames) {
    const product = await prisma.product.findFirst({
      where: { name: { contains: name, mode: 'insensitive' } }
    });
    
    if (!product) {
      console.log(name + ': NOT FOUND');
      continue;
    }
    
    // NEW correct calculation (inventory only)
    const inventory = await prisma.inventory.aggregate({
      where: { productId: product.id },
      _sum: { quantity: true },
    });
    
    // OLD wrong calculation
    const purchased = await prisma.purchaseItem.aggregate({
      where: { productId: product.id, isReturn: false },
      _sum: { quantity: true },
    });
    
    const sold = await prisma.saleItem.aggregate({
      where: { productId: product.id, isReturn: false },
      _sum: { quantity: true },
    });
    
    const correctStock = inventory._sum.quantity || 0;
    const wrongStock = (inventory._sum.quantity || 0) + (purchased._sum.quantity || 0) - (sold._sum.quantity || 0);
    
    console.log(name);
    console.log('  ✅ Correct (inventory only): ' + correctStock);
    console.log('  ❌ Wrong (double-counted): ' + wrongStock);
    console.log('');
  }
  
  await prisma.$disconnect();
}

verify();
