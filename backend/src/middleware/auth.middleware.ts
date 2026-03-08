import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    if (!process.env.JWT_SECRET) {
      throw new Error('FATAL_ERROR: JWT_SECRET is not defined in .env file');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };
    
    // Attach userId to request object
    req.userId = decoded.userId;
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
