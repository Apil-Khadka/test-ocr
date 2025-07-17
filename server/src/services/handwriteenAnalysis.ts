import sharp from "sharp";
import { createWorker, PSM, OEM } from "tesseract.js";
import { promises as fs } from "fs";
import path from "path";
import { fromPath } from "pdf2pic";

// Utility: check if file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

type OCRConfig = {
  psm?: PSM;
  oem?: OEM;
  whitelist?: string;
};

/**
 * Recognize an image with Tesseract.js using specified config.
 * References: https://github.com/naptha/tesseract.js/blob/main/docs/api.md
 */
async function recognizeWithConfig(
  imagePath: string,
  config: OCRConfig = {},
): Promise<string> {
  const worker = await createWorker();
  try {
    // Initialize with language and engine mode
    await worker.reinitialize("eng", config.oem ?? OEM.DEFAULT);

    // Set page segmentation mode and whitelist
    const params: Record<string, string> = {};
    if (config.psm !== undefined) {
      params.tessedit_pageseg_mode = config.psm.toString();
    }
    if (config.whitelist) {
      params.tessedit_char_whitelist = config.whitelist;
    }
    if (Object.keys(params).length) {
      await worker.setParameters(params);
    }

    const { data } = await worker.recognize(imagePath);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}

/**
 * Preprocess an image for better handwritten recognition.
 */
async function preprocessImage(
  srcPath: string,
  destPath: string,
  options: { width?: number; height?: number; threshold?: number } = {},
): Promise<void> {
  const { width = 2400, height = 3200, threshold = 128 } = options;
  let img = sharp(srcPath)
    .resize({ width, height, fit: "inside", withoutEnlargement: true })
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(threshold);
  await img.toFile(destPath);
}

/**
 * OCR a handwritten image with multiple attempts and return best text.
 */
export async function processHandwrittenImage(
  imagePath: string,
): Promise<string> {
  const prePath = imagePath.replace(/\.(jpg|jpeg|png)$/i, "_pre.png");
  try {
    await preprocessImage(imagePath, prePath);

    const whitelist =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?;:()[]{}\"'-/@#$%^&*+=<>~`|\\_ ";
    const configs: OCRConfig[] = [
      { psm: PSM.SINGLE_BLOCK, oem: OEM.LSTM_ONLY, whitelist },
      { psm: PSM.SINGLE_LINE, oem: OEM.LSTM_ONLY, whitelist },
      { psm: PSM.SINGLE_WORD, oem: OEM.LSTM_ONLY, whitelist },
    ];

    const texts = await Promise.all(
      configs.map((cfg) => recognizeWithConfig(prePath, cfg).catch(() => "")),
    );
    const best = texts.sort((a, b) => b.length - a.length)[0] || "";
    return best || "No text found";
  } finally {
    try {
      await fs.unlink(prePath);
    } catch {}
  }
}

/**
 * Convert PDF to images and OCR each page.
 */
export async function ocrPdfHandwritten(pdfPath: string): Promise<string> {
  const tempDir = path.join(path.dirname(pdfPath), "temp_pdf");
  await fs.mkdir(tempDir, { recursive: true });
  const converter = fromPath(pdfPath, {
    density: 300,
    savePath: tempDir,
    format: "png",
    width: 2400,
    height: 3200,
  });

  const pages = await converter.bulk(-1);
  let result = "";
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (!page || !page.path) continue;
    const img = page.path;
    if (!(await fileExists(img))) continue;
    const text = await processHandwrittenImage(img);
    result += `\n--- Page ${i + 1} ---\n${text}\n`;
    try {
      await fs.unlink(img);
    } catch {}
  }
  await fs.rm(tempDir, { recursive: true, force: true });
  return result.trim();
}

/**
 * Advanced preprocessing with denoise/gamma options.
 */
export async function preprocessHandwrittenImageAdvanced(
  imagePath: string,
  outputPath: string,
  options: { denoise?: boolean; enhance?: boolean; threshold?: number },
): Promise<void> {
  const { denoise = true, enhance = true, threshold = 128 } = options;
  let img = sharp(imagePath).grayscale();
  if (denoise) img = img.median(3);
  if (enhance) img = img.normalize().sharpen().gamma(1.2);
  img = img.threshold(threshold);
  await img.toFile(outputPath);
}

/**
 * Multiple approach pipeline for a single image.
 */
export async function processHandwrittenImageMultipleApproaches(
  imagePath: string,
): Promise<string> {
  const outputs = [] as string[];
  try {
    const main = await processHandwrittenImage(imagePath);
    if (main) outputs.push(main);
  } catch {}
  const strategies = [100, 160];
  for (const thr of strategies) {
    const tmp = imagePath.replace(/\.(jpg|jpeg|png)$/i, `_thr${thr}.png`);
    try {
      await preprocessImage(imagePath, tmp, { threshold: thr });
      const txt = await processHandwrittenImage(tmp);
      if (txt) outputs.push(txt);
      await fs.unlink(tmp);
    } catch {}
  }
  return outputs.sort((a, b) => b.length - a.length)[0] || "";
}

export default {
  processHandwrittenImage,
  ocrPdfHandwritten,
  preprocessHandwrittenImageAdvanced,
  processHandwrittenImageMultipleApproaches,
};
