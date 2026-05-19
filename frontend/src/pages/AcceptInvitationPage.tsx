import { useEffect, useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import api from "@/api/client"

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get("token")
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setMessage("No invitation token found.")
      return
    }
    api.post(`/organizations/invitations/${token}/accept`)
      .then((r) => {
        setStatus("success")
        setMessage(`You've joined the organization as ${r.data.role}.`)
        setTimeout(() => navigate(`/dashboard`), 2000)
      })
      .catch((err) => {
        setStatus("error")
        setMessage(err.response?.data?.detail || "Failed to accept invitation. It may have expired.")
      })
  }, [token, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <h2 className="text-xl font-semibold">Accepting Invitation...</h2>
              <p className="text-sm text-muted-foreground">Please wait while we process your invitation.</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold">Welcome!</h2>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-10 w-10 text-red-500 mx-auto" />
              <h2 className="text-xl font-semibold">Couldn't Accept</h2>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
