const { PrismaClient } = require('@prisma/client');
const mysql = require('mysql2/promise');

const prisma = new PrismaClient();

async function fixPurchaseReturns() {
  console.log('='.repeat(60));
  console.log('FIXING PURCHASES WITH RETURNS & CORRECT BALANCES');
  console.log('='.repeat(60));
  
  const mysqlConn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 8889,
    user: 'root',
    password: 'root',
    database: 'punar',
  });

  // Get all purchases from MySQL
  const [mysqlPurchases] = await mysqlConn.execute(`
    SELECT id, supplier_id, invoice_no, grand_total, status, is_return
    FROM purchases
  `);
  
  console.log(`\nAnalyzing ${mysqlPurchases.length} purchases...`);
  
  // Count by type
  const regular = mysqlPurchases.filter(p => !p.is_return || p.is_return === 0);
  const returns = mysqlPurchases.filter(p => p.is_return === 1);
  
  console.log(`  - Regular purchases: ${regular.length}`);
  console.log(`  - Purchase returns: ${returns.length}`);

  // Get PostgreSQL purchases
  const pgPurchases = await prisma.purchase.findMany({
    select: { id: true, invoiceNo: true, total: true }
  });
  
  // Create invoice -> PG purchase map
  const invoiceToId = {};
  for (const p of pgPurchases) {
    invoiceToId[p.invoiceNo] = { id: p.id, total: Number(p.total) };
  }

  console.log(`\nUpdating purchases with correct paid/return status...`);
  
  let updated = 0;
  for (const mp of mysqlPurchases) {
    const invoiceNo = mp.invoice_no || `PUR-${mp.id}`;
    const pgPurchase = invoiceToId[invoiceNo];
    
    if (!pgPurchase) continue;
    
    const isPaid = mp.status === 1;
    const isReturn = mp.is_return === 1;
    const paidAmount = isPaid ? pgPurchase.total : 0;
    
    await prisma.purchase.update({
      where: { id: pgPurchase.id },
      data: { 
        paid: paidAmount,
        status: isPaid ? 'completed' : 'pending',
        isReturn: isReturn,
      },
    });
    updated++;
  }
  
  console.log(`  ✓ Updated ${updated} purchases`);

  // Now recalculate supplier balances correctly
  // Balance = Unpaid Purchases - Unpaid Returns
  console.log(`\nRecalculating supplier balances (with returns)...`);
  
  const suppliers = await prisma.supplier.findMany({
    include: {
      purchases: {
        select: { total: true, paid: true, isReturn: true }
      }
    }
  });
  
  for (const supplier of suppliers) {
    let unpaidPurchases = 0;
    let unpaidReturns = 0;
    
    for (const p of supplier.purchases) {
      const total = Number(p.total);
      const paid = Number(p.paid);
      const unpaid = total - paid;
      
      if (p.isReturn) {
        // Returns reduce what we owe
        unpaidReturns += unpaid;
      } else {
        // Regular purchases add to what we owe
        unpaidPurchases += unpaid;
      }
    }
    
    // Balance = what we owe - returns (credits)
    const balance = unpaidPurchases - unpaidReturns;
    
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { balance: balance }
    });
  }
  
  console.log(`  ✓ Updated ${suppliers.length} supplier balances`);

  // Show summary
  console.log('\n' + '='.repeat(60));
  console.log('CORRECTED SUPPLIER BALANCES (WITH RETURNS)');
  console.log('='.repeat(60));
  
  const finalSuppliers = await prisma.supplier.findMany({
    where: { balance: { not: 0 } },
    include: {
      purchases: {
        select: { total: true, paid: true, isReturn: true }
      }
    },
    orderBy: { balance: 'desc' }
  });
  
  if (finalSuppliers.length === 0) {
    console.log('\n✅ All suppliers have 0 balance (all paid!)');
  } else {
    console.log('\nSuppliers with Outstanding Balance:');
    console.log('-'.repeat(60));
    
    let totalPayable = 0;
    for (const s of finalSuppliers) {
      const bal = Number(s.balance);
      totalPayable += bal;
      
      // Calculate breakdown
      let unpaidPurch = 0, unpaidRet = 0;
      for (const p of s.purchases) {
        const unpaid = Number(p.total) - Number(p.paid);
        if (p.isReturn) unpaidRet += unpaid;
        else unpaidPurch += unpaid;
      }
      
      console.log(`${s.name.padEnd(30)} Balance: Rs ${bal.toLocaleString().padStart(10)} (Unpaid: ${unpaidPurch.toLocaleString()}, Returns: ${unpaidRet.toLocaleString()})`);
    }
    
    console.log('-'.repeat(60));
    console.log(`Total Payable: Rs ${totalPayable.toLocaleString()}`);
  }
  
  console.log('='.repeat(60));

  await mysqlConn.end();
  await prisma.$disconnect();
  
  console.log('\n✅ Fix completed!\n');
}

fixPurchaseReturns().catch(console.error);

