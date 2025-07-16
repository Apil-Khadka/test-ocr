import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads');

// Helper to recursively find a file by name in a directory
function findFileRecursive(dir: string, filename: string): string | null {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFileRecursive(fullPath, filename);
      if (found) return found;
    } else if (entry.isFile() && entry.name === filename) {
      return fullPath;
    }
  }
  return null;
}

// GET /files/:filename
router.get('/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = findFileRecursive(uploadDir, filename);
  if (!filePath) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(filePath);
});

export default router;
