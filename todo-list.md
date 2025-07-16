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

- [ ] Bulk Folder Import & Background AI Analysis
  - [ ] Backend: Import all files from a folder, extract metadata, OCR, and save
  - [ ] Backend: Run AI analysis in background for each document
  - [ ] Backend: Track and expose progress for bulk analysis
  - [ ] Frontend: Allow folder upload or selection
  - [ ] Frontend: Show progress bar for bulk analysis
  - [ ] Frontend: Display results as processed

- [ ] Folder-like Navigation
  - [ ] Store folder/path for each document
  - [ ] Backend: List folders and documents by folder
  - [ ] Frontend: Sidebar/tree for folder navigation
  - [ ] Frontend: Display documents by folder

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

- Core document upload, preview, OCR, and AI classification are complete.
- Next: Bulk folder import, background AI analysis with progress, and folder navigation.
- Update this file as features are completed or added.
- Use checkboxes to indicate status. 