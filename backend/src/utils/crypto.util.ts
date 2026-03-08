import crypto from 'crypto';

export class CryptoUtil {
    /**
     * Generates a secure random token as a hex string.
     */
    static generateToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Hashes a string (like a raw token) using SHA-256 and returns a hex string.
     * This ensures the raw token is never stored in the database.
     */
    static hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
}
