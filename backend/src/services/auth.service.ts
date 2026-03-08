import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import { UserRepository } from '../repositories/user.repository';
import { PasswordResetRepository } from '../repositories/password-reset.repository';
import { EmailService } from './email.service';
import { CryptoUtil } from '../utils/crypto.util';

export class AuthService {
  private userRepository: UserRepository;
  private passwordResetRepo: PasswordResetRepository;
  private emailService: EmailService;
  private readonly saltRounds = 10;
  private readonly jwtSecret: string;

  constructor() {
    this.userRepository = new UserRepository();
    this.passwordResetRepo = new PasswordResetRepository();
    this.emailService = new EmailService();
    if (!process.env.JWT_SECRET) {
      throw new Error('FATAL_ERROR: JWT_SECRET is not defined in .env file');
    }
    this.jwtSecret = process.env.JWT_SECRET;
  }

  async register(data: { username: string; email: string; passwordPlain: string }) {
    const { username, email, passwordPlain } = data;
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('Email is already registered');
    }
    const passwordHash = await bcrypt.hash(passwordPlain, this.saltRounds);
    const user = await this.userRepository.create({
      username,
      email,
      passwordHash,
    });
    const token = this.generateToken(user.id);
    return { user: this.omitPasswordHash(user), token };
  }

  async login(data: { email: string; passwordPlain: string }) {
    const { email, passwordPlain } = data;
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    const isPasswordValid = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }
    const token = this.generateToken(user.id);
    return { user: this.omitPasswordHash(user), token };
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return this.omitPasswordHash(user);
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // ALWAYS return a generic success to prevent email enumeration
      return { message: 'If that email is registered, you will receive a password reset link shortly.' };
    }

    const rawToken = CryptoUtil.generateToken();
    const hashedToken = CryptoUtil.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await this.passwordResetRepo.createToken(user.id, hashedToken, expiresAt);

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
    await this.emailService.sendPasswordResetEmail(user.email, resetLink);

    return { message: 'If that email is registered, you will receive a password reset link shortly.' };
  }

  async resetPassword(token: string, newPasswordPlain: string) {
    const hashedToken = CryptoUtil.hashToken(token);
    const resetToken = await this.passwordResetRepo.findByToken(hashedToken);

    if (!resetToken) {
      throw new Error('Invalid or expired reset token');
    }

    if (resetToken.used) {
      throw new Error('This reset token has already been used');
    }

    if (new Date() > resetToken.expiresAt) {
      throw new Error('This reset token has expired');
    }

    const passwordHash = await bcrypt.hash(newPasswordPlain, this.saltRounds);
    await this.userRepository.updatePassword(resetToken.userId, passwordHash);
    await this.passwordResetRepo.markTokenAsUsed(resetToken.id);

    return { message: 'Password has been successfully reset' };
  }

  private generateToken(userId: string): string {
    return jwt.sign({ userId }, this.jwtSecret, { expiresIn: '7d' });
  }

  private omitPasswordHash(user: User) {
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}