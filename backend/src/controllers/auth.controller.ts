import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';

const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10), // hex token from url
  newPassword: z.string().min(6),
});

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  public register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, email, password } = registerSchema.parse(req.body);
      const result = await this.authService.register({
        username,
        email,
        passwordPlain: password,
      });
      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.issues });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  };

  public login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const result = await this.authService.login({
        email,
        passwordPlain: password,
      });
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.issues });
      } else {
        res.status(401).json({ error: error.message });
      }
    }
  };

  public forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const result = await this.authService.forgotPassword(email);
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.issues });
      } else {
        // Log actual error internally, but still return success to prevent email enumeration
        console.error('Forgot password error:', error.message);
        res.status(200).json({ message: 'If that email is registered, you will receive a password reset link shortly.' });
      }
    }
  };

  public resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, newPassword } = resetPasswordSchema.parse(req.body);
      const result = await this.authService.resetPassword(token, newPassword);
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.issues });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  };

  public getMe = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const user = await this.authService.getMe(req.userId);
      res.status(200).json(user);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  };
}