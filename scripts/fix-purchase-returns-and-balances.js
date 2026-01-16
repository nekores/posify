const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPurchaseReturnsAndBalances() {
  console.log('=== FIXING PURCHASE RETURNS & SUPPLIER BALANCES ===\n');
  
  // Step 1: Fix all purchase returns - they should have due = 0
  // (Returns are credits, not debts)
  console.log('Step 1: Fixing purchase returns (due should be 0 for returns)...');
  const returnPurchases = await prisma.purchase.findMany({
    where: { isReturn: true }
  });
  
  for (const purchase of returnPurchases) {
    if (Number(purchase.due) !== 0) {
      console.log(`  Fixing return ${purchase.invoiceNo}: due ${Number(purchase.due)} → 0`);
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: { 
          due: 0,
          paid: purchase.total // Returns are "settled" immediately
        }
      });
    }
  }
  console.log(`  Fixed ${returnPurchases.length} return purchase(s)\n`);
  
  // Step 2: Recalculate all supplier balances
  console.log('Step 2: Recalculating supplier balances...');
  const suppliers = await prisma.supplier.findMany({
    include: {
      purchases: {
        select: {
          id: true,
          invoiceNo: true,
          total: true,
          due: true,
          isReturn: true
        }
      }
    }
  });
  
  let totalFixed = 0;
  for (const supplier of suppliers) {
    // Sum of dues from normal purchases (what we owe)
    const purchaseDue = supplier.purchases
      .filter(p => !p.isReturn)
      .reduce((sum, p) => sum + Number(p.due || 0), 0);
    
    // Sum of return totals (credit we get back)
    const returnCredit = supplier.purchases
      .filter(p => p.isReturn)
      .reduce((sum, p) => sum + Number(p.total || 0), 0);
    
    // Correct balance = what we owe - what we got back as returns
    const correctBalance = purchaseDue - returnCredit;
    // Balance can't be negative (if we have more returns than dues)
    const finalBalance = Math.max(0, correctBalance);
    
    const currentBalance = Number(supplier.balance || 0);
    
    if (Math.abs(currentBalance - finalBalance) > 0.01) {
      console.log(`  ${supplier.name}:`);
      console.log(`    Purchase Due (non-returns): Rs ${purchaseDue.toLocaleString()}`);
      console.log(`    Return Credit: Rs ${returnCredit.toLocaleString()}`);
      console.log(`    Current Balance: Rs ${currentBalance.toLocaleString()}`);
      console.log(`    Correct Balance: Rs ${finalBalance.toLocaleString()}`);
      
      await prisma.supplier.update({
        where: { id: supplier.id },
        data: { balance: finalBalance }
      });
      
      totalFixed++;
    }
  }
  
  console.log(`\n  Fixed ${totalFixed} supplier balance(s)\n`);
  
  // Step 3: Verify final totals
  console.log('Step 3: Verifying final totals...');
  
  const finalPurchaseStats = await prisma.purchase.aggregate({
    _sum: { total: true, paid: true, due: true }
  });
  
  const finalSupplierBalance = await prisma.supplier.aggregate({
    _sum: { balance: true }
  });
  
  console.log('\n=== FINAL RESULTS ===');
  console.log('Purchases:');
  console.log('  Total Amount:', Number(finalPurchaseStats._sum.total || 0).toLocaleString());
  console.log('  Total Paid:', Number(finalPurchaseStats._sum.paid || 0).toLocaleString());
  console.log('  Total Due:', Number(finalPurchaseStats._sum.due || 0).toLocaleString());
  
  console.log('\nSuppliers:');
  console.log('  Total Balance (Payable):', Number(finalSupplierBalance._sum.balance || 0).toLocaleString());
  
  const discrepancy = Number(finalPurchaseStats._sum.due || 0) - Number(finalSupplierBalance._sum.balance || 0);
  console.log('\nDiscrepancy:', discrepancy.toLocaleString());
  
  if (Math.abs(discrepancy) < 1) {
    console.log('✅ SUCCESS! Purchase Due and Supplier Balance now match!');
  } else {
    console.log('⚠️  Still have discrepancy - investigating...');
    
    // Check for purchases without suppliers
    const purchasesWithoutSupplier = await prisma.purchase.findMany({
      where: { supplierId: null, isReturn: false },
      select: { id: true, invoiceNo: true, due: true }
    });
    
    if (purchasesWithoutSupplier.length > 0) {
      const orphanDue = purchasesWithoutSupplier.reduce((sum, p) => sum + Number(p.due || 0), 0);
      console.log(`\n  Found ${purchasesWithoutSupplier.length} purchase(s) without supplier`);
      console.log(`  Their total due: Rs ${orphanDue.toLocaleString()}`);
      console.log('  (These are not included in any supplier balance)');
    }
  }
  
  await prisma.$disconnect();
}

fixPurchaseReturnsAndBalances().catch(console.error);
