import { useMutation } from "@tanstack/react-query"
import { authApi } from "@/api/auth"

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  })
}
