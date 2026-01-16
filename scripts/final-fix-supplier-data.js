const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function finalFix() {
  console.log('=== FINAL FIX: SYNC PURCHASES WITH SUPPLIER BALANCES ===\n');
  
  const suppliers = await prisma.supplier.findMany({
    include: {
      purchases: {
        where: { isReturn: false }
      }
    }
  });
  
  for (const supplier of suppliers) {
    const currentBalance = Number(supplier.balance);
    const unpaidPurchases = supplier.purchases.filter(p => Number(p.due) > 0);
    const totalUnpaidDue = unpaidPurchases.reduce((sum, p) => sum + Number(p.due), 0);
    
    if (totalUnpaidDue === 0 && currentBalance === 0) continue;
    
    if (totalUnpaidDue !== currentBalance) {
      console.log(`${supplier.name}:`);
      console.log(`  Supplier Balance (truth): Rs ${currentBalance.toLocaleString()}`);
      console.log(`  Total Unpaid Purchase Due: Rs ${totalUnpaidDue.toLocaleString()}`);
      
      if (currentBalance === 0) {
        // Mark all purchases as paid
        console.log(`  Action: Marking ${unpaidPurchases.length} purchases as PAID`);
        for (const p of unpaidPurchases) {
          await prisma.purchase.update({
            where: { id: p.id },
            data: { paid: p.total, due: 0, status: 'completed' }
          });
        }
      } else if (currentBalance > 0 && unpaidPurchases.length > 0) {
        // Distribute the balance across unpaid purchases (latest first)
        let remainingBalance = currentBalance;
        
        // Sort by date descending (most recent first)
        unpaidPurchases.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        console.log(`  Action: Distributing Rs ${currentBalance.toLocaleString()} across purchases`);
        
        for (const p of unpaidPurchases) {
          const purchaseTotal = Number(p.total);
          
          if (remainingBalance >= purchaseTotal) {
            // This purchase still has full balance due
            await prisma.purchase.update({
              where: { id: p.id },
              data: { paid: 0, due: purchaseTotal }
            });
            remainingBalance -= purchaseTotal;
            console.log(`    ${p.invoiceNo}: Due Rs ${purchaseTotal.toLocaleString()}`);
          } else if (remainingBalance > 0) {
            // Partial payment
            await prisma.purchase.update({
              where: { id: p.id },
              data: { 
                paid: purchaseTotal - remainingBalance, 
                due: remainingBalance 
              }
            });
            console.log(`    ${p.invoiceNo}: Due Rs ${remainingBalance.toLocaleString()} (partial)`);
            remainingBalance = 0;
          } else {
            // Fully paid
            await prisma.purchase.update({
              where: { id: p.id },
              data: { paid: purchaseTotal, due: 0, status: 'completed' }
            });
          }
        }
      }
      console.log();
    }
  }
  
  // Verification
  console.log('=== FINAL VERIFICATION ===\n');
  
  const purchaseStats = await prisma.purchase.aggregate({
    where: { isReturn: false },
    _sum: { total: true, paid: true, due: true },
    _count: true
  });
  
  const supplierStats = await prisma.supplier.aggregate({
    _sum: { balance: true }
  });
  
  console.log('Purchases (excluding returns):');
  console.log('  Count:', purchaseStats._count);
  console.log('  Total Amount:', Number(purchaseStats._sum.total || 0).toLocaleString());
  console.log('  Total Paid:', Number(purchaseStats._sum.paid || 0).toLocaleString());
  console.log('  Total Due:', Number(purchaseStats._sum.due || 0).toLocaleString());
  
  console.log('\nSuppliers:');
  console.log('  Total Balance:', Number(supplierStats._sum.balance || 0).toLocaleString());
  
  const diff = Number(purchaseStats._sum.due || 0) - Number(supplierStats._sum.balance || 0);
  
  if (Math.abs(diff) < 1) {
    console.log('\n✅ SUCCESS! Purchase Due matches Supplier Balance!');
  } else {
    console.log('\n⚠️  Difference:', diff.toLocaleString());
  }
  
  await prisma.$disconnect();
}

finalFix().catch(console.error);
