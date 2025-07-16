import React, { useEffect, useState, useRef } from 'react';
import { fetchDocuments, analyzeDocumentAI, deleteDocument, classifyDocumentDonut } from '../services/api';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Document {
  id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  upload_date: string;
  extracted_text?: string;
  image_width?: number;
  image_height?: number;
  pdf_page_count?: number;
  ai_classification?: string;
  ai_summary?: string;
  donut_classification?: string;
}

const getFileUrl = (filename: string) => `${process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:3001'}/files/${filename}`;

const DocumentList: React.FC = () => {
  const [ocrQueue, setOcrQueue] = useState<number[]>([]);
  const [aiQueue, setAiQueue] = useState<number[]>([]);
  const [processingOcr, setProcessingOcr] = useState<number | null>(null);
  const [processingAi, setProcessingAi] = useState<number | null>(null);
  const [docStatus, setDocStatus] = useState<Record<number, string>>({});
  const [bulkProgress, setBulkProgress] = useState<{ total: number; done: number }>({ total: 0, done: 0 });
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState<string>('');
  const [modalTitle, setModalTitle] = useState<string>('');
  const [ocrLoadingId, setOcrLoadingId] = useState<number | null>(null);
  const [aiLoadingId, setAiLoadingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [donutQueue, setDonutQueue] = useState<number[]>([]);
  const [processingDonut, setProcessingDonut] = useState<number | null>(null);

  useEffect(() => {
    fetchDocuments()
      .then(setDocuments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const openModal = (title: string, text: string) => {
    setModalTitle(title);
    setModalText(text);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalText('');
    setModalTitle('');
  };

  // Helper to update status
  const updateStatus = (id: number, status: string) => setDocStatus(s => ({ ...s, [id]: status }));

  // OCR queue processor
  useEffect(() => {
    if (processingOcr || ocrQueue.length === 0) return;
    const nextId = ocrQueue[0];
    setProcessingOcr(nextId);
    updateStatus(nextId, 'ocr-processing');
    axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/documents/${nextId}/analyze`)
      .then(() => {
        updateStatus(nextId, 'ocr-done');
        setBulkProgress(p => ({ ...p, done: p.done + 1 }));
      })
      .catch(() => {
        updateStatus(nextId, 'ocr-failed');
      })
      .finally(() => {
        setOcrQueue(q => q.slice(1));
        setProcessingOcr(null);
      });
  }, [ocrQueue, processingOcr]);

  // AI queue processor
  useEffect(() => {
    if (processingAi || aiQueue.length === 0) return;
    const nextId = aiQueue[0];
    setProcessingAi(nextId);
    updateStatus(nextId, 'ai-processing');
    analyzeDocumentAI(nextId)
      .then(async (res) => {
        // If classification is null, retry once with categories
        if (!res.classification) {
          // Fetch current categories
          const cats = Array.from(new Set(documents.map(d => d.ai_classification).filter((c): c is string => Boolean(c))));
          await analyzeDocumentAI(nextId, cats);
        }
        updateStatus(nextId, 'ai-done');
        setBulkProgress(p => ({ ...p, done: p.done + 1 }));
      })
      .catch(() => {
        updateStatus(nextId, 'ai-failed');
      })
      .finally(() => {
        setAiQueue(q => q.slice(1));
        setProcessingAi(null);
      });
  }, [aiQueue, processingAi, documents]);

  // Donut queue processor
  useEffect(() => {
    if (processingDonut || donutQueue.length === 0) return;
    const nextId = donutQueue[0];
    setProcessingDonut(nextId);
    updateStatus(nextId, 'donut-processing');
    classifyDocumentDonut(nextId)
      .then(() => {
        updateStatus(nextId, 'donut-done');
        setBulkProgress(p => ({ ...p, done: p.done + 1 }));
      })
      .catch(() => {
        updateStatus(nextId, 'donut-failed');
      })
      .finally(() => {
        setDonutQueue(q => q.slice(1));
        setProcessingDonut(null);
      });
  }, [donutQueue, processingDonut]);

  // Bulk progress bar
  const showBulkProgress = bulkProgress.total > 0 && bulkProgress.done < bulkProgress.total;

  // User triggers re-OCR
  const queueOcr = (id: number) => {
    setOcrQueue(q => q.includes(id) ? q : [...q, id]);
    setBulkProgress(p => ({ total: p.total + 1, done: p.done }));
  };

  // User triggers re-AI
  const queueAi = (id: number) => {
    setAiQueue(q => q.includes(id) ? q : [...q, id]);
    setBulkProgress(p => ({ total: p.total + 1, done: p.done }));
  };

  // User triggers Donut classification
  const queueDonut = (id: number) => {
    setDonutQueue(q => q.includes(id) ? q : [...q, id]);
    setBulkProgress(p => ({ total: p.total + 1, done: p.done }));
  };

  const handleDelete = async (doc: Document) => {
    if (!window.confirm(`Delete document "${doc.original_name}"?`)) return;
    try {
      await deleteDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success('Document deleted');
    } catch {
      toast.error('Failed to delete document');
    }
  };

  const classifications = Array.from(new Set(documents.map(d => d.ai_classification).filter(Boolean)));
  const filteredDocs = filter ? documents.filter(d => d.ai_classification === filter) : documents;

  if (loading) return <div className="text-center mt-8">Loading documents...</div>;
  if (error) return <div className="text-center text-red-500 mt-8">{error}</div>;

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <h2 className="text-xl font-semibold mb-4">Uploaded Documents</h2>
      {classifications.length > 0 && (
        <div className="mb-4 flex gap-2 items-center">
          <span className="text-sm">Filter by classification:</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="">All</option>
            {classifications.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}
      {showBulkProgress && (
        <div className="mb-4 bg-blue-100 border border-blue-200 text-blue-800 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Processing in background:</strong>
          <span className="block sm:inline"> {bulkProgress.done}/{bulkProgress.total} documents</span>
          <span className="absolute top-0 bottom-0 right-0 px-4 py-3">
            <svg className="fill-current h-6 w-6 text-blue-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M10 15a1 1 0 01-.707-.293l-4-4a1 1 0 111.414-1.414L9 12.586V3a1 1 0 112 0v9.586l3.293-3.293a1 1 0 011.414 1.414l-4 4A1 1 0 0110 15z"/></svg>
          </span>
        </div>
      )}
      {filteredDocs.length === 0 ? (
        <div className="text-gray-500">No documents uploaded yet.</div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {filteredDocs.map((doc) => (
            <li key={doc.id} className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {doc.mime_type.startsWith('image/') && (
                  <img src={getFileUrl(doc.filename)} alt={doc.original_name} className="w-10 h-10 object-cover rounded" />
                )}
                {doc.mime_type === 'application/pdf' && (
                  <span className="w-10 h-10 flex items-center justify-center bg-red-100 text-red-600 rounded font-bold">PDF</span>
                )}
                {doc.mime_type === 'text/plain' && (
                  <span className="w-10 h-10 flex items-center justify-center bg-blue-100 text-blue-600 rounded font-bold">TXT</span>
                )}
                <div>
                  <div className="font-medium">{doc.original_name}</div>
                  <div className="text-xs text-gray-500">{doc.mime_type} • {(doc.file_size / 1024).toFixed(1)} KB</div>
                  <div className="text-xs text-gray-400">Uploaded: {new Date(doc.upload_date).toLocaleString()}</div>
                  {/* Image metadata */}
                  {doc.mime_type.startsWith('image/') && (doc.image_width || doc.image_height) && (
                    <div className="text-xs text-gray-600">Dimensions: {doc.image_width} x {doc.image_height} px</div>
                  )}
                  {/* PDF metadata */}
                  {doc.mime_type === 'application/pdf' && doc.pdf_page_count && (
                    <div className="text-xs text-gray-600">Pages: {doc.pdf_page_count}</div>
                  )}
                  {/* AI classification */}
                  {doc.ai_classification && (
                    <div className="text-xs text-purple-700 font-semibold mt-1">Classification: {doc.ai_classification}</div>
                  )}
                  {/* AI summary */}
                  {doc.ai_summary && (
                    <div className="text-xs text-gray-700 mt-1">Summary: {doc.ai_summary}</div>
                  )}
                  {/* Donut classification */}
                  {doc.donut_classification && (
                    <div className="text-xs text-pink-700 font-semibold mt-1">Donut: {doc.donut_classification}</div>
                  )}
                  {/* Status */}
                  {docStatus[doc.id] && (
                    <div className={`text-xs mt-1 ${
                      docStatus[doc.id] === 'ocr-processing' ? 'text-yellow-700' :
                      docStatus[doc.id] === 'ocr-done' ? 'text-green-700' :
                      docStatus[doc.id] === 'ocr-failed' ? 'text-red-700' :
                      docStatus[doc.id] === 'ai-processing' ? 'text-yellow-700' :
                      docStatus[doc.id] === 'ai-done' ? 'text-green-700' :
                      docStatus[doc.id] === 'ai-failed' ? 'text-red-700' :
                      docStatus[doc.id] === 'donut-processing' ? 'text-yellow-700' :
                      docStatus[doc.id] === 'donut-done' ? 'text-green-700' :
                      docStatus[doc.id] === 'donut-failed' ? 'text-red-700' :
                      'text-gray-500'
                    }`}>
                      Status: {docStatus[doc.id]}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <a
                  href={getFileUrl(doc.filename)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm mb-1"
                >
                  Preview
                </a>
                {doc.extracted_text && (
                  <button
                    className="text-xs text-white bg-green-600 hover:bg-green-700 px-2 py-1 rounded"
                    onClick={() => openModal(doc.original_name + ' - OCR/Text', doc.extracted_text!)}
                  >
                    Show OCR/Text
                  </button>
                )}
                {doc.mime_type.startsWith('image/') && (
                  <button
                    className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded mt-1 disabled:opacity-60"
                    onClick={() => queueOcr(doc.id)}
                    disabled={processingOcr === doc.id || docStatus[doc.id] === 'ocr-processing' || docStatus[doc.id] === 'ocr-done' || docStatus[doc.id] === 'ocr-failed'}
                  >
                    {processingOcr === doc.id ? 'Re-running OCR...' : 'Re-run OCR (server)'}
                  </button>
                )}
                <button
                  className="text-xs text-white bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded mt-1 disabled:opacity-60"
                  onClick={() => queueAi(doc.id)}
                  disabled={processingAi === doc.id || docStatus[doc.id] === 'ai-processing' || docStatus[doc.id] === 'ai-done' || docStatus[doc.id] === 'ai-failed'}
                >
                  {processingAi === doc.id ? 'Analyzing...' : 'Classify (AI)'}
                </button>
                <button
                  className="text-xs text-white bg-pink-600 hover:bg-pink-700 px-2 py-1 rounded mt-1 disabled:opacity-60"
                  onClick={() => queueDonut(doc.id)}
                  disabled={processingDonut === doc.id || docStatus[doc.id] === 'donut-processing' || docStatus[doc.id] === 'donut-done' || docStatus[doc.id] === 'donut-failed'}
                >
                  {processingDonut === doc.id ? 'Classifying (Donut)...' : 'Classify (Donut)'}
                </button>
                <button
                  className="text-xs text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded mt-1"
                  onClick={() => handleDelete(doc)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {/* Modal for OCR/Text preview */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl"
              onClick={closeModal}
              aria-label="Close"
            >
              &times;
            </button>
            <h3 className="text-lg font-semibold mb-2">{modalTitle}</h3>
            <div className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-gray-800 border p-2 rounded bg-gray-50">
              {modalText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentList; 