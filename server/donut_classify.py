#!/usr/bin/env python3
import sys
import os
from PIL import Image
import torch
from transformers import DonutProcessor, VisionEncoderDecoderModel

# 1) Force CPU‑only
device = torch.device("cpu")

# 2) Load once, with fast tokenizer
processor = DonutProcessor.from_pretrained(
    "naver-clova-ix/donut-base-finetuned-rvlcdip",
    use_fast=True
)
model = VisionEncoderDecoderModel.from_pretrained(
    "naver-clova-ix/donut-base-finetuned-rvlcdip"
).to(device)

# Grab the only token you really need to set: the decoder start token.
decoder_start_token_id = processor.tokenizer.cls_token_id

def pdf_to_images(path):
    from pdf2image import convert_from_path
    # you can add dpi=200 here if text is tiny
    return convert_from_path(path)

def tesseract_fallback(image):
    try:
        import pytesseract
        return pytesseract.image_to_string(image)
    except ImportError:
        return "(install pytesseract for fallback)"

def classify(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        try:
            pages = pdf_to_images(path)
        except Exception as e:
            print(f"ERROR converting PDF → images: {e}", file=sys.stderr)
            return
    else:
        try:
            pages = [Image.open(path).convert("RGB")]
        except Exception as e:
            print(f"ERROR opening image: {e}", file=sys.stderr)
            return

    for i, img in enumerate(pages, 1):
        print(f"\n--- Page {i}/{len(pages)} ---")
        pix = processor(img, return_tensors="pt").pixel_values.to(device)

        # 3) Minimal, greedy generate
        try:
            outputs = model.generate(
                pix,
                decoder_start_token_id=decoder_start_token_id,
                max_new_tokens=512,
                num_beams=1,           # greedy search
                use_cache=False        # avoid any past_key_values logic
            )
        except Exception as gen_err:
            print(f"❌ Donut generate failed: {gen_err}", file=sys.stderr)
            print("→ Tesseract fallback:", tesseract_fallback(img))
            continue

        # 4) Decode raw and then to JSON
        raw = processor.batch_decode(outputs, skip_special_tokens=False)[0]
        print("→ Raw:", raw)
        try:
            parsed = processor.token2json(raw)
            print("→ Parsed JSON/text:", parsed)
        except Exception:
            decoded = processor.batch_decode(outputs, skip_special_tokens=True)[0]
            print("→ Decoded text fallback:", decoded)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {os.path.basename(__file__)} <image_or_pdf>", file=sys.stderr)
        sys.exit(1)
    classify(sys.argv[1])
