const { PrismaClient } = require('@prisma/client');
const mysql = require('mysql2/promise');

const prisma = new PrismaClient();

async function fixPurchaseStatus() {
  console.log('='.repeat(60));
  console.log('FIXING PURCHASE PAID STATUS & SUPPLIER BALANCES');
  console.log('='.repeat(60));
  
  const mysqlConn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 8889,
    user: 'root',
    password: 'root',
    database: 'punar',
  });

  // Get all purchases from MySQL with their status
  const [mysqlPurchases] = await mysqlConn.execute(`
    SELECT id, supplier_id, invoice_no, grand_total, status 
    FROM purchases
  `);
  
  console.log(`\nMySQL Purchases: ${mysqlPurchases.length}`);
  
  // Count paid vs unpaid
  const paidCount = mysqlPurchases.filter(p => p.status === 1).length;
  const unpaidCount = mysqlPurchases.filter(p => p.status === 0).length;
  console.log(`  - Paid (status=1): ${paidCount}`);
  console.log(`  - Unpaid (status=0): ${unpaidCount}`);

  // Get PostgreSQL purchases
  const pgPurchases = await prisma.purchase.findMany({
    select: { id: true, invoiceNo: true, total: true }
  });
  
  // Create invoice -> PG purchase map
  const invoiceToId = {};
  for (const p of pgPurchases) {
    invoiceToId[p.invoiceNo] = { id: p.id, total: Number(p.total) };
  }

  console.log(`\nUpdating purchase paid amounts...`);
  
  let updated = 0;
  for (const mp of mysqlPurchases) {
    const invoiceNo = mp.invoice_no || `PUR-${mp.id}`;
    const pgPurchase = invoiceToId[invoiceNo];
    
    if (!pgPurchase) continue;
    
    // status = 1 means PAID, status = 0 means UNPAID
    const isPaid = mp.status === 1;
    const paidAmount = isPaid ? pgPurchase.total : 0;
    const status = isPaid ? 'completed' : 'pending';
    
    await prisma.purchase.update({
      where: { id: pgPurchase.id },
      data: { 
        paid: paidAmount,
        status: status,
      },
    });
    updated++;
  }
  
  console.log(`  ✓ Updated ${updated} purchases`);

  // Now recalculate supplier balances
  console.log(`\nRecalculating supplier balances...`);
  
  // Get all suppliers
  const suppliers = await prisma.supplier.findMany({
    include: {
      purchases: {
        select: { total: true, paid: true }
      }
    }
  });
  
  for (const supplier of suppliers) {
    // Balance = total unpaid purchases
    const totalPurchases = supplier.purchases.reduce((sum, p) => sum + Number(p.total), 0);
    const totalPaid = supplier.purchases.reduce((sum, p) => sum + Number(p.paid), 0);
    const balance = totalPurchases - totalPaid;
    
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { balance: balance }
    });
  }
  
  console.log(`  ✓ Updated ${suppliers.length} supplier balances`);

  // Show summary
  console.log('\n' + '='.repeat(60));
  console.log('CORRECTED SUPPLIER BALANCES');
  console.log('='.repeat(60));
  
  const finalSuppliers = await prisma.supplier.findMany({
    where: { balance: { not: 0 } },
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
      console.log(`${s.name.padEnd(35)} Rs ${bal.toLocaleString()}`);
    }
    
    console.log('-'.repeat(60));
    console.log(`Total Payable: Rs ${totalPayable.toLocaleString()}`);
  }
  
  console.log('='.repeat(60));

  await mysqlConn.end();
  await prisma.$disconnect();
  
  console.log('\n✅ Fix completed!\n');
}

fixPurchaseStatus().catch(console.error);

