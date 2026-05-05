import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "react-router-dom"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useRegister, useResendVerification } from "@/hooks"

const schema = z.object({
  fullName: z.string().min(1, "Name is required").max(128),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Must be at least 8 characters"),
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const register = useRegister()
  const resend = useResendVerification()

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "" },
  })

  const onSubmit = (data: FormData) => {
    register.mutate({
      email: data.email,
      password: data.password,
      full_name: data.fullName,
    })
  }

  if (register.isSuccess) {
    const email = register.variables.email
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              We sent a verification link to <strong>{email}</strong>. Please verify before signing in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div>
              <Button variant="link" asChild>
                <Link to="/login">Go to Sign In</Link>
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Didn't get the email?{" "}
              <button
                type="button"
                className="text-primary underline"
                disabled={resend.isPending}
                onClick={() => resend.mutate(email)}
              >
                {resend.isPending ? "Sending..." : "Resend verification email"}
              </button>
              {resend.isSuccess && (
                <p className="text-green-600 mt-1">Verification email resent!</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Sign up for a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {register.isError && (
                <p className="text-sm text-destructive">
                  {register.error instanceof Error ? register.error.message : "Registration failed"}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={register.isPending}>
                {register.isPending ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link to="/login" className="text-primary underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
