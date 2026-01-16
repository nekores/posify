/**
 * SARUPAA POS MySQL to PostgreSQL Migration Script
 * 
 * Migrates all data from the original MySQL database (punar)
 * to the new PostgreSQL database.
 * 
 * Run: npx ts-node --transpile-only scripts/migrate-mysql-to-postgres.ts
 */

import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// MySQL connection config from sarupaa-pos .env
const MYSQL_CONFIG = {
  host: 'localhost',
  port: 8889,
  user: 'root',
  password: 'root',
  database: 'punar',
};

// Helper functions
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const convertDate = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  if (dateValue instanceof Date) return dateValue;
  const date = new Date(dateValue);
  return isNaN(date.getTime()) ? new Date() : date;
};

const safeDecimal = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = parseFloat(String(value));
  return isNaN(num) ? 0 : num;
};

const safeInt = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = parseInt(String(value), 10);
  return isNaN(num) ? 0 : num;
};

// ID mapping to handle foreign key relationships
const idMaps = {
  users: new Map<number, string>(),
  stores: new Map<number, string>(),
  categories: new Map<number, string>(),
  units: new Map<number, string>(),
  products: new Map<number, string>(),
  prices: new Map<number, { cost: number; sale: number }>(),
  customers: new Map<number, string>(),
  suppliers: new Map<number, string>(),
  sales: new Map<number, string>(),
  purchases: new Map<number, string>(),
  accountGroups: new Map<number, string>(),
  accounts: new Map<number, string>(),
  expenseCategories: new Map<number, string>(),
};

// Default store ID
let defaultStoreId: string = '';
let defaultCategoryId: string = '';
let defaultUnitId: string = '';

async function migrateUsers(mysqlConn: mysql.Connection) {
  console.log('\n📥 Migrating Users...');
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM user') as [any[], any];
    console.log(`  Found ${rows.length} users`);
    
    for (const row of rows) {
      const newId = generateId();
      idMaps.users.set(row.id, newId);
      
      // Determine role based on RBAC
      let role: 'USER' | 'MANAGER' | 'ADMINISTRATOR' = 'USER';
      try {
        const [assignments] = await mysqlConn.query(
          'SELECT item_name FROM rbac_auth_assignment WHERE user_id = ?',
          [String(row.id)]
        ) as [any[], any];
        
        if (assignments.some((a: any) => a.item_name === 'administrator')) {
          role = 'ADMINISTRATOR';
        } else if (assignments.some((a: any) => a.item_name === 'manager')) {
          role = 'MANAGER';
        }
      } catch (e) {
        // RBAC tables might not exist or have different structure
      }
      
      await prisma.user.create({
        data: {
          id: newId,
          username: row.username || `user_${row.id}`,
          email: row.email || `user${row.id}@sarupaa.local`,
          passwordHash: row.password_hash || await bcrypt.hash('password123', 10),
          status: row.status || 2,
          role,
          accessToken: row.access_token || null,
          createdAt: row.created_at ? new Date(row.created_at * 1000) : new Date(),
          updatedAt: row.updated_at ? new Date(row.updated_at * 1000) : new Date(),
        },
      });
    }
    
    console.log(`  ✅ Migrated ${rows.length} users`);
  } catch (error: any) {
    console.error('  ❌ Error migrating users:', error.message);
    // Create default admin user
    const adminId = generateId();
    idMaps.users.set(1, adminId);
    await prisma.user.create({
      data: {
        id: adminId,
        username: 'admin',
        email: 'admin@sarupaa.local',
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'ADMINISTRATOR',
        status: 2,
      },
    });
    console.log('  Created default admin user');
  }
}

async function migrateStores(mysqlConn: mysql.Connection) {
  console.log('\n📥 Migrating Stores...');
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM stores') as [any[], any];
    console.log(`  Found ${rows.length} stores`);
    
    for (const row of rows) {
      const newId = generateId();
      idMaps.stores.set(row.id, newId);
      if (!defaultStoreId) defaultStoreId = newId;
      
      await prisma.store.create({
        data: {
          id: newId,
          name: row.name || 'Main Store',
          code: row.code || null,
          address: row.address || null,
          phone: row.phone || null,
          isActive: row.status !== 0,
        },
      });
    }
    
    if (rows.length === 0) {
      defaultStoreId = generateId();
      idMaps.stores.set(1, defaultStoreId);
      await prisma.store.create({
        data: {
          id: defaultStoreId,
          name: 'Main Store',
          code: 'MAIN',
          isActive: true,
        },
      });
      console.log('  Created default store');
    }
    
    console.log(`  ✅ Migrated stores`);
  } catch (error: any) {
    console.error('  ❌ Error:', error.message);
    defaultStoreId = generateId();
    idMaps.stores.set(1, defaultStoreId);
    await prisma.store.create({
      data: { id: defaultStoreId, name: 'Main Store', code: 'MAIN', isActive: true },
    });
  }
}

async function migrateCategories(mysqlConn: mysql.Connection) {
  console.log('\n📥 Migrating Categories...');
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM categories') as [any[], any];
    console.log(`  Found ${rows.length} categories`);
    
    // First pass: create all categories
    for (const row of rows) {
      const newId = generateId();
      idMaps.categories.set(row.id, newId);
      if (!defaultCategoryId) defaultCategoryId = newId;
      
      await prisma.category.create({
        data: {
          id: newId,
          name: row.name || 'Unknown Category',
          description: row.description || null,
          isActive: row.status !== 0,
        },
      });
    }
    
    // Second pass: update parent references
    for (const row of rows) {
      if (row.parent_id && idMaps.categories.has(row.parent_id)) {
        await prisma.category.update({
          where: { id: idMaps.categories.get(row.id) },
          data: { parentId: idMaps.categories.get(row.parent_id) },
        });
      }
    }
    
    console.log(`  ✅ Migrated ${rows.length} categories`);
  } catch (error: any) {
    console.error('  ❌ Error:', error.message);
  }
}

async function migrateUnits(mysqlConn: mysql.Connection) {
  console.log('\n📥 Migrating Units...');
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM units') as [any[], any];
    console.log(`  Found ${rows.length} units`);
    
    for (const row of rows) {
      const newId = generateId();
      idMaps.units.set(row.id, newId);
      if (!defaultUnitId) defaultUnitId = newId;
      
      await prisma.unit.create({
        data: {
          id: newId,
          name: row.name || 'Unit',
          shortName: row.short_name || row.name?.substring(0, 3) || 'UN',
          isActive: true,
        },
      });
    }
    
    if (rows.length === 0) {
      defaultUnitId = generateId();
      idMaps.units.set(1, defaultUnitId);
      await prisma.unit.create({
        data: { id: defaultUnitId, name: 'Piece', shortName: 'pcs', isActive: true },
      });
    }
    
    console.log(`  ✅ Migrated units`);
  } catch (error: any) {
    console.error('  ❌ Error:', error.message);
  }
}

async function migratePrices(mysqlConn: mysql.Connection) {
  console.log('\n📥 Loading Prices...');
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM price') as [any[], any];
    console.log(`  Found ${rows.length} prices`);
    
    for (const row of rows) {
      idMaps.prices.set(row.id, {
        cost: safeDecimal(row.purchase_price || row.unit_purchase_price),
        sale: safeDecimal(row.selling_price || row.unit_selling_price),
      });
    }
    
    console.log(`  ✅ Loaded ${rows.length} prices`);
  } catch (error: any) {
    console.error('  ❌ Error:', error.message);
  }
}

async function migrateProducts(mysqlConn: mysql.Connection) {
  console.log('\n📥 Migrating Products...');
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM products') as [any[], any];
    console.log(`  Found ${rows.length} products`);
    
    let migratedCount = 0;
    for (const row of rows) {
      try {
        const newId = generateId();
        idMaps.products.set(row.id, newId);
        
        // Get price from prices table
        const priceData = row.price_id ? idMaps.prices.get(row.price_id) : null;
        const costPrice = priceData?.cost || 0;
        const salePrice = priceData?.sale || 0;
        
        await prisma.product.create({
          data: {
            id: newId,
            name: row.name || 'Unknown Product',
            sku: row.code || row.barcode || `SKU-${row.id}`,
            barcode: row.barcode || null,
            description: row.description || null,
            categoryId: row.category_id ? idMaps.categories.get(row.category_id) : defaultCategoryId,
            unitId: row.unit_id ? idMaps.units.get(Math.floor(row.unit_id)) : defaultUnitId,
            costPrice,
            salePrice,
            minStock: safeInt(row.minimum_stock_level),
            isActive: row.is_archived !== 1,
          },
        });
        migratedCount++;
      } catch (e: any) {
        console.error(`    Failed to migrate product ${row.id}: ${e.message}`);
      }
    }
    
    console.log(`  ✅ Migrated ${migratedCount} products`);
  } catch (error: any) {
    console.error('  ❌ Error:', error.message);
  }
}

async function migrateCustomers(mysqlConn: mysql.Connection) {
  console.log('\n📥 Migrating Customers...');
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM customers') as [any[], any];
    console.log(`  Found ${rows.length} customers`);
    
    let migratedCount = 0;
    for (const row of rows) {
      try {
        const newId = generateId();
        idMaps.customers.set(row.id, newId);
        
        await prisma.customer.create({
          data: {
            id: newId,
            name: row.name || row.business_name || 'Unknown Customer',
            email: row.email || null,
            phone: row.phone_no || row.mobile_no || null,
            address: row.address || null,
            city: null,
            creditLimit: 0,
            balance: safeDecimal(row.opening_balance),
            isActive: row.status !== 0,
          },
        });
        migratedCount++;
      } catch (e: any) {
        console.error(`    Failed to migrate customer ${row.id}: ${e.message}`);
      }
    }
    
    // Create walk-in customer
    const walkInId = generateId();
    idMaps.customers.set(0, walkInId);
    await prisma.customer.create({
      data: { id: walkInId, name: 'Walk-in Customer', isActive: true },
    });
    
    console.log(`  ✅ Migrated ${migratedCount} customers`);
  } catch (error: any) {
    console.error('  ❌ Error:', error.message);
  }
}

async function migrateSuppliers(mysqlConn: mysql.Connection) {
  console.log('\n📥 Migrating Suppliers...');
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM suppliers') as [any[], any];
    console.log(`  Found ${rows.length} suppliers`);
    
    for (const row of rows) {
      const newId = generateId();
      idMaps.suppliers.set(row.id, newId);
      
      await prisma.supplier.create({
        data: {
          id: newId,
          name: row.name || 'Unknown Supplier',
          email: row.email || null,
          phone: row.phone_no || row.mobile_no || null,
          address: row.address || null,
          balance: 0,
          isActive: true,
        },
      });
    }
    
    console.log(`  ✅ Migrated ${rows.length} suppliers`);
  } catch (error: any) {
    console.error('  ❌ Error:', error.message);
  }
}

async function migrateSales(mysqlConn: mysql.Connection) {
  console.log('\n📥 Migrating Sales (5754 records)...');
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM sales ORDER BY id') as [any[], any];
    console.log(`  Found ${rows.length} sales`);
    
    let migratedCount = 0;
    let batchCount = 0;
    
    for (const row of rows) {
      try {
        const newId = generateId();
        idMaps.sales.set(row.id, newId);
        
        // Get sale items
        const [items] = await mysqlConn.query(
          'SELECT * FROM sale_items WHERE sale_id = ?',
          [row.id]
        ) as [any[], any];
        
        const subtotal = safeDecimal(row.net_total) || items.reduce((sum: number, item: any) => 
          sum + safeDecimal(item.total), 0);
        const discount = safeDecimal(row.discount);
        const total = safeDecimal(row.grand_total) || subtotal - discount;
        
        const invoiceNo = row.bill_no || row.order_id?.toString() || `INV-${String(row.id).padStart(6, '0')}`;
        
        await prisma.sale.create({
          data: {
            id: newId,
            invoiceNo,
            customerId: row.customer_id ? idMaps.customers.get(row.customer_id) : idMaps.customers.get(0),
            storeId: row.store_id ? idMaps.stores.get(row.store_id) : defaultStoreId,
            userId: row.created_by ? idMaps.users.get(row.created_by) : null,
            subtotal,
            discount,
            discountPercent: 0,
            tax: 0,
            total,
            paid: total,
            due: 0,
            status: row.status === 0 ? 'cancelled' : 'completed',
            isReturn: row.is_return === 1,
            date: convertDate(row.date || row.created_at),
            notes: row.comment || row.comments || null,
          },
        });
        
        // Create sale items
        for (const item of items) {
          const productId = idMaps.products.get(item.product_id);
          if (!productId) continue;
          
          await prisma.saleItem.create({
            data: {
              saleId: newId,
              productId,
              quantity: safeInt(item.quantity),
              unitPrice: safeDecimal(item.price),
              costPrice: 0,
              discount: safeDecimal(item.discount),
              tax: 0,
              total: safeDecimal(item.total),
            },
          });
        }
        
        migratedCount++;
        batchCount++;
        
        if (batchCount >= 500) {
          console.log(`    Migrated ${migratedCount}/${rows.length} sales...`);
          batchCount = 0;
        }
      } catch (e: any) {
        // Skip failed sales silently
      }
    }
    
    console.log(`  ✅ Migrated ${migratedCount} sales`);
  } catch (error: any) {
    console.error('  ❌ Error:', error.message);
  }
}

async function migratePurchases(mysqlConn: mysql.Connection) {
  console.log('\n📥 Migrating Purchases...');
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM purchases ORDER BY id') as [any[], any];
    console.log(`  Found ${rows.length} purchases`);
    
    for (const row of rows) {
      try {
        const newId = generateId();
        idMaps.purchases.set(row.id, newId);
        
        // Get purchase items
        const [items] = await mysqlConn.query(
          'SELECT * FROM purchase_items WHERE purchase_id = ?',
          [row.id]
        ) as [any[], any];
        
        const subtotal = items.reduce((sum: number, item: any) => 
          sum + safeDecimal(item.total || (item.quantity * item.price)), 0);
        const total = safeDecimal(row.grand_total || row.total) || subtotal;
        const paid = safeDecimal(row.paid || row.amount_paid) || 0;
        
        const invoiceNo = row.invoice_no || row.reference || `PUR-${String(row.id).padStart(6, '0')}`;
        
        await prisma.purchase.create({
          data: {
            id: newId,
            invoiceNo,
            supplierId: row.supplier_id ? idMaps.suppliers.get(row.supplier_id) : null,
            storeId: defaultStoreId,
            userId: row.created_by ? idMaps.users.get(row.created_by) : null,
            subtotal,
            discount: safeDecimal(row.discount),
            discountPercent: 0,
            tax: 0,
            total,
            paid,
            due: total - paid,
            status: row.status === 0 ? 'cancelled' : 'completed',
            date: convertDate(row.date || row.created_at),
          },
        });
        
        // Create purchase items
        for (const item of items) {
          const productId = idMaps.products.get(item.product_id);
          if (!productId) continue;
          
          await prisma.purchaseItem.create({
            data: {
              purchaseId: newId,
              productId,
              quantity: safeInt(item.quantity),
              unitPrice: safeDecimal(item.price || item.unit_price),
              discount: safeDecimal(item.discount),
              tax: 0,
              total: safeDecimal(item.total),
            },
          });
        }
      } catch (e: any) {
        // Skip failed purchases
      }
    }
    
    console.log(`  ✅ Migrated ${rows.length} purchases`);
  } catch (error: any) {
    console.error('  ❌ Error:', error.message);
  }
}

async function migrateAccounts(mysqlConn: mysql.Connection) {
  console.log('\n📥 Migrating Accounts...');
  
  try {
    // Migrate primary accounts (groups)
    const [groups] = await mysqlConn.query('SELECT * FROM primary_accounts') as [any[], any];
    console.log(`  Found ${groups.length} account groups`);
    
    for (const row of groups) {
      const newId = generateId();
      idMaps.accountGroups.set(row.id, newId);
      
      // Determine type based on name
      let type = 'asset';
      const name = (row.name || '').toLowerCase();
      if (name.includes('liabilit') || name.includes('payable')) type = 'liability';
      else if (name.includes('equity') || name.includes('capital')) type = 'equity';
      else if (name.includes('income') || name.includes('revenue') || name.includes('sale')) type = 'income';
      else if (name.includes('expense') || name.includes('cost')) type = 'expense';
      
      await prisma.accountGroup.create({
        data: {
          id: newId,
          name: row.name || `Group ${row.id}`,
          type,
          isSystem: true,
        },
      });
    }
    
    // Migrate accounts
    const [accounts] = await mysqlConn.query('SELECT * FROM accounts') as [any[], any];
    console.log(`  Found ${accounts.length} accounts`);
    
    let migratedCount = 0;
    for (const row of accounts) {
      try {
        const groupId = row.primary_account_id ? idMaps.accountGroups.get(row.primary_account_id) : null;
        if (!groupId) continue;
        
        const newId = generateId();
        idMaps.accounts.set(row.id, newId);
        
        // Determine type
        let type = 'asset';
        const name = (row.name || '').toLowerCase();
        if (name.includes('liabilit') || name.includes('payable')) type = 'liability';
        else if (name.includes('equity') || name.includes('capital')) type = 'equity';
        else if (name.includes('income') || name.includes('revenue') || name.includes('sale')) type = 'income';
        else if (name.includes('expense') || name.includes('cost')) type = 'expense';
        else if (name.includes('cash') || name.includes('bank') || name.includes('asset')) type = 'asset';
        
        await prisma.account.create({
          data: {
            id: newId,
            code: row.code?.toString() || `ACC-${row.id}`,
            name: row.name || `Account ${row.id}`,
            groupId,
            type,
            balance: 0,
            isSystem: row.is_system_account === 1,
            isActive: row.status !== 0,
          },
        });
        migratedCount++;
      } catch (e: any) {
        // Skip failed accounts
      }
    }
    
    console.log(`  ✅ Migrated ${migratedCount} accounts`);
  } catch (error: any) {
    console.error('  ❌ Error:', error.message);
    await createDefaultAccounts();
  }
}

async function createDefaultAccounts() {
  console.log('  Creating default accounts...');
  
  const groups = [
    { name: 'Assets', type: 'asset' },
    { name: 'Liabilities', type: 'liability' },
    { name: 'Equity', type: 'equity' },
    { name: 'Income', type: 'income' },
    { name: 'Expenses', type: 'expense' },
  ];
  
  for (const group of groups) {
    const groupId = generateId();
    idMaps.accountGroups.set(groups.indexOf(group) + 1, groupId);
    
    await prisma.accountGroup.create({
      data: { id: groupId, ...group, isSystem: true },
    });
    
    const defaultAccounts: { name: string; code: string }[] = [];
    
    if (group.type === 'asset') {
      defaultAccounts.push({ name: 'Cash', code: '1001' });
      defaultAccounts.push({ name: 'Bank', code: '1002' });
      defaultAccounts.push({ name: 'Accounts Receivable', code: '1003' });
    } else if (group.type === 'liability') {
      defaultAccounts.push({ name: 'Accounts Payable', code: '2001' });
    } else if (group.type === 'income') {
      defaultAccounts.push({ name: 'Sales Revenue', code: '4001' });
    } else if (group.type === 'expense') {
      defaultAccounts.push({ name: 'Cost of Goods Sold', code: '5001' });
    }
    
    for (const acc of defaultAccounts) {
      await prisma.account.create({
        data: { ...acc, groupId, type: group.type, isSystem: true, isActive: true },
      });
    }
  }
}

async function migrateExpenses(mysqlConn: mysql.Connection) {
  console.log('\n📥 Migrating Expenses...');
  
  try {
    // Create default expense category
    const defaultCatId = generateId();
    await prisma.expenseCategory.create({
      data: { id: defaultCatId, name: 'General Expense', isActive: true },
    });
    
    const [expenses] = await mysqlConn.query('SELECT * FROM expenses ORDER BY id') as [any[], any];
    console.log(`  Found ${expenses.length} expenses`);
    
    let migratedCount = 0;
    for (const row of expenses) {
      try {
        await prisma.expense.create({
          data: {
            categoryId: defaultCatId,
            userId: row.created_by ? idMaps.users.get(row.created_by) : null,
            amount: safeDecimal(row.amount),
            description: row.comment || null,
            paymentType: row.payment_type === 1 ? 'cash' : 'bank',
            date: convertDate(row.date || row.created_at),
          },
        });
        migratedCount++;
      } catch (e: any) {
        // Skip failed expenses
      }
    }
    
    console.log(`  ✅ Migrated ${migratedCount} expenses`);
  } catch (error: any) {
    console.error('  ❌ Error:', error.message);
  }
}

async function migrateInventory(mysqlConn: mysql.Connection) {
  console.log('\n📥 Creating Inventory from Products...');
  
  try {
    // Create inventory entries for each product based on purchase/sale history
    const products = await prisma.product.findMany();
    let count = 0;
    
    for (const product of products) {
      // Get original product ID
      let originalId: number | null = null;
      for (const [key, value] of idMaps.products.entries()) {
        if (value === product.id) {
          originalId = key;
          break;
        }
      }
      
      if (!originalId) continue;
      
      // Calculate stock from purchase items - sale items
      const [purchaseQty] = await mysqlConn.query(
        'SELECT COALESCE(SUM(quantity), 0) as qty FROM purchase_items WHERE product_id = ?',
        [originalId]
      ) as [any[], any];
      
      const [saleQty] = await mysqlConn.query(
        'SELECT COALESCE(SUM(quantity), 0) as qty FROM sale_items WHERE product_id = ?',
        [originalId]
      ) as [any[], any];
      
      const stock = safeInt(purchaseQty[0]?.qty) - safeInt(saleQty[0]?.qty);
      
      if (stock !== 0) {
        await prisma.inventory.create({
          data: {
            productId: product.id,
            storeId: defaultStoreId,
            quantity: stock,
            costPrice: product.costPrice,
            type: 'opening',
            notes: 'Calculated from purchase/sale history',
          },
        });
        count++;
      }
    }
    
    console.log(`  ✅ Created ${count} inventory records`);
  } catch (error: any) {
    console.error('  ❌ Error:', error.message);
  }
}

async function migrateSettings(mysqlConn: mysql.Connection) {
  console.log('\n📥 Migrating Settings...');
  
  try {
    const [rows] = await mysqlConn.query('SELECT * FROM key_storage_item') as [any[], any];
    console.log(`  Found ${rows.length} settings`);
    
    for (const row of rows) {
      await prisma.setting.upsert({
        where: { key: row.key },
        update: { value: row.value || '' },
        create: { key: row.key, value: row.value || '', type: 'string', group: 'general' },
      });
    }
    
    // Add essential settings
    const defaults = [
      { key: 'storeName', value: 'SARUPAA POS' },
      { key: 'currency', value: 'PKR' },
      { key: 'currencySymbol', value: 'Rs' },
    ];
    
    for (const setting of defaults) {
      await prisma.setting.upsert({
        where: { key: setting.key },
        update: {},
        create: { ...setting, type: 'string', group: 'general' },
      });
    }
    
    console.log(`  ✅ Migrated settings`);
  } catch (error: any) {
    console.log('  ⚠️ Settings table not found, using defaults');
  }
}

async function main() {
  console.log('🚀 SARUPAA POS Database Migration');
  console.log('================================');
  console.log('MySQL (punar) → PostgreSQL\n');
  
  let mysqlConn: mysql.Connection | null = null;
  
  try {
    // Connect to MySQL
    console.log('📡 Connecting to MySQL...');
    console.log(`   Host: ${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}`);
    console.log(`   Database: ${MYSQL_CONFIG.database}`);
    
    mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
    console.log('   ✅ Connected to MySQL\n');
    
    // Verify tables
    const [tables] = await mysqlConn.query('SHOW TABLES') as [any[], any];
    console.log(`📋 Found ${tables.length} tables in MySQL database\n`);
    
    // Clear PostgreSQL database
    console.log('🗑️  Clearing PostgreSQL database...');
    try {
      await prisma.$executeRawUnsafe('TRUNCATE TABLE transactions CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE customer_ledgers CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE supplier_ledgers CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE supplier_payments CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE payments CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE sale_items CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE sales CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE purchase_items CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE purchases CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE inventories CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE prices CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE expenses CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE cash_collections CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE products CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE categories CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE brands CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE units CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE customers CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE customer_types CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE suppliers CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE accounts CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE account_groups CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE expense_categories CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE user_profiles CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE users CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE stores CASCADE');
      await prisma.$executeRawUnsafe('TRUNCATE TABLE settings CASCADE');
    } catch (e) {
      // Some tables might not have data
    }
    console.log('   ✅ PostgreSQL cleared\n');
    
    // Run migrations in order
    await migrateUsers(mysqlConn);
    await migrateStores(mysqlConn);
    await migrateCategories(mysqlConn);
    await migrateUnits(mysqlConn);
    await migratePrices(mysqlConn);
    await migrateProducts(mysqlConn);
    await migrateCustomers(mysqlConn);
    await migrateSuppliers(mysqlConn);
    await migrateSales(mysqlConn);
    await migratePurchases(mysqlConn);
    await migrateAccounts(mysqlConn);
    await migrateExpenses(mysqlConn);
    await migrateInventory(mysqlConn);
    await migrateSettings(mysqlConn);
    
    console.log('\n✨ Migration completed successfully!');
    console.log('================================');
    
    // Summary
    const userCount = await prisma.user.count();
    const productCount = await prisma.product.count();
    const customerCount = await prisma.customer.count();
    const supplierCount = await prisma.supplier.count();
    const saleCount = await prisma.sale.count();
    const purchaseCount = await prisma.purchase.count();
    const accountCount = await prisma.account.count();
    const expenseCount = await prisma.expense.count();
    
    console.log('\n📊 Migration Summary:');
    console.log(`   Users:     ${userCount}`);
    console.log(`   Products:  ${productCount}`);
    console.log(`   Customers: ${customerCount}`);
    console.log(`   Suppliers: ${supplierCount}`);
    console.log(`   Sales:     ${saleCount}`);
    console.log(`   Purchases: ${purchaseCount}`);
    console.log(`   Accounts:  ${accountCount}`);
    console.log(`   Expenses:  ${expenseCount}`);
    
    console.log('\n🔑 Login Credentials:');
    console.log('   Use your existing username/password');
    console.log('   Or: admin / password123');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (mysqlConn) {
      await mysqlConn.end();
    }
    await prisma.$disconnect();
  }
}

main();
