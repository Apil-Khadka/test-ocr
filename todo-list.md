# Document Intelligence App - TODO List

This file tracks the progress of main features for the Document Intelligence App. Authentication is omitted for testing purposes.

## Features

- [x] Backend project initialized and Express server setup
- [x] Backend file upload endpoint implemented
- [x] Backend file metadata storage in SQLite
- [x] Drag-and-drop file upload interface (frontend)
- [x] File preview functionality (frontend)
- [x] Basic file metadata extraction (text preview)
- [x] Document Upload & Management
  - [x] Support for PDF, images (JPG, PNG), and text files
  - [x] Delete uploaded documents

- [x] AI-Powered Document Analysis
  - [x] OCR text extraction from images using Tesseract.js
  - [x] Local AI (Ollama) integration for:
    - [x] Document classification (Invoice, Contract, Report, etc.)
    - [x] Document summarization
  - [ ] Key information extraction
  - [ ] Suggested folder categories

- [x] Bulk Folder Import & Background AI Analysis
  - [x] Backend: Import all files from a folder, extract metadata, OCR, and save
  - [x] Backend: Run AI analysis in background for each document
  - [x] Backend: Track and expose progress for bulk analysis
  - [x] Frontend: Allow folder upload or selection
  - [x] Frontend: Show progress bar for bulk analysis
  - [x] Frontend: Display results as processed
  - [x] Frontend: Queue performs OCR on each file after folder selection, before uploading to backend (OCR is now saved on bulk upload)

- [x] Folder-like Navigation
  - [x] Store folder/path for each document (now set to category name)
  - [x] Backend: List folders and documents by folder
  - [x] Frontend: Sidebar/tree for folder navigation (by category)
  - [x] Frontend: Display documents by folder (category)

- [x] Smart Categorization
  - [x] AI-suggested categories based on document content
  - [x] User-defined custom categories (editable in UI)
  - [x] Auto-filing based on document type (category)
  - [x] Tag system for better organization (category = folder)
  - [x] Files are moved to category-named folders and served from any subfolder

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

- Core document upload, preview, OCR, AI classification, smart categorization, and smart foldering are complete.
- Files are now moved to category-named folders and served from any subfolder.
- Next: Search & Retrieval (full-text search, filters, recent docs).
- Update this file as features are completed or added.
- Use checkboxes to indicate status. 