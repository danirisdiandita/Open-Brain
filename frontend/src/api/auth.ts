import api from "./client"

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  full_name?: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface MessageResponse {
  message: string
  user_id?: string
}

export const authApi = {
  register: (body: RegisterPayload) =>
    api.post<MessageResponse>("/auth/register", body).then((r) => r.data),

  login: (body: LoginPayload) =>
    api.post<AuthTokens>("/auth/login", body).then((r) => r.data),

  refresh: (refreshToken: string) =>
    api.post<AuthTokens>("/auth/refresh", { refresh_token: refreshToken }).then((r) => r.data),

  verifyEmail: (token: string) =>
    api.post<MessageResponse>("/auth/verify-email", { token }).then((r) => r.data),

  resendVerification: (email: string) =>
    api.post<MessageResponse>("/auth/resend-verification", { email }).then((r) => r.data),

  forgotPassword: (email: string) =>
    api.post<MessageResponse>("/auth/forgot-password", { email }).then((r) => r.data),

  resetPassword: (token: string, newPassword: string) =>
    api.post<MessageResponse>("/auth/reset-password", {
      token,
      new_password: newPassword,
    }).then((r) => r.data),
}
