const mysql = require('mysql2/promise');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSupplierBalances() {
  console.log('=== FIXING SUPPLIER BALANCES FROM OLD LEDGER DATA ===\n');
  
  // Connect to MySQL
  const mysqlConn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 8889,
    user: 'root',
    password: 'root',
    database: 'punar'
  });
  
  // Get supplier ledger balances from old system
  const [oldBalances] = await mysqlConn.execute(`
    SELECT 
      s.id, 
      s.name,
      COALESCE((
        SELECT SUM(CASE WHEN type = 2 THEN amount ELSE -amount END) 
        FROM supplier_ledgers 
        WHERE supplier_id = s.id
      ), 0) as ledger_balance
    FROM suppliers s
  `);
  
  console.log('Old System Ledger Balances:');
  oldBalances.forEach(s => {
    if (Number(s.ledger_balance) !== 0) {
      console.log(`  ${s.name}: Rs ${Number(s.ledger_balance).toLocaleString()}`);
    }
  });
  
  // Get all suppliers from new POS
  const newSuppliers = await prisma.supplier.findMany();
  
  console.log('\n\nUpdating New POS Supplier Balances...\n');
  
  let updated = 0;
  for (const oldSupplier of oldBalances) {
    const newSupplier = newSuppliers.find(s => 
      s.name.toLowerCase().trim() === oldSupplier.name.toLowerCase().trim()
    );
    
    if (newSupplier) {
      const correctBalance = Number(oldSupplier.ledger_balance) || 0;
      const currentBalance = Number(newSupplier.balance) || 0;
      
      if (Math.abs(correctBalance - currentBalance) > 0.01) {
        console.log(`  ${newSupplier.name}:`);
        console.log(`    Current: Rs ${currentBalance.toLocaleString()}`);
        console.log(`    Correct: Rs ${correctBalance.toLocaleString()}`);
        
        await prisma.supplier.update({
          where: { id: newSupplier.id },
          data: { balance: correctBalance }
        });
        updated++;
      }
    }
  }
  
  console.log(`\nUpdated ${updated} supplier balance(s)`);
  
  // Also fix purchase records - mark as paid if balance is 0
  console.log('\n\nAdjusting Purchase Due Amounts...\n');
  
  // For suppliers with 0 balance, their unpaid purchases should actually be marked as paid
  for (const oldSupplier of oldBalances) {
    if (Number(oldSupplier.ledger_balance) === 0) {
      const newSupplier = newSuppliers.find(s => 
        s.name.toLowerCase().trim() === oldSupplier.name.toLowerCase().trim()
      );
      
      if (newSupplier) {
        // Get unpaid purchases for this supplier
        const unpaidPurchases = await prisma.purchase.findMany({
          where: {
            supplierId: newSupplier.id,
            due: { gt: 0 },
            isReturn: false
          }
        });
        
        if (unpaidPurchases.length > 0) {
          console.log(`  ${newSupplier.name}: Marking ${unpaidPurchases.length} purchase(s) as paid`);
          
          for (const purchase of unpaidPurchases) {
            await prisma.purchase.update({
              where: { id: purchase.id },
              data: {
                paid: purchase.total,
                due: 0,
                status: 'completed'
              }
            });
          }
        }
      }
    }
  }
  
  // Final verification
  console.log('\n\n=== FINAL VERIFICATION ===');
  
  const totalPurchaseDue = await prisma.purchase.aggregate({
    where: { isReturn: false },
    _sum: { due: true, total: true, paid: true }
  });
  
  const totalSupplierBalance = await prisma.supplier.aggregate({
    _sum: { balance: true }
  });
  
  console.log('\nPurchases:');
  console.log('  Total Amount:', Number(totalPurchaseDue._sum.total || 0).toLocaleString());
  console.log('  Total Paid:', Number(totalPurchaseDue._sum.paid || 0).toLocaleString());
  console.log('  Total Due:', Number(totalPurchaseDue._sum.due || 0).toLocaleString());
  
  console.log('\nSuppliers:');
  console.log('  Total Balance:', Number(totalSupplierBalance._sum.balance || 0).toLocaleString());
  
  const diff = Number(totalPurchaseDue._sum.due || 0) - Number(totalSupplierBalance._sum.balance || 0);
  console.log('\nDifference:', diff.toLocaleString());
  
  if (Math.abs(diff) < 1) {
    console.log('✅ Purchase Due = Supplier Balance - SUCCESS!');
  }
  
  await mysqlConn.end();
  await prisma.$disconnect();
}

fixSupplierBalances().catch(console.error);
