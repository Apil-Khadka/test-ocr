import { getDb } from './db';

async function init() {
  const db = await getDb();
  // Add columns for richer metadata and AI analysis
  await db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      extracted_text TEXT,
      image_width INTEGER,
      image_height INTEGER,
      pdf_page_count INTEGER,
      indexed_text TEXT,
      ai_classification TEXT,
      ai_summary TEXT,
      donut_classification TEXT,
      folder TEXT,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Add missing columns if table already exists
  const columns = await db.all(`PRAGMA table_info(documents);`);
  const colNames = columns.map((c: any) => c.name);
  if (!colNames.includes('ai_classification')) {
    await db.exec('ALTER TABLE documents ADD COLUMN ai_classification TEXT;');
  }
  if (!colNames.includes('ai_summary')) {
    await db.exec('ALTER TABLE documents ADD COLUMN ai_summary TEXT;');
  }
  if (!colNames.includes('donut_classification')) {
    await db.exec('ALTER TABLE documents ADD COLUMN donut_classification TEXT;');
  }
  if (!colNames.includes('folder')) {
    await db.exec('ALTER TABLE documents ADD COLUMN folder TEXT;');
  }
  await db.close();
  console.log('Database initialized.');
}

init();
