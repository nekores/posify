const { PrismaClient } = require('@prisma/client');
const mysql = require('mysql2/promise');

const prisma = new PrismaClient();

async function importAll() {
  console.log('='.repeat(60));
  console.log('IMPORTING SUPPLIERS, PURCHASES & PAYMENTS');
  console.log('='.repeat(60));
  
  const mysqlConn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 8889,
    user: 'root',
    password: 'root',
    database: 'punar',
  });

  console.log('\n✓ Connected to MySQL');

  // ============ STEP 1: Get all data from MySQL ============
  console.log('\n[1/6] Fetching data from MySQL...');
  
  const [suppliers] = await mysqlConn.execute('SELECT * FROM suppliers ORDER BY id');
  const [purchases] = await mysqlConn.execute('SELECT * FROM purchases ORDER BY id');
  const [purchaseItems] = await mysqlConn.execute('SELECT * FROM purchase_items ORDER BY id');
  const [supplierPayments] = await mysqlConn.execute('SELECT * FROM supplier_payments ORDER BY id');
  const [products] = await mysqlConn.execute('SELECT id, name FROM products');
  
  console.log(`   - Suppliers: ${suppliers.length}`);
  console.log(`   - Purchases: ${purchases.length}`);
  console.log(`   - Purchase Items: ${purchaseItems.length}`);
  console.log(`   - Supplier Payments: ${supplierPayments.length}`);

  // Create product ID mapping (old MySQL id -> new Prisma id)
  const [newProducts] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true } })
  ]);
  
  // Map by name (case insensitive)
  const productMap = {};
  for (const prod of newProducts) {
    productMap[prod.name.toLowerCase().trim()] = prod.id;
  }

  // ============ STEP 2: Clear existing data ============
  console.log('\n[2/6] Clearing existing data in PostgreSQL...');
  
  await prisma.purchaseItem.deleteMany({});
  await prisma.supplierPayment.deleteMany({});
  await prisma.supplierLedger.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.supplier.deleteMany({});
  
  console.log('   ✓ Cleared purchases, payments, ledgers, suppliers');

  // ============ STEP 3: Import Suppliers ============
  console.log('\n[3/6] Importing suppliers...');
  
  const supplierMap = {}; // old MySQL id -> new Prisma id
  
  for (const s of suppliers) {
    const newSupplier = await prisma.supplier.create({
      data: {
        name: s.name || 'Unknown',
        email: s.email || null,
        phone: s.phone_no || s.mobile_no || null,
        address: s.address || null,
        balance: 0, // Will calculate later
        isActive: s.status === 1,
      },
    });
    supplierMap[s.id] = newSupplier.id;
  }
  
  console.log(`   ✓ Imported ${suppliers.length} suppliers`);

  // ============ STEP 4: Import Purchases ============
  console.log('\n[4/6] Importing purchases...');
  
  const purchaseMap = {}; // old MySQL id -> new Prisma id
  let purchasesImported = 0;
  let purchasesSkipped = 0;
  
  for (const p of purchases) {
    const supplierId = supplierMap[p.supplier_id];
    
    if (!supplierId) {
      console.log(`   ⚠ Skipping purchase ${p.id}: Supplier ${p.supplier_id} not found`);
      purchasesSkipped++;
      continue;
    }
    
    try {
      const newPurchase = await prisma.purchase.create({
        data: {
          supplierId: supplierId,
          invoiceNo: p.invoice_no || `PUR-${p.id}`,
          date: p.date ? new Date(p.date) : new Date(),
          subtotal: p.net_total || p.grand_total || 0,
          discount: p.discount || 0,
          tax: 0,
          total: p.grand_total || 0,
          paid: 0, // Will update with payments
          status: p.status === 1 ? 'completed' : 'pending',
          notes: p.comments || null,
          isReturn: p.is_return === 1,
        },
      });
      purchaseMap[p.id] = newPurchase.id;
      purchasesImported++;
    } catch (err) {
      console.log(`   ⚠ Error importing purchase ${p.id}: ${err.message}`);
      purchasesSkipped++;
    }
  }
  
  console.log(`   ✓ Imported ${purchasesImported} purchases (${purchasesSkipped} skipped)`);

  // ============ STEP 5: Import Purchase Items ============
  console.log('\n[5/6] Importing purchase items...');
  
  let itemsImported = 0;
  let itemsSkipped = 0;
  
  // Get old product data for mapping
  const [oldProducts] = await mysqlConn.execute('SELECT id, name FROM products');
  const oldProductNames = {};
  for (const op of oldProducts) {
    oldProductNames[op.id] = op.name;
  }
  
  for (const item of purchaseItems) {
    const purchaseId = purchaseMap[item.purchase_id];
    
    if (!purchaseId) {
      itemsSkipped++;
      continue;
    }
    
    // Find product by name
    const oldProductName = oldProductNames[item.product_id];
    const productId = oldProductName ? productMap[oldProductName.toLowerCase().trim()] : null;
    
    if (!productId) {
      // Skip items without matching product
      itemsSkipped++;
      continue;
    }
    
    try {
      await prisma.purchaseItem.create({
        data: {
          purchaseId: purchaseId,
          productId: productId,
          quantity: item.quantity || 0,
          unitCost: item.unit_cost || 0,
          discount: item.discount || 0,
          total: item.total || 0,
        },
      });
      itemsImported++;
    } catch (err) {
      itemsSkipped++;
    }
  }
  
  console.log(`   ✓ Imported ${itemsImported} items (${itemsSkipped} skipped - products not found)`);

  // ============ STEP 6: Calculate Supplier Balances ============
  console.log('\n[6/6] Calculating supplier balances...');
  
  // Calculate total purchases per supplier
  const purchaseTotals = {};
  for (const p of purchases) {
    if (!purchaseTotals[p.supplier_id]) {
      purchaseTotals[p.supplier_id] = 0;
    }
    purchaseTotals[p.supplier_id] += (p.grand_total || 0);
  }
  
  // Calculate total payments per supplier
  const paymentTotals = {};
  for (const pay of supplierPayments) {
    if (!paymentTotals[pay.supplier_id]) {
      paymentTotals[pay.supplier_id] = 0;
    }
    paymentTotals[pay.supplier_id] += parseFloat(pay.amount || 0);
  }
  
  // Update supplier balances
  for (const s of suppliers) {
    const totalPurchases = purchaseTotals[s.id] || 0;
    const totalPaid = paymentTotals[s.id] || 0;
    const balance = totalPurchases - totalPaid;
    
    const newSupplierId = supplierMap[s.id];
    if (newSupplierId) {
      await prisma.supplier.update({
        where: { id: newSupplierId },
        data: { balance: balance },
      });
    }
  }
  
  console.log('   ✓ Updated supplier balances');

  // ============ Summary ============
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(60));
  
  // Get final counts
  const finalSuppliers = await prisma.supplier.findMany({
    include: { _count: { select: { purchases: true } } },
    orderBy: { balance: 'desc' },
  });
  
  let totalBalance = 0;
  console.log('\nTop 10 Suppliers by Balance:');
  console.log('-'.repeat(60));
  
  for (let i = 0; i < Math.min(10, finalSuppliers.length); i++) {
    const s = finalSuppliers[i];
    const bal = Number(s.balance);
    totalBalance += bal;
    console.log(`${(i+1).toString().padStart(2)}. ${s.name.padEnd(30)} Purchases: ${s._count.purchases.toString().padStart(3)} | Balance: Rs ${bal.toLocaleString()}`);
  }
  
  console.log('-'.repeat(60));
  console.log(`Total Payable to Suppliers: Rs ${totalBalance.toLocaleString()}`);
  console.log('='.repeat(60));

  await mysqlConn.end();
  await prisma.$disconnect();
  
  console.log('\n✅ Import completed successfully!\n');
}

importAll().catch(console.error);

