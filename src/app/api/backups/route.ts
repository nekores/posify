import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const BACKUP_DIR = join(process.cwd(), 'backups');

// Ensure backup directory exists
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

export async function GET() {
  try {
    // List backup files
    const files = existsSync(BACKUP_DIR) ? readdirSync(BACKUP_DIR) : [];
    
    const backups = files
      .filter((f) => f.endsWith('.json') || f.endsWith('.sql'))
      .map((filename) => {
        const filepath = join(BACKUP_DIR, filename);
        const stats = statSync(filepath);
        const isFullBackup = filename.endsWith('.sql');
        return {
          id: filename.replace('.json', '').replace('.sql', ''),
          filename,
          type: isFullBackup ? 'full' : 'data',
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ backups });
  } catch (error) {
    console.error('Error listing backups:', error);
    return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const backupType = body.type || 'data'; // 'data' or 'full'
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    if (backupType === 'full') {
      // Full SQL backup using pg_dump
      const filename = `full-backup-${timestamp}.sql`;
      const filepath = join(BACKUP_DIR, filename);
      
      // Get database connection info from environment
      const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/posify';
      
      // Parse DATABASE_URL
      const url = new URL(databaseUrl);
      const host = url.hostname;
      const port = url.port || '5432';
      const database = url.pathname.slice(1);
      const username = url.username;
      const password = url.password;
      
      // Set PGPASSWORD and run pg_dump
      const pgDumpCmd = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} --clean --if-exists --no-owner --no-privileges -f "${filepath}"`;
      
      try {
        await execAsync(pgDumpCmd);
        
        const stats = statSync(filepath);
        return NextResponse.json({
          success: true,
          backup: {
            id: filename.replace('.sql', ''),
            filename,
            type: 'full',
            size: stats.size,
            createdAt: new Date().toISOString(),
          },
        });
      } catch (pgError: any) {
        console.error('pg_dump error:', pgError);
        return NextResponse.json({ 
          error: 'Failed to create SQL backup. Make sure pg_dump is installed.',
          details: pgError.message 
        }, { status: 500 });
      }
    } else {
      // Data backup (JSON)
      const [
        users,
        stores,
        categories,
        brands,
        units,
        products,
        inventory,
        customers,
        customerTypes,
        customerLedger,
        suppliers,
        supplierLedger,
        sales,
        saleItems,
        purchases,
        purchaseItems,
        payments,
        expenses,
        expenseCategories,
        accounts,
        accountGroups,
        transactions,
        settings,
        cashCollections,
      ] = await Promise.all([
        prisma.user.findMany({ include: { profile: true } }),
        prisma.store.findMany(),
        prisma.category.findMany(),
        prisma.brand.findMany(),
        prisma.unit.findMany(),
        prisma.product.findMany(),
        prisma.inventory.findMany(),
        prisma.customer.findMany(),
        prisma.customerType.findMany(),
        prisma.customerLedger.findMany(),
        prisma.supplier.findMany(),
        prisma.supplierLedger.findMany(),
        prisma.sale.findMany(),
        prisma.saleItem.findMany(),
        prisma.purchase.findMany(),
        prisma.purchaseItem.findMany(),
        prisma.payment.findMany(),
        prisma.expense.findMany(),
        prisma.expenseCategory.findMany(),
        prisma.account.findMany(),
        prisma.accountGroup.findMany(),
        prisma.transaction.findMany(),
        prisma.setting.findMany(),
        prisma.cashCollection.findMany(),
      ]);

      const backup = {
        version: '1.0',
        type: 'data',
        createdAt: new Date().toISOString(),
        data: {
          users,
          stores,
          categories,
          brands,
          units,
          products,
          inventory,
          customers,
          customerTypes,
          customerLedger,
          suppliers,
          supplierLedger,
          sales,
          saleItems,
          purchases,
          purchaseItems,
          payments,
          expenses,
          expenseCategories,
          accounts,
          accountGroups,
          transactions,
          settings,
          cashCollections,
        },
        stats: {
          users: users.length,
          products: products.length,
          customers: customers.length,
          sales: sales.length,
          purchases: purchases.length,
        },
      };

      const filename = `data-backup-${timestamp}.json`;
      const filepath = join(BACKUP_DIR, filename);

      writeFileSync(filepath, JSON.stringify(backup, null, 2));

      return NextResponse.json({
        success: true,
        backup: {
          id: filename.replace('.json', ''),
          filename,
          type: 'data',
          size: statSync(filepath).size,
          createdAt: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 });
  }
}

