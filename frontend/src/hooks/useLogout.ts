import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

export function useLogout() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  return () => {
    logout()
    navigate("/login")
  }
}
