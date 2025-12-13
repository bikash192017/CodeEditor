import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import * as http from 'http';
import mongoose from 'mongoose';

import authRoutes from './routes/authRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import codeSessionRoutes from './routes/codeSessionRoutes.js';
import userRoutes from './routes/userRoutes.js';
import executeRoutes from './routes/executeRoutes.js';
import { initializeSocket } from './socket/index.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();
const app = express();

// Security
app.use(helmet());

// CORS
const allowedOrigins =
  process.env.CLIENT_URLS?.split(',').map((url) => url.trim()) || [
    'http://localhost:5173',
    'http://localhost:5174',
  ];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGO_URI =
  process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/codeeditor';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/sessions', codeSessionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/execute', executeRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

// Start Server
const PORT = Number(process.env.PORT) || 5000;

function startServer(port: number) {
  const server = http.createServer(app);
  const io = initializeSocket(server);

  server.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`⚠️ Port ${port} in use, retrying on ${nextPort}`);
      startServer(nextPort);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });

  return io;
}

const io = startServer(PORT);
export { io };
