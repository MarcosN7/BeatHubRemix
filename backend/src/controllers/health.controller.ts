import { Request, Response } from 'express';
import { prisma } from '../lib/prisma'; // <-- Import the shared instance

export class HealthController {
  public async check(req: Request, res: Response): Promise<void> {
    try {
      // Execute a lightweight query to verify DB connection
      await prisma.$queryRaw`SELECT 1`;
      
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      });
    }
  }
}