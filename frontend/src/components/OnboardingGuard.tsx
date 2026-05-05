import { Navigate, useNavigate } from "react-router-dom"
import { Loader2, Building2 } from "lucide-react"

import { useOrganizations, useCreateOrganization } from "@/hooks/useOrganizations"
import { useOrganization } from "@/contexts/OrganizationContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"

function slugFromName(name: string) {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
}

export function OnboardingGuard() {
  const { data: orgs, isLoading } = useOrganizations()
  const { selectOrg } = useOrganization()
  const navigate = useNavigate()
  const createOrg = useCreateOrganization()

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (orgs && orgs.length > 0) {
    return <Navigate to={`/dashboard/${orgs[0].slug}`} replace />
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Create Your Organization</CardTitle>
          <CardDescription>
            Set up your workspace to start building your knowledge base.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createOrg.mutate(
                { name, slug, description: description || undefined },
                {
                  onSuccess: (org) => {
                    selectOrg(org)
                    navigate(`/dashboard/${org.slug}`, { replace: true })
                  },
                },
              )
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="onboard-name">Organization Name</Label>
              <Input
                id="onboard-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setSlug(slugFromName(e.target.value))
                }}
                placeholder="My Organization"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboard-slug">URL Slug</Label>
              <Input
                id="onboard-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my_organization"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboard-desc">Description (optional)</Label>
              <Input
                id="onboard-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this org about?"
              />
            </div>
            {createOrg.isError && (
              <p className="text-sm text-destructive">
                {createOrg.error instanceof Error ? createOrg.error.message : "Failed to create"}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={createOrg.isPending || !name || !slug}>
              {createOrg.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Organization
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
