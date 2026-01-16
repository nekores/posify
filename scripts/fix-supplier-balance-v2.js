const { PrismaClient } = require('@prisma/client');
const mysql = require('mysql2/promise');

const prisma = new PrismaClient();

async function fixSupplierBalances() {
  console.log('='.repeat(60));
  console.log('FIXING SUPPLIER BALANCES FROM PURCHASES (STATUS=0)');
  console.log('='.repeat(60));
  
  const mysqlConn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 8889,
    user: 'root',
    password: 'root',
    database: 'punar',
  });

  // Calculate balance from UNPAID purchases (status=0)
  // Balance = Unpaid regular purchases - Unpaid returns
  const [balances] = await mysqlConn.execute(`
    SELECT 
      s.id,
      s.name,
      COALESCE(SUM(CASE 
        WHEN p.status = 0 AND (p.is_return IS NULL OR p.is_return = 0) 
        THEN p.grand_total ELSE 0 END), 0) as unpaid_purchases,
      COALESCE(SUM(CASE 
        WHEN p.status = 0 AND p.is_return = 1 
        THEN p.grand_total ELSE 0 END), 0) as unpaid_returns,
      COALESCE(SUM(CASE 
        WHEN p.status = 0 AND (p.is_return IS NULL OR p.is_return = 0) 
        THEN p.grand_total ELSE 0 END), 0) -
      COALESCE(SUM(CASE 
        WHEN p.status = 0 AND p.is_return = 1 
        THEN p.grand_total ELSE 0 END), 0) as balance
    FROM suppliers s
    LEFT JOIN purchases p ON p.supplier_id = s.id
    GROUP BY s.id, s.name
    ORDER BY balance DESC
  `);
  
  console.log('\nBalances from old system (unpaid purchases):');
  console.log('-'.repeat(70));
  
  let totalPayable = 0;
  const balanceMap = {};
  
  for (const b of balances) {
    balanceMap[b.name.toLowerCase().trim()] = Number(b.balance);
    if (b.balance != 0) {
      console.log(`${b.name.padEnd(30)} Unpaid: ${Number(b.unpaid_purchases).toLocaleString().padStart(10)} Returns: ${Number(b.unpaid_returns).toLocaleString().padStart(10)} Balance: ${Number(b.balance).toLocaleString().padStart(10)}`);
      totalPayable += Number(b.balance);
    }
  }
  
  console.log('-'.repeat(70));
  console.log(`Total Payable: Rs ${totalPayable.toLocaleString()}`);
  
  // Now update PostgreSQL suppliers
  console.log('\nUpdating PostgreSQL supplier balances...');
  
  const pgSuppliers = await prisma.supplier.findMany();
  
  let updated = 0;
  for (const s of pgSuppliers) {
    const correctBalance = balanceMap[s.name.toLowerCase().trim()] || 0;
    
    await prisma.supplier.update({
      where: { id: s.id },
      data: { balance: correctBalance }
    });
    updated++;
  }
  
  console.log(`✓ Updated ${updated} suppliers`);
  
  // Also fix the purchase paid/due based on status
  console.log('\nFixing purchase paid/due status...');
  
  const [mysqlPurchases] = await mysqlConn.execute(`
    SELECT id, invoice_no, grand_total, status, is_return
    FROM purchases
  `);
  
  const pgPurchases = await prisma.purchase.findMany({
    select: { id: true, invoiceNo: true, total: true }
  });
  
  const invoiceToId = {};
  for (const p of pgPurchases) {
    invoiceToId[p.invoiceNo] = { id: p.id, total: Number(p.total) };
  }
  
  let purchasesUpdated = 0;
  for (const mp of mysqlPurchases) {
    const invoiceNo = mp.invoice_no || `PUR-${mp.id}`;
    const pgPurchase = invoiceToId[invoiceNo];
    
    if (!pgPurchase) continue;
    
    const isPaid = mp.status === 1;
    const paidAmount = isPaid ? pgPurchase.total : 0;
    const dueAmount = isPaid ? 0 : pgPurchase.total;
    
    await prisma.purchase.update({
      where: { id: pgPurchase.id },
      data: { 
        paid: paidAmount,
        due: dueAmount,
        status: isPaid ? 'completed' : 'pending',
        isReturn: mp.is_return === 1,
      },
    });
    purchasesUpdated++;
  }
  
  console.log(`✓ Updated ${purchasesUpdated} purchases`);

  // Verify final state
  console.log('\n' + '='.repeat(60));
  console.log('FINAL SUPPLIER BALANCES');
  console.log('='.repeat(60));
  
  const finalSuppliers = await prisma.supplier.findMany({
    where: { balance: { not: 0 } },
    orderBy: { balance: 'desc' }
  });
  
  let finalTotal = 0;
  for (const s of finalSuppliers) {
    const bal = Number(s.balance);
    finalTotal += bal;
    console.log(`${s.name.padEnd(35)} Rs ${bal.toLocaleString()}`);
  }
  console.log('-'.repeat(60));
  console.log(`Total Payable: Rs ${finalTotal.toLocaleString()}`);
  console.log('='.repeat(60));

  await mysqlConn.end();
  await prisma.$disconnect();
  
  console.log('\n✅ Fix completed!\n');
}

fixSupplierBalances().catch(console.error);

