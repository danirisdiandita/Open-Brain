import { useState } from "react"
import { FolderPlus, Sparkles, FolderOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

function slugFromName(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

export function FoldersEmptyState() {
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")

  const handleCreate = () => {
    // TODO: connect to backend
    console.log("create folder", { name, slug, description })
    setName("")
    setSlug("")
    setDescription("")
    setCreateOpen(false)
  }

  return (
    <>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-lg space-y-8 text-center">
          <div className="space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">No folders yet</h2>
            <p className="text-muted-foreground">
              Get started by creating your first folder or let AI organize everything for you.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCreateOpen(true)}>
              <CardHeader>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FolderPlus className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Create a folder</CardTitle>
                <CardDescription>Manually set up your folder structure.</CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                  <Sparkles className="h-5 w-5 text-accent-foreground" />
                </div>
                <CardTitle className="text-base">AI wizard</CardTitle>
                <CardDescription>Describe your organization and AI builds the structure.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-left">
                  <Label htmlFor="ai-prompt">What is your organization about?</Label>
                  <Textarea
                    id="ai-prompt"
                    placeholder="We're a startup building developer tools. We need docs for API references, onboarding guides, and internal knowledge bases..."
                    className="min-h-[100px] resize-none"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                </div>
                <Button className="w-full" disabled>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate structure
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Coming soon — AI-powered folder generation
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>Add a new folder to your organization.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); handleCreate() }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setSlug(slugFromName(e.target.value))
                }}
                placeholder="API Documentation"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-slug">Slug</Label>
              <Input
                id="folder-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="api-documentation"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-desc">Description (optional)</Label>
              <Input
                id="folder-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="REST and GraphQL API references"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name || !slug}>
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
