const { Client } = require('pg');
const mysql = require('mysql2/promise');

async function migrateLedger() {
  // Connect to MySQL (old database)
  const mysqlConn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 8889,
    user: 'root',
    password: 'root',
    database: 'punar'
  });

  // Connect to PostgreSQL (new database)
  const pgClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'sarupaa_pos'
  });
  await pgClient.connect();

  try {
    // Get customer ID mapping (old_id -> new_id based on name match)
    const [oldCustomers] = await mysqlConn.execute('SELECT id, name FROM customers');
    const pgCustomers = await pgClient.query('SELECT id, name FROM customers');
    
    const customerMap = new Map();
    for (const oldCust of oldCustomers) {
      const match = pgCustomers.rows.find(c => 
        c.name.toLowerCase().trim() === oldCust.name.toLowerCase().trim()
      );
      if (match) {
        customerMap.set(oldCust.id, match.id);
      }
    }
    console.log(`Mapped ${customerMap.size} customers`);

    // Get sale ID mapping (old invoice_no -> new sale_id)
    const [oldSales] = await mysqlConn.execute('SELECT id, bill_no FROM sales');
    const pgSales = await pgClient.query('SELECT id, invoice_no FROM sales');
    
    const saleMap = new Map();
    for (const oldSale of oldSales) {
      const match = pgSales.rows.find(s => s.invoice_no === oldSale.bill_no);
      if (match) {
        saleMap.set(oldSale.bill_no, match.id);
      }
    }
    console.log(`Mapped ${saleMap.size} sales`);

    // Get old ledger entries
    const [oldLedger] = await mysqlConn.execute(`
      SELECT id, customer_id, amount, type, bill_no, date, comments 
      FROM customer_ledgers 
      ORDER BY date
    `);
    console.log(`Found ${oldLedger.length} ledger entries to migrate`);

    // Insert ledger entries
    let inserted = 0;
    let skipped = 0;
    
    for (const entry of oldLedger) {
      const newCustomerId = customerMap.get(entry.customer_id);
      if (!newCustomerId) {
        skipped++;
        continue;
      }

      const saleId = saleMap.get(entry.bill_no) || null;
      const amount = parseFloat(entry.amount) || 0;
      
      // type 1 = Sale (debit), type 2 = Collection (credit)
      const debit = entry.type === 1 ? amount : 0;
      const credit = entry.type === 2 ? amount : 0;
      
      // Description based on type
      let description = entry.comments || '';
      if (!description) {
        description = entry.type === 1 ? `Sale ${entry.bill_no}` : `Collection ${entry.bill_no}`;
      }

      await pgClient.query(`
        INSERT INTO customer_ledgers (id, customer_id, sale_id, debit, credit, balance, description, date, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, $5, $6, NOW())
      `, [newCustomerId, saleId, debit, credit, description, entry.date]);
      
      inserted++;
    }

    console.log(`Inserted ${inserted} ledger entries, skipped ${skipped}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mysqlConn.end();
    await pgClient.end();
  }
}

migrateLedger();

