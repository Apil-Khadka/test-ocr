#!/usr/bin/env python3
import sys
import os
import argparse
from PIL import Image
import torch
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

def load_image_or_pdf(source: str):
    """
    Load an image from a local path, URL, or convert a PDF to a list of images.
    Returns a list of PIL Images.
    """
    images = []
    # PDF handling
    if source.lower().endswith('.pdf'):
        try:
            from pdf2image import convert_from_path
        except ImportError:
            print("ERROR: pdf2image not installed. Run 'pip install pdf2image'", file=sys.stderr)
            sys.exit(1)
        try:
            pages = convert_from_path(source)
            images.extend(pages)
        except Exception as e:
            print(f"ERROR: Could not convert PDF '{source}' to images: {e}", file=sys.stderr)
            sys.exit(1)
    # URL handling
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
    # Local image file
    else:
        try:
            img = Image.open(source).convert('RGB')
            images.append(img)
        except Exception as e:
            print(f"ERROR: Could not open image file '{source}': {e}", file=sys.stderr)
            sys.exit(1)
    return images

def main():
    parser = argparse.ArgumentParser(
        description="Handwritten OCR with TrOCR (microsoft/trocr-base-handwritten) and PDF support"
    )
    parser.add_argument(
        "source",
        help="Path to a local image file or PDF, or an HTTP/HTTPS URL"
    )
    parser.add_argument(
        "--device", choices=["cpu", "cuda"], default=None,
        help="Force device: cpu or cuda (default: auto)"
    )
    args = parser.parse_args()

    # Device setup
    if args.device:
        device = torch.device(args.device)
    else:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}", file=sys.stderr)

    # Load processor and model
    processor = TrOCRProcessor.from_pretrained(
        'microsoft/trocr-base-printed',
        use_fast=True
    )
    model = VisionEncoderDecoderModel.from_pretrained(
        'microsoft/trocr-base-printed'
    ).to(device)

    # Load images (or PDF pages)
    images = load_image_or_pdf(args.source)

    # Process each image
    for idx, img in enumerate(images, start=1):
        print(f"\n--- Page {idx}/{len(images)} ---")
        pix = processor(images=img, return_tensors='pt').pixel_values.to(device)
        try:
            generated_ids = model.generate(
                pix,
                max_new_tokens=512,
                num_beams=1,
                use_cache=False
            )
        except Exception as e:
            print(f"ERROR during generation on page {idx}: {e}", file=sys.stderr)
            continue
        # Decode
        text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        print(text)

if __name__ == '__main__':
    main()