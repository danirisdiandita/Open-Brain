import { useState, useMemo } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { FileText, Plus, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { FolderFlow } from "@/components/FolderFlow"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useNotes, useCreateNote } from "@/hooks/useNotes"

function slugFromName(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" })
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

export default function DashboardPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const registered = searchParams.get("registered") === "true"
  const { selectedOrg } = useOrganization()
  const orgId = selectedOrg?.id

  const { data: notes, isLoading } = useNotes(orgId)
  const createNote = useCreateNote()

  const unassignedNotes = useMemo(
    () => notes?.filter((n) => !n.folder_id) ?? [],
    [notes],
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState("")
  const [createSlug, setCreateSlug] = useState("")

  const submitCreate = () => {
    if (!orgId || !createTitle || !createSlug) return
    createNote.mutate(
      { orgId, body: { title: createTitle, slug: createSlug } },
      {
        onSuccess: (note) => {
          setCreateOpen(false)
          setCreateTitle("")
          setCreateSlug("")
          navigate(`/dashboard/${selectedOrg?.slug}/note/${note.id}`)
        },
      },
    )
  }

  return (
    <div className="flex flex-col flex-1 space-y-4 min-h-0">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        <div className="flex flex-col min-h-0 space-y-2">
          <h2 className="text-xl font-semibold tracking-tight shrink-0">Workspace Structure</h2>
          <p className="text-sm text-muted-foreground shrink-0">Visual overview of your organization's knowledge base tree</p>
          <FolderFlow />
        </div>

        <div className="flex flex-col min-h-0 space-y-3">
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Uncategorized</h2>
              <p className="text-sm text-muted-foreground">Notes not assigned to any folder</p>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New Note
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : unassignedNotes.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No uncategorized notes</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create one
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border overflow-y-auto flex-1">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Name</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 w-36">Modified</th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedNotes.map((note) => (
                    <tr
                      key={note.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/dashboard/${selectedOrg?.slug}/note/${note.id}`)}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="text-sm font-medium truncate">{note.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(note.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Note</DialogTitle>
            <DialogDescription>Create a note outside any workspace folder.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submitCreate() }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unassigned-title">Title</Label>
              <Input
                id="unassigned-title"
                value={createTitle}
                onChange={(e) => {
                  setCreateTitle(e.target.value)
                  setCreateSlug(slugFromName(e.target.value))
                }}
                placeholder="Quick note..."
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unassigned-slug">Slug</Label>
              <Input
                id="unassigned-slug"
                value={createSlug}
                onChange={(e) => setCreateSlug(e.target.value)}
                placeholder="quick-note"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!createTitle || !createSlug || createNote.isPending}>
                {createNote.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
