import express, { Request, Response } from 'express';
import multer, { FileFilterCallback, StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs';
import { getDb } from '../models/db';
import sharp from 'sharp';
const pdfParse = require('pdf-parse');
import Tesseract from 'tesseract.js';

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage config
const storage: StorageEngine = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: any) => {
    cb(null, uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: any) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

// POST /api/documents/upload
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  let extractedText: string | null = null;
  let imageWidth: number | null = null;
  let imageHeight: number | null = null;
  let pdfPageCount: number | null = null;
  let indexedText: string | null = null;

  try {
    if ((file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') && req.body.ocr_text) {
      extractedText = req.body.ocr_text;
    } else if (file.mimetype === 'text/plain') {
      extractedText = fs.readFileSync(file.path, 'utf-8');
    } else if (file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text;
      pdfPageCount = pdfData.numpages;
    } else if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      // fallback: no OCR text provided
      extractedText = null;
    }
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      const image = sharp(file.path);
      const metadata = await image.metadata();
      imageWidth = metadata.width || null;
      imageHeight = metadata.height || null;
    }
  } catch (e) {
    // Ignore extraction errors, store what we can
  }

  if (extractedText) {
    indexedText = extractedText.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  try {
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO documents (filename, original_name, file_path, file_size, mime_type, extracted_text, image_width, image_height, pdf_page_count, indexed_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      file.filename,
      file.originalname,
      file.path,
      file.size,
      file.mimetype,
      extractedText,
      imageWidth,
      imageHeight,
      pdfPageCount,
      indexedText
    );
    await db.close();
    res.json({
      id: result.lastID,
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      extracted_text: extractedText,
      image_width: imageWidth,
      image_height: imageHeight,
      pdf_page_count: pdfPageCount,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save file metadata', details: (err as Error).message });
  }
});

// GET /api/documents
router.get('/', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const docs = await db.all('SELECT * FROM documents ORDER BY upload_date DESC');
    await db.close();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents', details: (err as Error).message });
  }
});

// POST /api/documents/:id/analyze
router.post('/:id/analyze', async (req: Request, res: Response) => {
  const docId = req.params.id;
  try {
    const db = await getDb();
    const doc = await db.get('SELECT * FROM documents WHERE id = ?', docId);
    if (!doc) {
      await db.close();
      return res.status(404).json({ error: 'Document not found' });
    }
    if (!(doc.mime_type === 'image/jpeg' || doc.mime_type === 'image/png')) {
      await db.close();
      return res.status(400).json({ error: 'OCR can only be re-run on images' });
    }
    // Run Tesseract.js on the server
    const result = await Tesseract.recognize(doc.file_path, 'eng', { logger: () => {} });
    const ocrText = ((result as any).data.text && (result as any).data.text.trim()) ? (result as any).data.text : 'No text found';
    const indexedText = ocrText.toLowerCase().replace(/\s+/g, ' ').trim();
    await db.run('UPDATE documents SET extracted_text = ?, indexed_text = ? WHERE id = ?', ocrText, indexedText, docId);
    await db.close();
    res.json({ extracted_text: ocrText });
  } catch (err) {
    res.status(500).json({ error: 'Failed to re-run OCR', details: (err as Error).message });
  }
});

export default router; 