import { createAuthClient } from "better-auth/react";
import { CLIENT_CONFIG } from "@/constants/config";

export const authClient = createAuthClient({
    baseURL: CLIENT_CONFIG.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});
