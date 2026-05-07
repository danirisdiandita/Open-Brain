import { useState } from "react"
import { FileText, Plus, Pencil, Trash2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { NoteEditor } from "@/components/NoteEditor"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from "@/hooks/useNotes"
import type { NoteResponse } from "@/api/note"

function slugFromName(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

interface FolderContentProps {
  folderId?: string
}

export function FolderContent({ folderId }: FolderContentProps) {
  const { selectedOrg } = useOrganization()
  const orgId = selectedOrg?.id
  const { data: notes, isLoading, isPending } = useNotes(orgId, folderId)
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()

  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState("")
  const [createSlug, setCreateSlug] = useState("")

  const [editingNote, setEditingNote] = useState<NoteResponse | null>(null)
  const [editContent, setEditContent] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [editSlug, setEditSlug] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const submitCreate = () => {
    if (!orgId || !createTitle || !createSlug) return
    createNote.mutate({
      orgId,
      body: { title: createTitle, slug: createSlug, folder_id: folderId },
    })
    setCreateOpen(false)
    setCreateTitle("")
    setCreateSlug("")
  }

  const submitUpdate = () => {
    if (!orgId || !editingNote || !editTitle || !editSlug) return
    updateNote.mutate({
      orgId,
      id: editingNote.id,
      body: { title: editTitle, slug: editSlug, content: editContent || "" },
    })
    setEditingNote(null)
  }

  const confirmDelete = () => {
    if (!orgId || !deleteConfirm) return
    deleteNote.mutate({ orgId, id: deleteConfirm })
    setDeleteConfirm(null)
  }

  const openEditor = (note: NoteResponse) => {
    setEditingNote(note)
    setEditTitle(note.title)
    setEditSlug(note.slug)
    setEditContent(note.content ?? "")
  }

  if (!orgId) return null

  if (isLoading || isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Notes</h2>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New Note
        </Button>
      </div>

      {notes && notes.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16 px-4 text-center border-dashed">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium">No notes yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create your first note in this folder. Write documentation, capture ideas, or build your knowledge base.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="mt-4" variant="outline">
            <Plus className="mr-1.5 h-4 w-4" />
            Create your first note
          </Button>
        </Card>
      )}

      {notes && notes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <Card
              key={note.id}
              className="cursor-pointer hover:shadow-md transition-shadow p-5 group"
              onClick={() => openEditor(note)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate">{note.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {note.content
                      ? note.content.replace(/<[^>]+>/g, "").slice(0, 120)
                      : "No content yet"}
                  </p>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditor(note)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirm(note.id)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Note</DialogTitle>
            <DialogDescription>Create a new note in this folder.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submitCreate() }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={createTitle}
                onChange={(e) => {
                  setCreateTitle(e.target.value)
                  setCreateSlug(slugFromName(e.target.value))
                }}
                placeholder="Getting Started"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-slug">Slug</Label>
              <Input
                id="note-slug"
                value={createSlug}
                onChange={(e) => setCreateSlug(e.target.value)}
                placeholder="getting-started"
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

      <Dialog
        open={editingNote !== null}
        onOpenChange={(open) => {
          if (!open) setEditingNote(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
          </DialogHeader>
          {editingNote && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="edit-note-title">Title</Label>
                  <Input
                    id="edit-note-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="edit-note-slug">Slug</Label>
                  <Input
                    id="edit-note-slug"
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                  />
                </div>
              </div>
              <NoteEditor
                content={editContent}
                onChange={setEditContent}
                placeholder="Write your note content..."
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setEditingNote(null)}>
                  Cancel
                </Button>
                <Button onClick={submitUpdate} disabled={updateNote.isPending}>
                  {updateNote.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteNote.isPending}>
              {deleteNote.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
