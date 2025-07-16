import { getDb } from './db';

async function init() {
  const db = await getDb();
  // Add columns for richer metadata
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
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await db.close();
  console.log('Database initialized.');
}

init();
