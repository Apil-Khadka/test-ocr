import React from 'react';
import FileUpload from './components/FileUpload';
import DocumentList from './components/DocumentList';
import FolderSidebar from './components/FolderSidebar';

function App() {
  const [selectedFolder, setSelectedFolder] = React.useState('');
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <FolderSidebar selectedFolder={selectedFolder} onSelect={setSelectedFolder} />
      <div className="flex-1">
        <FileUpload />
        <DocumentList folder={selectedFolder} />
      </div>
    </div>
  );
}

export default App;
