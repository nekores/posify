import { NextRequest, NextResponse } from 'next/server';
import { existsSync, unlinkSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const BACKUP_DIR = join(process.cwd(), 'backups');

// Helper to find backup file (could be .json or .sql)
function findBackupFile(id: string): { filepath: string; filename: string } | null {
  const jsonFile = `${id}.json`;
  const sqlFile = `${id}.sql`;
  
  const jsonPath = join(BACKUP_DIR, jsonFile);
  const sqlPath = join(BACKUP_DIR, sqlFile);
  
  if (existsSync(jsonPath)) {
    return { filepath: jsonPath, filename: jsonFile };
  }
  if (existsSync(sqlPath)) {
    return { filepath: sqlPath, filename: sqlFile };
  }
  return null;
}

// GET - Download backup file
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const backup = findBackupFile(params.id);
    
    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    const fileContent = readFileSync(backup.filepath);
    const stats = statSync(backup.filepath);
    const isSQL = backup.filename.endsWith('.sql');
    
    const headers = new Headers();
    headers.set('Content-Type', isSQL ? 'application/sql' : 'application/json');
    headers.set('Content-Disposition', `attachment; filename="${backup.filename}"`);
    headers.set('Content-Length', stats.size.toString());

    return new NextResponse(fileContent, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error downloading backup:', error);
    return NextResponse.json({ error: 'Failed to download backup' }, { status: 500 });
  }
}

// DELETE - Delete backup file
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const backup = findBackupFile(params.id);

    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    unlinkSync(backup.filepath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting backup:', error);
    return NextResponse.json({ error: 'Failed to delete backup' }, { status: 500 });
  }
}

