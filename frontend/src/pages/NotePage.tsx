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
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (!note) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <p className="text-muted-foreground">Note not found.</p>
        <Button variant="link" onClick={() => navigate(-1)} className="mt-2">
          Go back
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-2xl font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0"
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

      <NoteEditor
        key={noteId}
        content={note.content ?? ""}
        onChange={setContent}
      />
    </div>
  )
}
