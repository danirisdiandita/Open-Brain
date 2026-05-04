import { useMutation } from "@tanstack/react-query"
import { authApi } from "@/api/auth"

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      authApi.resetPassword(token, newPassword),
  })
}
