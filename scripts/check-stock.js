const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStock() {
  console.log('=== ALL PRODUCTS WITH STOCK <= 0 ===\n');
  
  const products = await prisma.product.findMany();
  
  for (const p of products) {
    const inv = await prisma.inventory.aggregate({
      where: { productId: p.id },
      _sum: { quantity: true }
    });
    
    const stock = inv._sum.quantity || 0;
    
    if (stock <= 0) {
      console.log(p.name + ': ' + stock);
    }
  }
  
  await prisma.$disconnect();
}

checkStock();
