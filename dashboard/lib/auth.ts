import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";
import { Resend } from "resend";
import { CLIENT_CONFIG, SERVER_CONFIG } from "@/constants/config";

// Initialize Resend lazily to avoid build-time errors when the API key is missing
let resendInstance: Resend | null = null;
const getResend = () => {
    if (!resendInstance) {
        // Use a dummy key if missing during build to prevent the constructor from throwing
        resendInstance = new Resend(SERVER_CONFIG.RESEND_API_KEY || "re_dummy");
    }
    return resendInstance;
};

const getEmailTemplate = (title: string, content: string, buttonText: string, url: string) => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #09090b; color: #ffffff;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #18181b; border-radius: 12px; overflow: hidden; margin-top: 40px; margin-bottom: 40px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <tr>
            <td style="padding: 32px; text-align: center; background-color: #09090b; border-bottom: 1px solid #27272a;">
                <div style="font-size: 24px; font-weight: 800; color: #6366f1;">Open Brain</div>
            </td>
        </tr>
        
        <!-- Content -->
        <tr>
            <td style="padding: 40px 32px;">
                <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 700; color: #ffffff; text-align: center;">${title}</h1>
                <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #a1a1aa; text-align: center;">
                    ${content}
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="text-align: center;">
                            <a href="${url}" style="display: inline-block; padding: 14px 32px; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.4);">
                                ${buttonText}
                            </a>
                        </td>
                    </tr>
                </table>
                <p style="margin: 32px 0 0; font-size: 14px; line-height: 20px; color: #71717a; text-align: center;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="${url}" style="color: #6366f1; text-decoration: none; word-break: break-all;">${url}</a>
                </p>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="padding: 24px; background-color: #09090b; text-align: center; border-top: 1px solid #27272a;">
                <p style="margin: 0 0 8px; font-size: 12px; color: #71717a;">
                    © ${new Date().getFullYear()} Open Brain. All rights reserved.
                </p>
                <p style="margin: 0; font-size: 12px; color: #52525b;">
                    This is an automated message, please do not reply.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
};

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        async sendResetPassword({ user, url }) {
            const html = getEmailTemplate(
                "Reset your password",
                "We received a request to reset your password. Click the button below to choose a new one. If you didn't request this, you can safely ignore this email.",
                "Reset Password",
                url
            );

            await getResend().emails.send({
                from: `Open Brain <${SERVER_CONFIG.NOREPLY_EMAIL}>`,
                to: user.email,
                subject: "Reset your password",
                html: html,
            });
        },
    },
    emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        async sendVerificationEmail({ user, url }) {
            const html = getEmailTemplate(
                "Verify your email",
                "Welcome to Open Brain! Please verify your email address to get started and access all features.",
                "Verify Email",
                url
            );

            await getResend().emails.send({
                from: `Open Brain <${SERVER_CONFIG.NOREPLY_EMAIL}>`,
                to: user.email,
                subject: "Verify your email",
                html: html,
            });
        },
    },
    baseURL: CLIENT_CONFIG.NEXT_PUBLIC_APP_URL,
    plugins: [
        nextCookies(),
    ],
});
