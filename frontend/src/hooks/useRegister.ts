import { useMutation } from "@tanstack/react-query"
import { authApi, type RegisterPayload } from "@/api/auth"

export function useRegister() {
  return useMutation({
    mutationFn: (body: RegisterPayload) => authApi.register(body),
  })
}
