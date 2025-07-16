import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import Tesseract from 'tesseract.js';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const FileUpload: React.FC<{ onBulkUpload?: () => void }> = ({ onBulkUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ total: number; done: number }>({ total: 0, done: 0 });
  const [fileStatuses, setFileStatuses] = useState<{ name: string; ocr: number; upload: number; status: string; ocrText?: string }[]>([]);

  // Helper to update status for a file
  const updateFileStatus = (idx: number, update: Partial<{ ocr: number; upload: number; status: string; ocrText?: string }>) => {
    setFileStatuses(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...update };
      return next;
    });
  };

  const runOcr = async (file: File) => {
    setOcrProgress(0);
    setOcrText(null);
    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: (m: { status: string; progress?: number }) => {
          if (m.status === 'recognizing text' && m.progress) {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });
      const text = (result as any).data.text;
      setOcrText(text && text.trim() ? text : 'No text found');
    } catch (err) {
      setOcrText('OCR failed.');
    }
  };

  // Bulk folder upload handler with backend integration and progress polling
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBulkProgress({ total: files.length, done: 0 });
    setUploading(true);
    setFileStatuses(Array.from(files).map(f => ({ name: f.name, ocr: 0, upload: 0, status: 'pending' })));

    // Run OCR on images before upload
    const ocrTexts: Record<string, string> = {};
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type === 'image/jpeg' || file.type === 'image/png') {
        updateFileStatus(i, { status: 'ocr' });
        try {
          const result = await Tesseract.recognize(file, 'eng', {
            logger: (m: { status: string; progress?: number }) => {
              if (m.status === 'recognizing text' && m.progress) {
                updateFileStatus(i, { ocr: Math.round(m.progress * 100) });
              }
            },
          });
          const ocrText = (result as any).data.text?.trim() || '';
          ocrTexts[file.name] = ocrText;
          updateFileStatus(i, { ocr: 100, ocrText, status: 'pending' });
        } catch {
          updateFileStatus(i, { ocr: 100, ocrText: 'OCR failed.', status: 'pending' });
        }
      } else {
        updateFileStatus(i, { ocr: 100, status: 'pending' });
      }
    }

    // Prepare FormData for bulk upload
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });
    formData.append('ocr_texts', JSON.stringify(ocrTexts));

    // Send all files in one request
    let jobId: string | null = null;
    try {
      const response = await axios.post(`${API_URL}/documents/bulk-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      jobId = response.data.jobId;
      setBulkProgress({ total: response.data.total, done: 0 });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Bulk upload failed');
      setUploading(false);
      return;
    }

    // Poll progress endpoint
    if (jobId) {
      let polling = true;
      const poll = async () => {
        try {
          const res = await axios.get(`${API_URL}/documents/bulk-progress/${jobId}`);
          setBulkProgress({ total: res.data.total, done: res.data.uploaded });
          // Optionally, show AI progress as well
          setFileStatuses((prev) => prev.map((f, idx) => {
            if (idx < res.data.uploaded) {
              return { ...f, status: 'uploaded' };
            }
            return f;
          }));
          if (res.data.uploaded < res.data.total || res.data.aiAnalyzed < res.data.total) {
            setTimeout(poll, 1000);
          } else {
            polling = false;
            setUploading(false);
            toast.success('Bulk upload and AI analysis complete!');
            if (onBulkUpload) onBulkUpload();
          }
        } catch {
          setTimeout(poll, 2000);
        }
      };
      poll();
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    const file = acceptedFiles[0];
    setSelectedFile(file);
    setOcrText(null);
    setOcrProgress(0);
    let ocrTextToSend: string | null = null;
    // If image, run OCR first
    if (file.type === 'image/jpeg' || file.type === 'image/png') {
      await runOcr(file);
      // Wait for OCR to finish and get the text
      const result = await Tesseract.recognize(file, 'eng', {
        logger: () => {},
      });
      const text = (result as any).data.text;
      ocrTextToSend = text && text.trim() ? text : '';
    }
    setUploading(true);
    setProgress(0);
    const formData = new FormData();
    formData.append('file', file);
    if (ocrTextToSend !== null) {
      formData.append('ocr_text', ocrTextToSend);
    }
    try {
      await axios.post(`${API_URL}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (event.total) {
            setProgress(Math.round((event.loaded * 100) / event.total));
          }
        },
      });
      toast.success('File uploaded successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
      setSelectedFile(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'text/plain': ['.txt'],
    },
  });

  return (
    <div className="w-full max-w-md mx-auto mt-10">
      <Toaster />
      <div className="mb-4">
        <label className="block mb-2 font-medium">Bulk Upload Folder</label>
        <input
          type="file"
          multiple
          // @ts-ignore
          webkitdirectory
          onChange={handleFolderUpload}
          className="block border rounded px-2 py-1 text-sm"
          disabled={uploading}
        />
        {bulkProgress.total > 0 && (
          <div className="mt-2 text-xs text-gray-700">
            Uploading: {bulkProgress.done}/{bulkProgress.total}
          </div>
        )}
        {fileStatuses.length > 0 && (
          <div className="mt-2 space-y-1">
            {fileStatuses.map((f, idx) => (
              <div key={idx} className="text-xs flex flex-col border-b pb-1">
                <span><strong>{f.name}</strong> - {f.status === 'ocr' ? `OCR: ${f.ocr}%` : f.status === 'upload' ? `Uploading: ${f.upload}%` : f.status === 'done' ? 'Done' : f.status === 'failed' ? 'Failed' : 'Pending'}</span>
                {f.ocrText && f.ocrText !== '' && f.ocrText !== 'OCR failed.' && (
                  <span className="text-gray-500">OCR: {f.ocrText.slice(0, 60)}{f.ocrText.length > 60 ? '...' : ''}</span>
                )}
                {f.ocrText === 'OCR failed.' && <span className="text-red-500">OCR failed</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center transition-colors duration-200 ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
        }`}
        style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}
      >
        <input {...getInputProps()} disabled={uploading} />
        <p className="text-lg font-medium text-gray-700">
          {isDragActive ? 'Drop the file here ...' : 'Drag & drop a file here, or click to select'}
        </p>
        <p className="text-sm text-gray-500 mt-2">PDF, JPG, PNG, TXT (max 10MB)</p>
        {selectedFile && (selectedFile.type === 'image/jpeg' || selectedFile.type === 'image/png') && (
          <div className="w-full mt-4">
            <p className="text-xs text-gray-600 mb-1">Running OCR on image...</p>
            <div className="h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 bg-green-500 rounded-full transition-all duration-200"
                style={{ width: `${ocrProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">OCR Progress: {ocrProgress}%</p>
            {ocrText && (
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-700 max-h-32 overflow-y-auto">
                <strong>OCR Result:</strong>
                <div className="whitespace-pre-wrap">{ocrText}</div>
              </div>
            )}
          </div>
        )}
        {uploading && (
          <div className="w-full mt-4">
            <div className="h-2 bg-blue-500 rounded-full transition-all duration-200" style={{ width: `${progress}%` }}></div>
            <p className="text-xs text-gray-500 mt-1">Uploading... {progress}%</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;