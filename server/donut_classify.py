import sys
import os
from PIL import Image
from transformers import DonutProcessor, VisionEncoderDecoderModel

def pdf_to_image(pdf_path):
    from pdf2image import convert_from_path
    images = convert_from_path(pdf_path, first_page=1, last_page=1)
    return images[0] if images else None

def classify_with_donut(file_path):
    processor = DonutProcessor.from_pretrained("naver-clova-ix/donut-base-finetuned-rvlcdip")
    model = VisionEncoderDecoderModel.from_pretrained("naver-clova-ix/donut-base-finetuned-rvlcdip")

    # Determine if file is image or PDF
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.pdf':
        image = pdf_to_image(file_path)
        if image is None:
            print("ERROR: Could not convert PDF to image", file=sys.stderr)
            sys.exit(1)
    else:
        image = Image.open(file_path).convert("RGB")

    pixel_values = processor(image, return_tensors="pt").pixel_values
    outputs = model.generate(pixel_values)
    decoded = processor.batch_decode(outputs, skip_special_tokens=True)[0]
    print(decoded)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <image_or_pdf_path>", file=sys.stderr)
        sys.exit(1)
    classify_with_donut(sys.argv[1]) 