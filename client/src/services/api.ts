import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export async function fetchDocuments() {
  const res = await axios.get(`${API_URL}/documents`);
  return res.data;
}

export async function analyzeDocumentAI(id: number, categories?: string[]) {
  const res = await axios.post(`${API_URL}/documents/${id}/analyze/ai`, categories ? { categories } : undefined);
  return res.data;
}

export async function deleteDocument(id: number) {
  await axios.delete(`${API_URL}/documents/${id}`);
}

export async function classifyDocumentDonut(id: number) {
  const res = await axios.post(`${API_URL}/documents/${id}/classify-donut`);
  return res.data;
}
