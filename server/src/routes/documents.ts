import express, { Request, Response } from "express";
import multer, { FileFilterCallback, StorageEngine } from "multer";
import path from "path";
import fs from "fs";
import { getDb } from "../models/db";
import sharp from "sharp";
const pdfParse = require("pdf-parse");
import { analyzeWithOllama } from "../services/ollamaService";
import { spawn } from "child_process";
import fse from "fs-extra";
import {
  ocrPdfHandwritten,
  processHandwrittenImage,
} from "../services/handwriteenAnalysis";

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage config
const storage: StorageEngine = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: any) => {
    cb(null, uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: any) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

// In-memory job tracking
const bulkJobs: Record<
  string,
  { total: number; done: number; aiDone: number; docIds: number[] }
> = {};

// Simple background AI analysis worker
async function processBulkAI(jobId: string) {
  const job = bulkJobs[jobId];
  if (!job) return;
  // Fetch all known categories
  let categories: string[] = [];
  try {
    const db = await getDb();
    const rows = await db.all(
      'SELECT DISTINCT ai_classification FROM documents WHERE ai_classification IS NOT NULL AND ai_classification != ""',
    );
    await db.close();
    categories = rows.map((r: any) => r.ai_classification).filter(Boolean);
  } catch {}
  for (const docId of job.docIds) {
    try {
      // Fetch doc for indexed_text
      const db = await getDb();
      const doc = await db.get("SELECT * FROM documents WHERE id = ?", docId);
      await db.close();
      if (doc && doc.indexed_text && doc.indexed_text.trim()) {
        await fetch(
          `${process.env.API_URL || "http://localhost:3001/api"}/documents/${docId}/analyze/ai`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              categories.length > 0 ? { categories } : undefined,
            ),
          },
        );
      }
      job.aiDone++;
    } catch {
      job.aiDone++;
    }
  }
}

// Helper: OCR for PDF (extract images or text)
async function ocrPdf(filePath: string, handwritten = false) {
  const pdfParse = require("pdf-parse");
  const fs = require("fs");
  const Tesseract = require("tesseract.js");
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);
  // If text is present, return it
  if (pdfData.text && pdfData.text.trim().length > 10) {
    return pdfData.text;
  }
  // Otherwise, try to extract images and run OCR (not implemented here, fallback)
  // For now, just return the text
  return pdfData.text || "";
}

// POST /api/documents/bulk-upload
router.post(
  "/bulk-upload",
  upload.array("files", 100),
  async (req: Request, res: Response) => {
    const files = (req as Request & { files?: Express.Multer.File[] }).files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    bulkJobs[jobId] = { total: files.length, done: 0, aiDone: 0, docIds: [] };
    // Parse ocr_texts JSON if present
    let ocrTexts: Record<string, string> = {};
    if (req.body.ocr_texts) {
      try {
        ocrTexts = JSON.parse(req.body.ocr_texts);
      } catch {}
    }
    for (const file of files) {
      let extractedText: string | null = null;
      let imageWidth: number | null = null;
      let imageHeight: number | null = null;
      let pdfPageCount: number | null = null;
      let indexedText: string | null = null;
      try {
        if (
          (file.mimetype === "image/jpeg" || file.mimetype === "image/png") &&
          ocrTexts[file.originalname]
        ) {
          extractedText = ocrTexts[file.originalname];
        } else if (file.mimetype === "text/plain") {
          extractedText = fs.readFileSync(file.path, "utf-8");
        } else if (file.mimetype === "application/pdf") {
          const dataBuffer = fs.readFileSync(file.path);
          const pdfData = await pdfParse(dataBuffer);
          extractedText = pdfData.text;
          pdfPageCount = pdfData.numpages;
        } else if (
          file.mimetype === "image/jpeg" ||
          file.mimetype === "image/png"
        ) {
          extractedText = null;
        }
        if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
          const image = sharp(file.path);
          const metadata = await image.metadata();
          imageWidth = metadata.width || null;
          imageHeight = metadata.height || null;
        }
      } catch {}
      if (extractedText) {
        indexedText = extractedText.toLowerCase().replace(/\s+/g, " ").trim();
      }
      try {
        const db = await getDb();
        const result = await db.run(
          `INSERT INTO documents (filename, original_name, file_path, file_size, mime_type, extracted_text, image_width, image_height, pdf_page_count, indexed_text, folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          file.filename,
          file.originalname,
          file.path,
          file.size,
          file.mimetype,
          extractedText,
          imageWidth ?? null,
          imageHeight ?? null,
          pdfPageCount ?? null,
          indexedText,
          (file as any).folder || req.body.folder || null,
        );
        await db.close();
        // Only push lastID if it is a number
        if (typeof result.lastID === "number") {
          bulkJobs[jobId].docIds.push(result.lastID);
        }
        bulkJobs[jobId].done++;
      } catch {
        bulkJobs[jobId].done++;
      }
    }
    // Start background AI analysis
    processBulkAI(jobId);
    res.json({ jobId, total: files.length });
  },
);

// GET /api/documents/bulk-progress/:jobId
router.get("/bulk-progress/:jobId", (req: Request, res: Response) => {
  const job = bulkJobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ total: job.total, uploaded: job.done, aiAnalyzed: job.aiDone });
});

// POST /api/documents/upload
router.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    let extractedText: string | null = null;
    let imageWidth: number | null = null;
    let imageHeight: number | null = null;
    let pdfPageCount: number | null = null;
    let indexedText: string | null = null;

    try {
      if (
        (file.mimetype === "image/jpeg" || file.mimetype === "image/png") &&
        req.body.ocr_text
      ) {
        extractedText = req.body.ocr_text;
      } else if (file.mimetype === "text/plain") {
        extractedText = fs.readFileSync(file.path, "utf-8");
      } else if (file.mimetype === "application/pdf") {
        const dataBuffer = fs.readFileSync(file.path);
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text;
        pdfPageCount = pdfData.numpages;
      } else if (
        file.mimetype === "image/jpeg" ||
        file.mimetype === "image/png"
      ) {
        // fallback: no OCR text provided
        extractedText = null;
      }
      if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
        const image = sharp(file.path);
        const metadata = await image.metadata();
        imageWidth = metadata.width || null;
        imageHeight = metadata.height || null;
      }
    } catch (e) {
      // Ignore extraction errors, store what we can
    }

    if (extractedText) {
      indexedText = extractedText.toLowerCase().replace(/\s+/g, " ").trim();
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
        indexedText,
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
      res.status(500).json({
        error: "Failed to save file metadata",
        details: (err as Error).message,
      });
    }
  },
);

// GET /api/documents/folders - list all unique folders
router.get("/folders", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.all(
      'SELECT DISTINCT folder FROM documents WHERE folder IS NOT NULL AND folder != "" ORDER BY folder ASC',
    );
    await db.close();
    const folders = rows.map((r: any) => r.folder);
    res.json(folders);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch folders",
      details: (err as Error).message,
    });
  }
});

// GET /api/documents/by-folder/:folder - list documents in a folder
router.get("/by-folder/:folder", async (req: Request, res: Response) => {
  const folder = req.params.folder;
  try {
    const db = await getDb();
    const docs = await db.all(
      "SELECT * FROM documents WHERE folder = ? ORDER BY upload_date DESC",
      folder,
    );
    await db.close();
    res.json(docs);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch documents by folder",
      details: (err as Error).message,
    });
  }
});

// GET /api/documents
router.get("/", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const docs = await db.all(
      "SELECT * FROM documents ORDER BY upload_date DESC",
    );
    await db.close();
    res.json(docs);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch documents",
      details: (err as Error).message,
    });
  }
});

// POST /api/documents/search - powerful full-text and filtered search with pagination
router.post("/search", async (req: Request, res: Response) => {
  const {
    query = "",
    category,
    fileType,
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 10,
  } = req.body;
  let sql = "SELECT * FROM documents WHERE 1=1";
  const params: any[] = [];
  if (query) {
    sql +=
      " AND (original_name LIKE ? OR extracted_text LIKE ? OR ai_classification LIKE ?)";
    const likeQuery = `%${query}%`;
    params.push(likeQuery, likeQuery, likeQuery);
  }
  if (category) {
    sql += " AND ai_classification = ?";
    params.push(category);
  }
  if (fileType) {
    sql += " AND mime_type = ?";
    params.push(fileType);
  }
  if (dateFrom) {
    sql += " AND upload_date >= ?";
    params.push(dateFrom);
  }
  if (dateTo) {
    sql += " AND upload_date <= ?";
    params.push(dateTo);
  }
  const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as count");
  sql += " ORDER BY upload_date DESC LIMIT ? OFFSET ?";
  const offset = (page - 1) * pageSize;
  try {
    const db = await getDb();
    const countRow = await db.get(countSql, ...params);
    const total = countRow.count;
    const docs = await db.all(sql, ...params, pageSize, offset);
    await db.close();
    res.json({ documents: docs, total });
  } catch (err) {
    res.status(500).json({
      error: "Failed to search documents",
      details: (err as Error).message,
    });
  }
});

// POST /api/documents/:id/analyze (supports images and PDFs)
router.post("/:id/analyze", async (req: Request, res: Response) => {
  const docId = req.params.id;
  try {
    const db = await getDb();
    const doc = await db.get("SELECT * FROM documents WHERE id = ?", docId);
    if (!doc) {
      await db.close();
      return res.status(404).json({ error: "Document not found" });
    }
    let ocrText = "";
    if (doc.mime_type === "application/pdf") {
      ocrText = await ocrPdf(doc.file_path);
    } else if (
      doc.mime_type === "image/jpeg" ||
      doc.mime_type === "image/png"
    ) {
      const Tesseract = require("tesseract.js");
      const result = await Tesseract.recognize(doc.file_path, "eng", {
        logger: () => {},
      });
      ocrText =
        result.data.text && result.data.text.trim()
          ? result.data.text
          : "No text found";
    } else {
      await db.close();
      return res
        .status(400)
        .json({ error: "OCR can only be re-run on images or PDFs" });
    }
    const indexedText = ocrText.toLowerCase().replace(/\s+/g, " ").trim();
    await db.run(
      "UPDATE documents SET extracted_text = ?, indexed_text = ? WHERE id = ?",
      ocrText,
      indexedText,
      docId,
    );
    await db.close();
    res.json({ extracted_text: ocrText });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to re-run OCR", details: (err as Error).message });
  }
});

// handwritten OCR re-run endpoint
router.post("/:id/analyze/handwritten", async (req: Request, res: Response) => {
  const docId = req.params.id;
  try {
    const db = await getDb();
    const doc = await db.get("SELECT * FROM documents WHERE id = ?", docId);
    if (!doc) {
      await db.close();
      return res.status(404).json({ error: "Document not found" });
    }

    let ocrText = "";

    // === PDF handling ===
    if (doc.mime_type === "application/pdf") {
      // Convert PDF to high-resolution images first
      ocrText = await ocrPdfHandwritten(doc.file_path);
    }
    // === Image handling ===
    else if (doc.mime_type === "image/jpeg" || doc.mime_type === "image/png") {
      ocrText = await processHandwrittenImage(doc.file_path);
    } else {
      await db.close();
      return res
        .status(400)
        .json({ error: "Handwritten OCR can only be run on images or PDFs" });
    }

    const indexedText = ocrText.toLowerCase().replace(/\s+/g, " ").trim();
    await db.run(
      "UPDATE documents SET extracted_text = ?, indexed_text = ? WHERE id = ?",
      ocrText,
      indexedText,
      docId,
    );
    await db.close();
    res.json({ extracted_text: ocrText });
  } catch (err) {
    console.error("Handwritten OCR error:", err);
    res.status(500).json({
      error: "Failed to re-run handwritten OCR",
      details: (err as Error).message,
    });
  }
});

// POST /api/documents/:id/analyze/ai
router.post("/:id/analyze/ai", async (req: Request, res: Response) => {
  const docId = req.params.id;
  const categories: string[] = Array.isArray(req.body?.categories)
    ? req.body.categories
    : [];
  try {
    const db = await getDb();
    const doc = await db.get("SELECT * FROM documents WHERE id = ?", docId);
    if (!doc) {
      await db.close();
      return res.status(404).json({ error: "Document not found" });
    }
    if (!doc.indexed_text || !doc.indexed_text.trim()) {
      await db.close();
      return res.status(400).json({ error: "No text to analyze" });
    }
    // Prompt for classification and summary, with categories if provided
    let prompt = `Classify the following document and provide a summary.\n\nText:\n${doc.indexed_text}\n\nRespond in JSON with keys: classification, summary.`;
    if (categories.length > 0) {
      prompt = `Classify the following document and provide a summary.\n\nText:\n${doc.indexed_text}\n\nPossible categories: ${categories.join(", ")}\n\nRespond in JSON with keys: classification, summary. Use an existing category if it fits.`;
    }
    const aiResponse = await analyzeWithOllama(prompt);
    let classification = null;
    let summary = null;
    try {
      let cleaned = aiResponse.trim();
      cleaned = cleaned.replace(/^(```json|```|\.json)/i, "").trim();
      cleaned = cleaned.replace(/```$/, "").trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
      let parsed = JSON.parse(cleaned);
      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed);
      }
      classification =
        (parsed.classification || parsed.Classification || "")
          .toString()
          .trim() || null;
      summary =
        (parsed.summary || parsed.Summary || "").toString().trim() || null;
    } catch {
      summary = aiResponse;
    }
    await db.run(
      "UPDATE documents SET ai_classification = ?, ai_summary = ? WHERE id = ?",
      classification,
      summary,
      docId,
    );
    await db.close();
    res.json({ classification, summary, raw: aiResponse });
  } catch (err) {
    res.status(500).json({
      error: "Failed to analyze with AI",
      details: (err as Error).message,
    });
  }
});

// POST /api/documents/:id/classify-donut
router.post("/:id/classify-donut", async (req: Request, res: Response) => {
  const docId = req.params.id;
  try {
    const db = await getDb();
    const doc = await db.get("SELECT * FROM documents WHERE id = ?", docId);
    if (!doc) {
      await db.close();
      return res.status(404).json({ error: "Document not found" });
    }
    const filePath = doc.file_path;
    // Call the Python script
    const py = spawn("python", [
      require("path").resolve(__dirname, "../../donut_classify.py"),
      filePath,
    ]);
    let output = "";
    let error = "";
    py.stdout.on("data", (data) => {
      output += data.toString();
    });
    py.stderr.on("data", (data) => {
      error += data.toString();
    });
    py.on("close", async (code) => {
      if (code === 0 && output.trim()) {
        await db.run(
          "UPDATE documents SET donut_classification = ? WHERE id = ?",
          output.trim(),
          docId,
        );
        await db.close();
        res.json({ donut_classification: output.trim() });
      } else {
        await db.close();
        res.status(500).json({
          error: "Donut classification failed",
          details: error || "No output",
        });
      }
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to run Donut classification",
      details: (err as Error).message,
    });
  }
});

// PATCH /api/documents/:id/category - update document category and move file to new folder
router.patch("/:id/category", async (req: Request, res: Response) => {
  const docId = req.params.id;
  const { category } = req.body;
  if (!category || typeof category !== "string") {
    return res.status(400).json({ error: "Category is required" });
  }
  try {
    const db = await getDb();
    const doc = await db.get("SELECT * FROM documents WHERE id = ?", docId);
    if (!doc) {
      await db.close();
      return res.status(404).json({ error: "Document not found" });
    }
    // Move file to new folder if needed
    const newFolder = category;
    const newFolderPath = path.join(uploadDir, newFolder);
    if (!fs.existsSync(newFolderPath)) {
      fs.mkdirSync(newFolderPath, { recursive: true });
    }
    const newFilePath = path.join(newFolderPath, doc.filename);
    // If file is not already in the right folder, move it
    if (doc.file_path !== newFilePath) {
      await fse.move(doc.file_path, newFilePath, { overwrite: true });
    }
    await db.run(
      "UPDATE documents SET ai_classification = ?, folder = ?, file_path = ? WHERE id = ?",
      category,
      newFolder,
      newFilePath,
      docId,
    );
    await db.close();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      error: "Failed to update category/folder",
      details: (err as Error).message,
    });
  }
});

// DELETE /api/documents/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const docId = req.params.id;
  try {
    const db = await getDb();
    const doc = await db.get("SELECT * FROM documents WHERE id = ?", docId);
    if (!doc) {
      await db.close();
      return res.status(404).json({ error: "Document not found" });
    }
    // Remove file from disk
    try {
      fs.unlinkSync(doc.file_path);
    } catch {}
    await db.run("DELETE FROM documents WHERE id = ?", docId);
    await db.close();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      error: "Failed to delete document",
      details: (err as Error).message,
    });
  }
});

export default router;

