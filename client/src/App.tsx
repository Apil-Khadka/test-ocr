import React from 'react';
import FileUpload from './components/FileUpload';
import DocumentList from './components/DocumentList';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <FileUpload />
      <DocumentList />
    </div>
  );
}

export default App;
