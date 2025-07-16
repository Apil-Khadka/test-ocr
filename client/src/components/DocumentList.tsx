import React, { useEffect, useState } from 'react';
import { fetchDocuments } from '../services/api';

interface Document {
  id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  upload_date: string;
  extracted_text?: string;
}

const getFileUrl = (filename: string) => `${process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:3001'}/files/${filename}`;

const DocumentList: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments()
      .then(setDocuments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
                  {doc.mime_type === 'text/plain' && doc.extracted_text && (
                    <div className="mt-1 p-2 bg-gray-100 rounded text-xs text-gray-700 max-w-xs overflow-x-auto">
                      <strong>Preview:</strong> {doc.extracted_text.slice(0, 200)}{doc.extracted_text.length > 200 ? '...' : ''}
                    </div>
                  )}
                </div>
              </div>
              <a
                href={getFileUrl(doc.filename)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                Preview
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DocumentList; 