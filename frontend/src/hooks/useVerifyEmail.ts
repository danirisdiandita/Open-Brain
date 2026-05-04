import { useMutation } from "@tanstack/react-query"
import { authApi } from "@/api/auth"

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => authApi.verifyEmail(token),
  })
}
