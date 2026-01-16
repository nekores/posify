import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const BACKUP_DIR = join(process.cwd(), 'backups');

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const filename = `${params.id}.json`;
    const filepath = join(BACKUP_DIR, filename);

    if (!existsSync(filepath)) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    const backupContent = readFileSync(filepath, 'utf-8');
    const backup = JSON.parse(backupContent);

    // Clear existing data (in reverse dependency order)
    await prisma.$transaction([
      prisma.transaction.deleteMany(),
      prisma.customerLedger.deleteMany(),
      prisma.supplierLedger.deleteMany(),
      prisma.supplierPayment.deleteMany(),
      prisma.payment.deleteMany(),
      prisma.saleItem.deleteMany(),
      prisma.sale.deleteMany(),
      prisma.purchaseItem.deleteMany(),
      prisma.purchase.deleteMany(),
      prisma.inventory.deleteMany(),
      prisma.price.deleteMany(),
      prisma.expense.deleteMany(),
      prisma.cashCollection.deleteMany(),
      prisma.product.deleteMany(),
      prisma.category.deleteMany(),
      prisma.brand.deleteMany(),
      prisma.unit.deleteMany(),
      prisma.customer.deleteMany(),
      prisma.customerType.deleteMany(),
      prisma.supplier.deleteMany(),
      prisma.account.deleteMany(),
      prisma.accountGroup.deleteMany(),
      prisma.expenseCategory.deleteMany(),
      prisma.userProfile.deleteMany(),
      prisma.user.deleteMany(),
      prisma.store.deleteMany(),
      prisma.setting.deleteMany(),
    ]);

    // Restore data
    const { data } = backup;

    // Restore in dependency order
    if (data.stores?.length) {
      await prisma.store.createMany({ data: data.stores });
    }
    if (data.users?.length) {
      // Restore users without profiles first
      const usersWithoutProfiles = data.users.map(({ profile, ...user }: any) => user);
      await prisma.user.createMany({ data: usersWithoutProfiles });
      
      // Restore profiles
      const profiles = data.users
        .filter((u: any) => u.profile)
        .map((u: any) => u.profile);
      if (profiles.length) {
        await prisma.userProfile.createMany({ data: profiles });
      }
    }
    if (data.categories?.length) {
      await prisma.category.createMany({ data: data.categories });
    }
    if (data.brands?.length) {
      await prisma.brand.createMany({ data: data.brands });
    }
    if (data.units?.length) {
      await prisma.unit.createMany({ data: data.units });
    }
    if (data.products?.length) {
      await prisma.product.createMany({ data: data.products });
    }
    if (data.inventory?.length) {
      await prisma.inventory.createMany({ data: data.inventory });
    }
    if (data.customerTypes?.length) {
      await prisma.customerType.createMany({ data: data.customerTypes });
    }
    if (data.customers?.length) {
      await prisma.customer.createMany({ data: data.customers });
    }
    if (data.suppliers?.length) {
      await prisma.supplier.createMany({ data: data.suppliers });
    }
    if (data.sales?.length) {
      await prisma.sale.createMany({ data: data.sales });
    }
    if (data.saleItems?.length) {
      await prisma.saleItem.createMany({ data: data.saleItems });
    }
    if (data.purchases?.length) {
      await prisma.purchase.createMany({ data: data.purchases });
    }
    if (data.purchaseItems?.length) {
      await prisma.purchaseItem.createMany({ data: data.purchaseItems });
    }
    if (data.payments?.length) {
      await prisma.payment.createMany({ data: data.payments });
    }
    if (data.expenseCategories?.length) {
      await prisma.expenseCategory.createMany({ data: data.expenseCategories });
    }
    if (data.expenses?.length) {
      await prisma.expense.createMany({ data: data.expenses });
    }
    if (data.accountGroups?.length) {
      await prisma.accountGroup.createMany({ data: data.accountGroups });
    }
    if (data.accounts?.length) {
      await prisma.account.createMany({ data: data.accounts });
    }
    if (data.transactions?.length) {
      await prisma.transaction.createMany({ data: data.transactions });
    }
    if (data.settings?.length) {
      await prisma.setting.createMany({ data: data.settings });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error restoring backup:', error);
    return NextResponse.json({ error: 'Failed to restore backup' }, { status: 500 });
  }
}

