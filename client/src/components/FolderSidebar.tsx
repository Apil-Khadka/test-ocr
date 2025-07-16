import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

interface FolderSidebarProps {
  selectedFolder: string;
  onSelect: (folder: string) => void;
}

const FolderSidebar: React.FC<FolderSidebarProps> = ({ selectedFolder, onSelect }) => {
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API_URL}/documents/folders`)
      .then(res => setFolders(res.data))
      .catch(() => setError('Failed to load folders'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-56 bg-white border-r h-full p-4">
      <h3 className="font-bold mb-4">Folders</h3>
      <ul className="space-y-2">
        <li>
          <button
            className={`w-full text-left px-2 py-1 rounded ${selectedFolder === '' ? 'bg-blue-100 font-semibold' : 'hover:bg-gray-100'}`}
            onClick={() => onSelect('')}
          >
            All Documents
          </button>
        </li>
        {loading && <li className="text-xs text-gray-400">Loading...</li>}
        {error && <li className="text-xs text-red-500">{error}</li>}
        {folders.map(folder => (
          <li key={folder}>
            <button
              className={`w-full text-left px-2 py-1 rounded ${selectedFolder === folder ? 'bg-blue-100 font-semibold' : 'hover:bg-gray-100'}`}
              onClick={() => onSelect(folder)}
            >
              {folder}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FolderSidebar; 