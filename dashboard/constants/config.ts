export const SERVER_CONFIG = {
    DATABASE_URL: process.env.DATABASE_URL || "",
    DATABASE_ADAPTER: (process.env.DATABASE_ADAPTER as "neon" | "pg") || "pg",
    RESEND_API_KEY: process.env.RESEND_API_KEY || "",
    NOREPLY_EMAIL: process.env.NOREPLY_EMAIL || "onboarding@resend.dev",
};

export const CLIENT_CONFIG = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
}
