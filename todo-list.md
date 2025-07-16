# Document Intelligence App - TODO List

This file tracks the progress of main features for the Document Intelligence App. Authentication is omitted for testing purposes.

## Features

- [x] Backend project initialized and Express server setup
- [x] Backend file upload endpoint implemented
- [x] Backend file metadata storage in SQLite
- [x] Drag-and-drop file upload interface (frontend)
- [x] File preview functionality (frontend)
- [x] Basic file metadata extraction (text preview)
- [ ] Document Upload & Management
  - [ ] Support for PDF, images (JPG, PNG), and text files

- [ ] AI-Powered Document Analysis
  - [ ] OCR text extraction from images using Tesseract.js
  - [ ] OpenAI API integration for:
    - [ ] Document classification (Invoice, Contract, Report, etc.)
    - [ ] Key information extraction
    - [ ] Document summarization
    - [ ] Suggested folder categories

- [ ] Smart Categorization
  - [ ] AI-suggested categories based on document content
  - [ ] User-defined custom categories
  - [ ] Auto-filing based on document type
  - [ ] Tag system for better organization

- [ ] Search & Retrieval
  - [ ] Full-text search across all documents
  - [ ] Filter by category, date, file type
  - [ ] Search within document content
  - [ ] Recently accessed documents

- [ ] Dashboard & Analytics
  - [ ] Document count by category
  - [ ] Upload trends
  - [ ] Storage usage
  - [ ] Quick access to recent documents

## Progress Notes

- Backend project initialized and Express server running.
- Backend file upload endpoint is live for testing at POST /api/documents/upload.
- Backend file metadata is now stored in SQLite after upload.
- Frontend drag-and-drop file upload UI implemented and ready for testing.
- Document listing and preview available in the frontend.
- Extracted text for text files is now shown in the frontend document list.
- Update this file as features are completed or added.
- Use checkboxes to indicate status. 