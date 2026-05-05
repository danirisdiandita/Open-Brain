import { useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useVerifyEmail } from "@/hooks"

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const verifyEmail = useVerifyEmail()

  useEffect(() => {
    if (token) verifyEmail.mutate(token)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Link</CardTitle>
            <CardDescription>
              This verification link is missing a token.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="link" asChild>
              <Link to="/login">Go to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (verifyEmail.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (verifyEmail.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Verification Failed</CardTitle>
            <CardDescription>
              {verifyEmail.error instanceof Error
                ? verifyEmail.error.message
                : "The token is invalid or expired."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="link" asChild>
              <Link to="/login">Go to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email Verified</CardTitle>
          <CardDescription>
            Your email has been verified successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild>
            <Link to="/login">Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
