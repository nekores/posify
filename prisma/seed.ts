import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default users
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@sarupaa.com',
      passwordHash,
      role: 'ADMINISTRATOR',
      status: 2,
      profile: {
        create: {
          firstName: 'Admin',
          lastName: 'User',
        },
      },
    },
  });

  const manager = await prisma.user.upsert({
    where: { username: 'manager' },
    update: {},
    create: {
      username: 'manager',
      email: 'manager@sarupaa.com',
      passwordHash: await bcrypt.hash('manager123', 10),
      role: 'MANAGER',
      status: 2,
      profile: {
        create: {
          firstName: 'Store',
          lastName: 'Manager',
        },
      },
    },
  });

  const user = await prisma.user.upsert({
    where: { username: 'user' },
    update: {},
    create: {
      username: 'user',
      email: 'user@sarupaa.com',
      passwordHash: await bcrypt.hash('user123', 10),
      role: 'USER',
      status: 2,
      profile: {
        create: {
          firstName: 'POS',
          lastName: 'User',
        },
      },
    },
  });

  console.log('Created users:', { admin: admin.id, manager: manager.id, user: user.id });

  // Create default store
  const store = await prisma.store.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: {
      name: 'Main Store',
      code: 'MAIN',
      address: 'Main Street',
      phone: '0300-1234567',
      email: 'store@sarupaa.com',
    },
  });

  console.log('Created store:', store.id);

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { id: 'cat-beverages' },
      update: {},
      create: { id: 'cat-beverages', name: 'Beverages', description: 'Drinks and beverages' },
    }),
    prisma.category.upsert({
      where: { id: 'cat-snacks' },
      update: {},
      create: { id: 'cat-snacks', name: 'Snacks', description: 'Chips, cookies, etc.' },
    }),
    prisma.category.upsert({
      where: { id: 'cat-dairy' },
      update: {},
      create: { id: 'cat-dairy', name: 'Dairy', description: 'Milk, cheese, etc.' },
    }),
    prisma.category.upsert({
      where: { id: 'cat-grocery' },
      update: {},
      create: { id: 'cat-grocery', name: 'Grocery', description: 'General grocery items' },
    }),
  ]);

  console.log('Created categories:', categories.length);

  // Create units
  const units = await Promise.all([
    prisma.unit.upsert({
      where: { id: 'unit-pcs' },
      update: {},
      create: { id: 'unit-pcs', name: 'Pieces', shortName: 'pcs' },
    }),
    prisma.unit.upsert({
      where: { id: 'unit-kg' },
      update: {},
      create: { id: 'unit-kg', name: 'Kilogram', shortName: 'kg' },
    }),
    prisma.unit.upsert({
      where: { id: 'unit-ltr' },
      update: {},
      create: { id: 'unit-ltr', name: 'Liter', shortName: 'ltr' },
    }),
  ]);

  console.log('Created units:', units.length);

  // Create sample products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'COC001' },
      update: {},
      create: {
        name: 'Coca Cola 500ml',
        sku: 'COC001',
        barcode: '8901234567890',
        categoryId: 'cat-beverages',
        unitId: 'unit-pcs',
        costPrice: 65,
        salePrice: 80,
        minStock: 10,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PEP001' },
      update: {},
      create: {
        name: 'Pepsi 500ml',
        sku: 'PEP001',
        barcode: '8901234567891',
        categoryId: 'cat-beverages',
        unitId: 'unit-pcs',
        costPrice: 60,
        salePrice: 75,
        minStock: 10,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'LAY001' },
      update: {},
      create: {
        name: 'Lays Classic Chips',
        sku: 'LAY001',
        barcode: '8901234567892',
        categoryId: 'cat-snacks',
        unitId: 'unit-pcs',
        costPrice: 40,
        salePrice: 50,
        minStock: 20,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'MLK001' },
      update: {},
      create: {
        name: 'Milk 1 Liter',
        sku: 'MLK001',
        barcode: '8901234567893',
        categoryId: 'cat-dairy',
        unitId: 'unit-ltr',
        costPrice: 180,
        salePrice: 200,
        minStock: 5,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'WAT001' },
      update: {},
      create: {
        name: 'Mineral Water 1.5L',
        sku: 'WAT001',
        barcode: '8901234567894',
        categoryId: 'cat-beverages',
        unitId: 'unit-pcs',
        costPrice: 30,
        salePrice: 40,
        minStock: 50,
      },
    }),
  ]);

  console.log('Created products:', products.length);

  // Create inventory (opening stock)
  for (const product of products) {
    await prisma.inventory.upsert({
      where: { id: `inv-${product.id}` },
      update: {},
      create: {
        id: `inv-${product.id}`,
        productId: product.id,
        storeId: store.id,
        quantity: 100,
        costPrice: product.costPrice,
        type: 'opening',
        notes: 'Initial stock',
      },
    });
  }

  console.log('Created inventory for products');

  // Create default customer (Walk-in)
  const customer = await prisma.customer.upsert({
    where: { id: 'cust-walkin' },
    update: {},
    create: {
      id: 'cust-walkin',
      name: 'Walk-in Customer',
      phone: '',
    },
  });

  console.log('Created default customer:', customer.id);

  // Create account groups and accounts for double-entry
  const accountGroups = await Promise.all([
    prisma.accountGroup.upsert({
      where: { id: 'grp-assets' },
      update: {},
      create: { id: 'grp-assets', name: 'Assets', type: 'asset', isSystem: true },
    }),
    prisma.accountGroup.upsert({
      where: { id: 'grp-liabilities' },
      update: {},
      create: { id: 'grp-liabilities', name: 'Liabilities', type: 'liability', isSystem: true },
    }),
    prisma.accountGroup.upsert({
      where: { id: 'grp-income' },
      update: {},
      create: { id: 'grp-income', name: 'Income', type: 'income', isSystem: true },
    }),
    prisma.accountGroup.upsert({
      where: { id: 'grp-expenses' },
      update: {},
      create: { id: 'grp-expenses', name: 'Expenses', type: 'expense', isSystem: true },
    }),
  ]);

  // Create accounts
  await Promise.all([
    prisma.account.upsert({
      where: { code: '1001' },
      update: {},
      create: { code: '1001', name: 'Cash in Hand', groupId: 'grp-assets', type: 'asset', isSystem: true },
    }),
    prisma.account.upsert({
      where: { code: '1002' },
      update: {},
      create: { code: '1002', name: 'Cash at Bank', groupId: 'grp-assets', type: 'asset', isSystem: true },
    }),
    prisma.account.upsert({
      where: { code: '1003' },
      update: {},
      create: { code: '1003', name: 'Accounts Receivable', groupId: 'grp-assets', type: 'asset', isSystem: true },
    }),
    prisma.account.upsert({
      where: { code: '1004' },
      update: {},
      create: { code: '1004', name: 'Inventory', groupId: 'grp-assets', type: 'asset', isSystem: true },
    }),
    prisma.account.upsert({
      where: { code: '2001' },
      update: {},
      create: { code: '2001', name: 'Accounts Payable', groupId: 'grp-liabilities', type: 'liability', isSystem: true },
    }),
    prisma.account.upsert({
      where: { code: '2002' },
      update: {},
      create: { code: '2002', name: 'Tax Payable', groupId: 'grp-liabilities', type: 'liability', isSystem: true },
    }),
    prisma.account.upsert({
      where: { code: '4001' },
      update: {},
      create: { code: '4001', name: 'Sales Revenue', groupId: 'grp-income', type: 'income', isSystem: true },
    }),
    prisma.account.upsert({
      where: { code: '5001' },
      update: {},
      create: { code: '5001', name: 'Cost of Goods Sold', groupId: 'grp-expenses', type: 'expense', isSystem: true },
    }),
  ]);

  console.log('Created account groups and accounts');

  // Create expense categories
  await Promise.all([
    prisma.expenseCategory.upsert({
      where: { id: 'exp-rent' },
      update: {},
      create: { id: 'exp-rent', name: 'Rent' },
    }),
    prisma.expenseCategory.upsert({
      where: { id: 'exp-utilities' },
      update: {},
      create: { id: 'exp-utilities', name: 'Utilities' },
    }),
    prisma.expenseCategory.upsert({
      where: { id: 'exp-salary' },
      update: {},
      create: { id: 'exp-salary', name: 'Salary' },
    }),
    prisma.expenseCategory.upsert({
      where: { id: 'exp-misc' },
      update: {},
      create: { id: 'exp-misc', name: 'Miscellaneous' },
    }),
  ]);

  console.log('Created expense categories');

  // Create settings
  await Promise.all([
    prisma.setting.upsert({
      where: { key: 'company_name' },
      update: {},
      create: { key: 'company_name', value: 'Posify', group: 'general' },
    }),
    prisma.setting.upsert({
      where: { key: 'currency' },
      update: {},
      create: { key: 'currency', value: 'PKR', group: 'general' },
    }),
    prisma.setting.upsert({
      where: { key: 'currency_symbol' },
      update: {},
      create: { key: 'currency_symbol', value: 'Rs.', group: 'general' },
    }),
    prisma.setting.upsert({
      where: { key: 'tax_rate' },
      update: {},
      create: { key: 'tax_rate', value: '0', type: 'number', group: 'tax' },
    }),
  ]);

  console.log('Created settings');

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

