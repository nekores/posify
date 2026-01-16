const { PrismaClient } = require('@prisma/client');
const mysql = require('mysql2/promise');

const prisma = new PrismaClient();

async function importSuppliers() {
  console.log('Connecting to MySQL...');
  
  const mysqlConn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 8889,
    user: 'root',
    password: 'root',
    database: 'punar',
  });

  console.log('Connected to MySQL. Fetching suppliers...');

  // Get all suppliers from MySQL
  const [suppliers] = await mysqlConn.execute(`
    SELECT id, name, email, phone_no, mobile_no, address, credit_limit, opening_balance, status 
    FROM suppliers
  `);

  console.log(`Found ${suppliers.length} suppliers in MySQL`);

  // Get supplier balances from ledger
  const [balances] = await mysqlConn.execute(`
    SELECT 
      supplier_id, 
      SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) as debits,
      SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) as credits
    FROM supplier_ledgers 
    GROUP BY supplier_id
  `);

  const balanceMap = {};
  balances.forEach(b => {
    // Balance = credits - debits (what we owe them)
    balanceMap[b.supplier_id] = (b.credits || 0) - (b.debits || 0);
  });

  console.log('Clearing existing suppliers in PostgreSQL...');
  
  // Clear existing suppliers
  await prisma.supplierPayment.deleteMany({});
  await prisma.supplierLedger.deleteMany({});
  await prisma.supplier.deleteMany({});

  console.log('Importing suppliers...');

  let imported = 0;
  for (const supplier of suppliers) {
    try {
      const balance = balanceMap[supplier.id] || 0;
      
      await prisma.supplier.create({
        data: {
          name: supplier.name || 'Unknown Supplier',
          email: supplier.email || null,
          phone: supplier.phone_no || supplier.mobile_no || null,
          address: supplier.address || null,
          balance: balance,
          isActive: supplier.status === 1,
        },
      });
      
      imported++;
      console.log(`  ✓ Imported: ${supplier.name} (Balance: Rs. ${balance})`);
    } catch (error) {
      console.error(`  ✗ Failed to import ${supplier.name}:`, error.message);
    }
  }

  console.log(`\n✅ Successfully imported ${imported}/${suppliers.length} suppliers`);

  await mysqlConn.end();
  await prisma.$disconnect();
}

importSuppliers().catch(console.error);

