import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import Tesseract from 'tesseract.js';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const FileUpload: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
            <div className="h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 bg-blue-500 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Uploading... {progress}%</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload; 