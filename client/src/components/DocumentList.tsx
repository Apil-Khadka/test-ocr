import React, { useEffect, useState } from 'react';
import { fetchDocuments } from '../services/api';
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
}

const getFileUrl = (filename: string) => `${process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:3001'}/files/${filename}`;

const DocumentList: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState<string>('');
  const [modalTitle, setModalTitle] = useState<string>('');
  const [ocrLoadingId, setOcrLoadingId] = useState<number | null>(null);

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

  const rerunOcr = async (doc: Document) => {
    setOcrLoadingId(doc.id);
    try {
      await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/documents/${doc.id}/analyze`);
      // Refetch documents after OCR
      const docs = await fetchDocuments();
      setDocuments(docs);
      toast.success('OCR re-run on server completed!');
    } catch (err: any) {
      toast.error('Failed to re-run OCR on server');
    } finally {
      setOcrLoadingId(null);
    }
  };

  if (loading) return <div className="text-center mt-8">Loading documents...</div>;
  if (error) return <div className="text-center text-red-500 mt-8">{error}</div>;

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <h2 className="text-xl font-semibold mb-4">Uploaded Documents</h2>
      {documents.length === 0 ? (
        <div className="text-gray-500">No documents uploaded yet.</div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {documents.map((doc) => (
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
                    onClick={() => rerunOcr(doc)}
                    disabled={ocrLoadingId === doc.id}
                  >
                    {ocrLoadingId === doc.id ? 'Re-running OCR...' : 'Re-run OCR (server)'}
                  </button>
                )}
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