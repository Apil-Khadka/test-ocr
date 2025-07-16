import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads');

// GET /files/:filename
router.get('/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = path.join(uploadDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(filePath);
});

export default router;
