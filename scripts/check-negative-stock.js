const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNegativeStock() {
  console.log('=== PRODUCTS WITH NEGATIVE STOCK ===\n');
  
  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
  });
  
  const negativeStockProducts = [];
  
  for (const product of products) {
    const inventory = await prisma.inventory.aggregate({
      where: { productId: product.id },
      _sum: { quantity: true },
    });
    
    const calculatedStock = inventory._sum.quantity || 0;
    
    if (calculatedStock < 0) {
      const purchases = await prisma.inventory.aggregate({
        where: { productId: product.id, type: 'purchase' },
        _sum: { quantity: true },
      });
      
      const sales = await prisma.inventory.aggregate({
        where: { productId: product.id, type: 'sale' },
        _sum: { quantity: true },
      });
      
      const returns = await prisma.inventory.aggregate({
        where: { productId: product.id, type: 'sale_return' },
        _sum: { quantity: true },
      });
      
      const opening = await prisma.inventory.aggregate({
        where: { productId: product.id, type: 'opening' },
        _sum: { quantity: true },
      });
      
      negativeStockProducts.push({
        name: product.name.substring(0, 40),
        stock: calculatedStock,
        opening: opening._sum.quantity || 0,
        purchases: purchases._sum.quantity || 0,
        sales: sales._sum.quantity || 0,
        returns: returns._sum.quantity || 0,
      });
    }
  }
  
  console.log('Found ' + negativeStockProducts.length + ' products with negative stock:\n');
  
  negativeStockProducts.slice(0, 15).forEach(p => {
    console.log('📦 ' + p.name);
    console.log('   Stock: ' + p.stock + ' | Opening: ' + p.opening + ' | Purchases: +' + p.purchases + ' | Sales: ' + p.sales + ' | Returns: +' + p.returns);
    console.log('');
  });
  
  if (negativeStockProducts.length > 15) {
    console.log('... and ' + (negativeStockProducts.length - 15) + ' more products with negative stock');
  }
  
  await prisma.$disconnect();
}

checkNegativeStock().catch(console.error);
