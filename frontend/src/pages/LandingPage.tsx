import { Link } from "react-router-dom"
import { Brain, Database, Search, Code } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/AuthContext"

const features = [
  {
    icon: Search,
    title: "Semantic Search",
    description: "Query your knowledge base with natural language and get AI-powered answers.",
  },
  {
    icon: Brain,
    title: "RAG Engine",
    description: "Retrieval-Augmented Generation grounds responses in your own documents.",
  },
  {
    icon: Database,
    title: "Personal Wiki",
    description: "Organize notes, documents, and insights in a structured knowledge graph.",
  },
]

export default function LandingPage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <Brain className="h-6 w-6" />
          OpenBrain
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Button asChild>
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl space-y-6">
          <div className="space-y-3">
            <h1 className="text-5xl font-bold tracking-tight text-primary sm:text-6xl">
              OpenBrain
            </h1>
            <p className="text-xl text-muted-foreground sm:text-2xl font-medium">
              Open Source RAG-Powered Wiki
            </p>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Build a second brain powered by AI. Upload documents, ask questions,
              and get answers grounded in your own knowledge base — all open source.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/register">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </main>

      <Separator />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl mb-10">
            Everything you need
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{title}</h3>
                <p className="text-muted-foreground text-sm">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 py-6 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Code className="h-4 w-4" />
            GitHub
          </a>
        </div>
        <p className="mt-2">OpenBrain — Open Source</p>
      </footer>
    </div>
  )
}
