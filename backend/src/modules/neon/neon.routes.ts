import { Router, Request, Response } from 'express';
import { NeonService } from './neon.service';

const router = Router();

// GET /api/neon/status - Health and operational status of all wired Neon services
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await NeonService.getFullStatus();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      platform: 'Neon Serverless Platform',
      services: status,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// GET /api/neon/functions/hello - Trigger Neon Serverless Function
router.get('/functions/hello', async (req: Request, res: Response) => {
  try {
    const result = await NeonService.testFunctions();
    res.json({
      success: result.status === 'healthy',
      result,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// POST /api/neon/storage/test - Upload a test asset to Neon Object Storage
router.post('/storage/test', async (req: Request, res: Response) => {
  try {
    const result = await NeonService.testObjectStorage();
    res.json({
      success: result.status === 'connected',
      result,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
