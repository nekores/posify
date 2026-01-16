const { PrismaClient } = require('@prisma/client');
const mysql = require('mysql2/promise');

const prisma = new PrismaClient();

async function importPurchaseItems() {
  console.log('Importing Purchase Items...\n');
  
  const mysqlConn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 8889,
    user: 'root',
    password: 'root',
    database: 'punar',
  });

  // Get MySQL products with their IDs
  const [mysqlProducts] = await mysqlConn.execute('SELECT id, name FROM products');
  console.log(`MySQL products: ${mysqlProducts.length}`);
  
  // Get PostgreSQL products
  const pgProducts = await prisma.product.findMany({ select: { id: true, name: true } });
  console.log(`PostgreSQL products: ${pgProducts.length}`);
  
  // Create name -> PG ID map
  const productNameToId = {};
  for (const p of pgProducts) {
    productNameToId[p.name.toLowerCase().trim()] = p.id;
  }
  
  // Create MySQL ID -> PG ID map
  const mysqlIdToPgId = {};
  let matched = 0;
  for (const mp of mysqlProducts) {
    const pgId = productNameToId[mp.name.toLowerCase().trim()];
    if (pgId) {
      mysqlIdToPgId[mp.id] = pgId;
      matched++;
    }
  }
  console.log(`Products matched by name: ${matched}`);

  // Get purchases map - need to match MySQL purchase ID to PG purchase ID
  // We'll match by invoice_no
  const [mysqlPurchases] = await mysqlConn.execute('SELECT id, invoice_no FROM purchases');
  const pgPurchases = await prisma.purchase.findMany({ select: { id: true, invoiceNo: true } });
  
  const purchaseInvoiceToId = {};
  for (const p of pgPurchases) {
    purchaseInvoiceToId[p.invoiceNo] = p.id;
  }
  
  const mysqlPurchaseIdToPgId = {};
  for (const mp of mysqlPurchases) {
    const invoiceNo = mp.invoice_no || `PUR-${mp.id}`;
    const pgId = purchaseInvoiceToId[invoiceNo];
    if (pgId) {
      mysqlPurchaseIdToPgId[mp.id] = pgId;
    }
  }
  console.log(`Purchases matched: ${Object.keys(mysqlPurchaseIdToPgId).length}`);

  // Get purchase items
  const [purchaseItems] = await mysqlConn.execute('SELECT * FROM purchase_items');
  console.log(`Purchase items to import: ${purchaseItems.length}`);

  // Clear existing purchase items
  await prisma.purchaseItem.deleteMany({});
  console.log('Cleared existing purchase items');

  // Import items
  let imported = 0;
  let skipped = 0;
  
  for (const item of purchaseItems) {
    const purchaseId = mysqlPurchaseIdToPgId[item.purchase_id];
    const productId = mysqlIdToPgId[item.product_id];
    
    if (!purchaseId || !productId) {
      skipped++;
      continue;
    }
    
    try {
      await prisma.purchaseItem.create({
        data: {
          purchaseId,
          productId,
          quantity: item.quantity || 1,
          unitPrice: item.unit_cost || 0,
          discount: item.discount || 0,
          tax: 0,
          total: item.total || 0,
          isReturn: false,
        },
      });
      imported++;
    } catch (err) {
      console.log(`Error: ${err.message}`);
      skipped++;
    }
  }
  
  console.log(`\n✅ Imported ${imported} purchase items`);
  console.log(`⚠️ Skipped ${skipped} items (missing product/purchase match)`);

  await mysqlConn.end();
  await prisma.$disconnect();
}

importPurchaseItems().catch(console.error);

