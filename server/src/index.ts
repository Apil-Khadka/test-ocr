import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import documentsRouter from './routes/documents';
import filesRouter from './routes/files';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/documents', documentsRouter);
app.use('/files', filesRouter);

// Health check route
app.get('/', (req, res) => {
  res.send('Document Intelligence App Backend Running');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
