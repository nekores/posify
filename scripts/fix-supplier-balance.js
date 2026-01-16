const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSupplierBalance() {
  console.log('=== FIXING SUPPLIER BALANCE ===\n');
  
  // Reset Waqas lahore to 0
  const waqas = await prisma.supplier.findFirst({
    where: { name: { contains: 'Waqas lahore', mode: 'insensitive' } }
  });
  
  if (waqas) {
    await prisma.supplier.update({
      where: { id: waqas.id },
      data: { balance: 0 }
    });
    console.log('✓ Reset Waqas lahore balance to 0');
  }
  
  // Set Lahore, Random to correct balance
  const lahoreRandom = await prisma.supplier.findFirst({
    where: { name: 'Lahore, Random' }
  });
  
  if (lahoreRandom) {
    await prisma.supplier.update({
      where: { id: lahoreRandom.id },
      data: { balance: 512660 }
    });
    console.log('✓ Set Lahore, Random balance to Rs 512,660');
  }
  
  // Verification
  console.log('\n=== FINAL STATE ===\n');
  
  const purchaseStats = await prisma.purchase.aggregate({
    _sum: { due: true }
  });
  
  const supplierStats = await prisma.supplier.aggregate({
    _sum: { balance: true }
  });
  
  const suppliersWithBalance = await prisma.supplier.findMany({
    where: { balance: { gt: 0 } }
  });
  
  console.log('📦 Total Purchase Due:', 'Rs ' + Number(purchaseStats._sum.due || 0).toLocaleString());
  console.log('🏢 Total Supplier Balance:', 'Rs ' + Number(supplierStats._sum.balance || 0).toLocaleString());
  
  console.log('\nSuppliers with Balance:');
  suppliersWithBalance.forEach(s => {
    console.log('  •', s.name + ':', 'Rs ' + Number(s.balance).toLocaleString());
  });
  
  const diff = Number(purchaseStats._sum.due || 0) - Number(supplierStats._sum.balance || 0);
  console.log('\n✅ Match:', diff === 0 ? 'YES ✓' : 'NO - Diff: ' + diff);
  
  await prisma.$disconnect();
}

fixSupplierBalance().catch(console.error);
