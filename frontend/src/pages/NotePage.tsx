import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { NoteEditor } from "@/components/NoteEditor"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useNote, useUpdateNote } from "@/hooks/useNotes"

export default function NotePage() {
  const { noteId } = useParams<{ noteId: string; orgSlug: string }>()
  const navigate = useNavigate()
  const { selectedOrg } = useOrganization()
  const orgId = selectedOrg?.id
  const { data: note, isLoading } = useNote(orgId, noteId)
  const updateNote = useUpdateNote()

  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")

  console.log('note', note)

  useEffect(() => {
    if (note) {
      setTitle(note.title)
      setContent(note.content ?? "")
    }
  }, [note])

  const handleSave = useCallback(() => {
    if (!orgId || !noteId) return
    updateNote.mutate({
      orgId,
      id: noteId,
      body: { title, content },
    })
  }, [orgId, noteId, title, content, updateNote])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [handleSave])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sidebar">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <Skeleton className="h-6 w-32 !bg-sidebar-accent/30" />
          <Skeleton className="h-10 w-full !bg-sidebar-accent/30" />
          <Skeleton className="h-[400px] w-full !bg-sidebar-accent/30" />
        </div>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-sidebar flex items-center justify-center">
        <div className="text-center">
          <p className="text-sidebar-foreground/70">Note not found.</p>
          <Button variant="link" onClick={() => navigate(-1)} className="mt-2">
            Go back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sidebar flex flex-col">
      <div className="max-w-3xl w-full mx-auto p-6 space-y-4 flex flex-col flex-1">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5 text-sidebar-foreground" />
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0 !bg-transparent !text-white"
            placeholder="Untitled"
          />
          <Button onClick={handleSave} disabled={updateNote.isPending} size="sm" className="shrink-0">
            {updateNote.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="ml-1.5 hidden sm:inline">Save</span>
          </Button>
        </div>

        <div className="bg-background rounded-lg shadow-lg flex-1 flex flex-col">
          <NoteEditor
            key={noteId}
            content={note.content ?? ""}
            onChange={setContent}
          />
        </div>
      </div>
    </div>
  )
}
