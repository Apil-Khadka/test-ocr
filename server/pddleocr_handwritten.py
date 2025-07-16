#!/usr/bin/env python3
import sys
import os
import argparse
from PIL import Image

# For PDF to image
try:
    from pdf2image import convert_from_path
except ImportError:
    convert_from_path = None

# For PaddleOCR
from paddleocr import PaddleOCR


def load_images_from_source(source: str):
    """
    Load images from a file path (PDF or image) or URL.
    Returns a list of PIL images.
    """
    images = []

    # PDF
    if source.lower().endswith('.pdf'):
        if convert_from_path is None:
            print("ERROR: pdf2image not installed. Run 'pip install pdf2image'", file=sys.stderr)
            sys.exit(1)
        try:
            pages = convert_from_path(source)
            images.extend(pages)
        except Exception as e:
            print(f"ERROR: Could not convert PDF '{source}' to images: {e}", file=sys.stderr)
            sys.exit(1)

    # URL
    elif source.startswith(('http://', 'https://')) and not source.lower().endswith('.pdf'):
        try:
            import requests
            resp = requests.get(source, stream=True)
            resp.raise_for_status()
            img = Image.open(resp.raw).convert('RGB')
            images.append(img)
        except Exception as e:
            print(f"ERROR: Could not load image from URL '{source}': {e}", file=sys.stderr)
            sys.exit(1)

    # Local image
    else:
        try:
            img = Image.open(source).convert('RGB')
            images.append(img)
        except Exception as e:
            print(f"ERROR: Could not open image file '{source}': {e}", file=sys.stderr)
            sys.exit(1)

    return images


def run_paddleocr_on_images(images, output_prefix='output', lang='en'):
    ocr = PaddleOCR(
        use_angle_cls=True,
        lang=lang
    )

    for idx, img in enumerate(images, start=1):
        print(f"\n--- Page {idx}/{len(images)} ---")
        temp_path = f"/tmp/_ocr_temp_{idx}.png"
        img.save(temp_path)

        result = ocr.ocr(temp_path)

        # Print OCR results
        full_text = ""
        for line in result[0]:
            text = line[1][0]
            full_text += text + "\n"
        print(full_text.strip())

        # Optionally save JSON output
        # Could extend with json.dump if needed

        os.remove(temp_path)


def main():
    parser = argparse.ArgumentParser(description="OCR handwritten/printed text using PaddleOCR with PDF/image input support")
    parser.add_argument("source", help="Path to image, PDF, or image URL")
    args = parser.parse_args()

    images = load_images_from_source(args.source)
    run_paddleocr_on_images(images)


if __name__ == '__main__':
    main()

