const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSuppliers() {
  // Find suppliers with "Lahore" in name
  const suppliers = await prisma.supplier.findMany({
    where: {
      OR: [
        { name: { contains: 'Lahore', mode: 'insensitive' } },
        { name: { contains: 'Random', mode: 'insensitive' } }
      ]
    }
  });
  
  console.log('Suppliers with Lahore/Random in name:');
  suppliers.forEach(s => {
    console.log('  -', s.name + ':', 'Balance Rs ' + Number(s.balance).toLocaleString());
  });
  
  // Check the purchases for those 5 invoices
  const invoices = ['2881', '134', '4758', '1962', '7365'];
  console.log('\nPurchases linked to those invoices:');
  for (const inv of invoices) {
    const p = await prisma.purchase.findFirst({
      where: { invoiceNo: inv },
      include: { supplier: { select: { name: true } } }
    });
    if (p) {
      console.log('  -', inv + ':', p.supplier?.name || 'NO SUPPLIER', '- Due Rs ' + Number(p.due).toLocaleString());
    }
  }
  
  await prisma.$disconnect();
}

checkSuppliers().catch(console.error);
