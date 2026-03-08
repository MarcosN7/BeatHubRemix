import { PasswordResetToken } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class PasswordResetRepository {
    async createToken(userId: string, hashedToken: string, expiresAt: Date): Promise<PasswordResetToken> {
        return prisma.passwordResetToken.create({
            data: {
                userId,
                token: hashedToken,
                expiresAt,
            }
        });
    }

    async findByToken(hashedToken: string): Promise<PasswordResetToken | null> {
        return prisma.passwordResetToken.findUnique({
            where: { token: hashedToken }
        });
    }

    async markTokenAsUsed(tokenId: string): Promise<void> {
        await prisma.passwordResetToken.update({
            where: { id: tokenId },
            data: { used: true }
        });
    }
}
