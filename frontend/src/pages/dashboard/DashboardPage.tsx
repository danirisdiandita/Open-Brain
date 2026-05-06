import { useSearchParams } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { FoldersEmptyState } from "@/components/FoldersEmptyState"

export default function DashboardPage() {
  const [searchParams] = useSearchParams()
  const registered = searchParams.get("registered") === "true"

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

      <FoldersEmptyState />
    </div>
  )
}
