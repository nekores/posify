const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPurchaseData() {
  console.log('=== FIXING PURCHASE DATA WITH CORRECT INFO ===\n');
  
  // Correct unpaid invoices from Lahore, Random
  const unpaidInvoices = ['2881', '134', '4758', '1962', '7365'];
  const unpaidAmounts = {
    '7365': 205800,
    '1962': 36000,
    '4758': 78000,
    '134': 123620,
    '2881': 69240
  };
  
  // Only return invoice
  const returnInvoice = '8435878';
  
  // Step 1: Mark ALL purchases as PAID first
  console.log('Step 1: Marking all purchases as PAID...');
  await prisma.purchase.updateMany({
    data: {
      status: 'completed',
      isReturn: false
    }
  });
  
  // Update each purchase to set paid = total, due = 0
  const allPurchases = await prisma.purchase.findMany();
  for (const p of allPurchases) {
    await prisma.purchase.update({
      where: { id: p.id },
      data: {
        paid: p.total,
        due: 0
      }
    });
  }
  console.log(`  Updated ${allPurchases.length} purchases to PAID\n`);
  
  // Step 2: Mark the 5 unpaid invoices from Lahore, Random
  console.log('Step 2: Marking correct unpaid purchases...');
  
  // Find Lahore, Random supplier
  const lahoreSupplier = await prisma.supplier.findFirst({
    where: { name: { contains: 'Lahore', mode: 'insensitive' } }
  });
  
  if (!lahoreSupplier) {
    console.log('  WARNING: Lahore, Random supplier not found!');
  } else {
    console.log(`  Found supplier: ${lahoreSupplier.name} (ID: ${lahoreSupplier.id})`);
  }
  
  let totalUnpaid = 0;
  for (const invoiceNo of unpaidInvoices) {
    const purchase = await prisma.purchase.findFirst({
      where: { invoiceNo: invoiceNo }
    });
    
    if (purchase) {
      const amount = unpaidAmounts[invoiceNo];
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          paid: 0,
          due: amount,
          status: 'pending'
        }
      });
      totalUnpaid += amount;
      console.log(`  ✓ ${invoiceNo}: Due Rs ${amount.toLocaleString()}`);
    } else {
      console.log(`  ✗ ${invoiceNo}: NOT FOUND in new POS`);
    }
  }
  console.log(`  Total Unpaid: Rs ${totalUnpaid.toLocaleString()}\n`);
  
  // Step 3: Mark the return invoice
  console.log('Step 3: Marking the return invoice...');
  const returnPurchase = await prisma.purchase.findFirst({
    where: { invoiceNo: returnInvoice }
  });
  
  if (returnPurchase) {
    await prisma.purchase.update({
      where: { id: returnPurchase.id },
      data: {
        isReturn: true,
        paid: returnPurchase.total,
        due: 0,
        status: 'completed'
      }
    });
    console.log(`  ✓ ${returnInvoice}: Marked as RETURN (Rs ${Number(returnPurchase.total).toLocaleString()})\n`);
  } else {
    console.log(`  ✗ ${returnInvoice}: NOT FOUND in new POS\n`);
  }
  
  // Step 4: Reset ALL supplier balances to 0
  console.log('Step 4: Resetting all supplier balances...');
  await prisma.supplier.updateMany({
    data: { balance: 0 }
  });
  
  // Step 5: Set only Lahore, Random supplier balance
  if (lahoreSupplier) {
    await prisma.supplier.update({
      where: { id: lahoreSupplier.id },
      data: { balance: totalUnpaid }
    });
    console.log(`  ✓ ${lahoreSupplier.name}: Balance set to Rs ${totalUnpaid.toLocaleString()}\n`);
  }
  
  // Final Verification
  console.log('=== FINAL VERIFICATION ===\n');
  
  const purchaseStats = await prisma.purchase.aggregate({
    _sum: { total: true, paid: true, due: true },
    _count: true
  });
  
  const returnStats = await prisma.purchase.aggregate({
    where: { isReturn: true },
    _sum: { total: true },
    _count: true
  });
  
  const supplierStats = await prisma.supplier.aggregate({
    _sum: { balance: true }
  });
  
  const suppliersWithBalance = await prisma.supplier.findMany({
    where: { balance: { gt: 0 } }
  });
  
  console.log('📦 PURCHASE MANAGEMENT');
  console.log('─'.repeat(50));
  console.log('Total Purchases:', purchaseStats._count);
  console.log('Total Amount:', 'Rs ' + Number(purchaseStats._sum.total || 0).toLocaleString());
  console.log('Total Paid:', 'Rs ' + Number(purchaseStats._sum.paid || 0).toLocaleString());
  console.log('Total Due:', 'Rs ' + Number(purchaseStats._sum.due || 0).toLocaleString());
  console.log('Returns:', returnStats._count, '(Rs ' + Number(returnStats._sum.total || 0).toLocaleString() + ')');
  
  console.log('\n🏢 SUPPLIERS');
  console.log('─'.repeat(50));
  console.log('Total Balance (Payable):', 'Rs ' + Number(supplierStats._sum.balance || 0).toLocaleString());
  
  if (suppliersWithBalance.length > 0) {
    console.log('\nSuppliers with Balance:');
    suppliersWithBalance.forEach(s => {
      console.log('  •', s.name + ':', 'Rs ' + Number(s.balance).toLocaleString());
    });
  }
  
  console.log('\n✅ VERIFICATION');
  console.log('─'.repeat(50));
  const diff = Number(purchaseStats._sum.due || 0) - Number(supplierStats._sum.balance || 0);
  console.log('Purchase Due - Supplier Balance =', diff === 0 ? '0 ✓ MATCHED!' : diff);
  
  await prisma.$disconnect();
}

fixPurchaseData().catch(console.error);
