import { Link } from "react-router-dom"
import { useSearchParams } from "react-router-dom"
import { Brain, Search, Database, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"

export default function DashboardPage() {
  const { isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const registered = searchParams.get("registered") === "true"

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader>
            <CardTitle>Not Authenticated</CardTitle>
            <CardDescription>Please sign in to access the dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome to your OpenBrain knowledge base</p>
      </div>

      {registered && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6">
            <p className="text-sm text-green-700">
              Account created successfully. Check your email to verify your address.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-base mt-2">Semantic Search</CardTitle>
            <CardDescription>Query your knowledge base with natural language.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link to="/dashboard/search">
                Get started <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Database className="h-5 w-5 text-accent-foreground" />
            </div>
            <CardTitle className="text-base mt-2">Knowledge Base</CardTitle>
            <CardDescription>Upload documents and organize your wiki.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" size="sm" className="text-accent-foreground" asChild>
              <Link to="/dashboard/settings">
                Manage <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-base mt-2">RAG Engine</CardTitle>
            <CardDescription>Retrieval-Augmented Generation for grounded answers.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link to="/dashboard">
                Learn more <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
