import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { authApi, type LoginPayload } from "@/api/auth"
import { useAuth } from "@/contexts/AuthContext"

export function useLogin() {
  const { setTokens } = useAuth()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (body: LoginPayload) => authApi.login(body),
    onSuccess: (data, variables) => {
      setTokens({ ...data, email: variables.email })
      navigate("/dashboard")
    },
  })
}
