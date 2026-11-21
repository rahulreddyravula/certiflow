import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler.middleware';
import { EventService } from './modules/events/event.service';
import { AuthUser } from './middleware/auth.middleware';

// Routes
import authRoutes from './modules/auth/auth.routes';
import batchRoutes from './modules/batch/batch.routes';
import certificateRoutes from './modules/certificate/certificate.routes';
import verificationRoutes from './modules/verification/verification.routes';
import monitoringRoutes from './modules/monitoring/monitoring.routes';
import neonRoutes from './modules/neon/neon.routes';
import candidateRoutes from './modules/candidate/candidate.routes';

export const app = express();

// Security and parsers
app.use((req: Request, res: Response, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve certificate PDFs
app.use('/certificates', express.static(config.certificatesDir));

// Healthcheck
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CertiFlow API',
    version: '1.0.0',
  });
});

// Real-Time Server-Sent Events (SSE) Stream
app.get('/api/events/subscribe', (req: Request, res: Response) => {
  // Extract token from query or Authorization header
  const token = (req.query.token as string) || (req.headers.authorization?.split(' ')[1]);

  let user: AuthUser | undefined;
  if (token) {
    try {
      user = jwt.verify(token, config.jwtSecret) as AuthUser;
    } catch (err) {
      // Allow unauthenticated connection or reject? Allow with general events
    }
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  EventService.addClient({
    id: clientId,
    userId: user?.id,
    role: user?.role,
    res,
  });

  // Send initial connection packet
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, status: 'connected' })}\n\n`);

  // Heartbeat ping every 25s
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    EventService.removeClient(clientId);
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/verify', verificationRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/neon', neonRoutes);
app.use('/api/candidates', candidateRoutes);

// Centralized Error Handler
app.use(errorHandler);
