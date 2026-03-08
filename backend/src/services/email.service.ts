import { Resend } from 'resend';

export class EmailService {
    private resend: Resend;
    private fromEmail = 'BeatHub <noreply@resend.dev>'; // Using resend's testing domain

    constructor() {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.warn('⚠️ RESEND_API_KEY is not set. Emails will not be sent.');
        }
        this.resend = new Resend(apiKey || 'dummy_key');
    }

    async sendPasswordResetEmail(toEmail: string, resetLink: string): Promise<void> {
        if (!process.env.RESEND_API_KEY) {
            console.log(`[EmailService Dev Mode] Would have sent password reset to ${toEmail}. Link: ${resetLink}`);
            return;
        }

        try {
            await this.resend.emails.send({
                from: this.fromEmail,
                to: toEmail,
                subject: 'Reset Your BeatHub Password',
                html: `
                    <div style="font-family: monospace; background-color: #000; color: #fff; padding: 20px;">
                        <h2 style="color: #00ff00;">&gt; BEATHUB PASSWORD RESET</h2>
                        <p>We received a request to reset the password for the account associated with this email.</p>
                        <p>If you made this request, click the link below to securely reset your password. This link expires in 1 hour.</p>
                        <br/>
                        <a href="${resetLink}" style="background-color: #00ff00; color: #000; padding: 10px 20px; text-decoration: none; font-weight: bold;">[ RESET PASSWORD ]</a>
                        <br/><br/>
                        <p style="color: #666; font-size: 12px;">If you did not request this reset, you can safely ignore this email.</p>
                    </div>
                `
            });
            console.log(`✅ Password reset email sent to ${toEmail}`);
        } catch (error) {
            console.error(`❌ Failed to send password reset email to ${toEmail}:`, error);
            throw new Error('Email delivery failed');
        }
    }
}
