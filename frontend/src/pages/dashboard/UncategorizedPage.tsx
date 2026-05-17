import { useState, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  FileText,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Upload,
  FileUp,
  Folder,
  Sparkles,
} from "lucide-react"
import { useDropzone } from "react-dropzone"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useFolders } from "@/hooks/useFolders"
import {
  useNotes,
  useCreateNote,
  useUploadNote,
  useDeleteNote,
  useUpdateNote,
  useSuggestFolder,
} from "@/hooks/useNotes"
import type { NoteResponse } from "@/api/note"
import type { FolderResponse } from "@/api/folder"

function slugFromName(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

function getFolderPath(
  folderId: string,
  folders: FolderResponse[],
): string {
  const parts: string[] = []
  let current = folders.find((f) => f.id === folderId)
  while (current) {
    parts.unshift(current.name)
    current = current.parent_id
      ? folders.find((f) => f.id === current!.parent_id)
      : undefined
  }
  return parts.join(" > ")
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

export default function UncategorizedPage() {
  const { selectedOrg } = useOrganization()
  const navigate = useNavigate()
  const orgId = selectedOrg?.id

  const { data: notes, isLoading } = useNotes(orgId)
  const { data: folders } = useFolders(orgId)
  const createNote = useCreateNote()
  const uploadNote = useUploadNote()
  const deleteNote = useDeleteNote()
  const updateNote = useUpdateNote()
  const suggestFolder = useSuggestFolder()

  const unassigned = useMemo(
    () => notes?.filter((n) => !n.folder_id) ?? [],
    [notes],
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState("")
  const [createSlug, setCreateSlug] = useState("")

  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<NoteResponse | null>(null)
  const [moveNote, setMoveNote] = useState<NoteResponse | null>(null)
  const [moveFolderId, setMoveFolderId] = useState("")
  const [aiMoveNote, setAiMoveNote] = useState<NoteResponse | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<any>(null)
  const [aiSelectedPath, setAiSelectedPath] = useState("")

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0]
      if (!file || !orgId) return
      uploadNote.mutate(
        { orgId, file },
        { onSuccess: () => setUploadOpen(false) },
      )
    },
    [orgId, uploadNote],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "text/html": [".html", ".htm"],
      "text/plain": [".txt"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
    maxFiles: 1,
    multiple: false,
  })

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

  const confirmDelete = () => {
    if (!orgId || !deleteConfirm) return
    deleteNote.mutate({ orgId, id: deleteConfirm.id })
    setDeleteConfirm(null)
  }

  const confirmMove = () => {
    if (!orgId || !moveNote || !moveFolderId) return
    updateNote.mutate({
      orgId,
      id: moveNote.id,
      body: { folder_id: moveFolderId },
    })
    setMoveNote(null)
    setMoveFolderId("")
  }

  const confirmAiMove = () => {
    if (!orgId || !aiMoveNote || !aiSelectedPath) return
    const folder = folders?.find((f) => {
      const path = getFolderPath(f.id, folders!)
      return path === aiSelectedPath
    })
    if (!folder) return
    updateNote.mutate({
      orgId,
      id: aiMoveNote.id,
      body: { folder_id: folder.id },
    })
    setAiMoveNote(null)
    setAiSuggestions(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Uncategorized</h1>
          <p className="text-sm text-muted-foreground">Notes not assigned to any folder</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              New Note
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              <span>Blank Note</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              <span>Upload File</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {unassigned.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-medium">No uncategorized notes</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create a note or upload a file to get started.
            </p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Blank Note
              </Button>
              <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="mr-1.5 h-4 w-4" />
                Upload File
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-2xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-24">Type</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-36">Modified</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {unassigned.map((note) => (
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
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Note</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(note.updated_at)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/dashboard/${selectedOrg?.slug}/note/${note.id}`)
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setMoveNote(note)
                            setMoveFolderId("")
                          }}
                        >
                          <Folder className="mr-2 h-4 w-4" />
                          <span>Move to Folder</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!orgId) return
                            setAiMoveNote(note)
                            setAiSuggestions(null)
                            setAiSelectedPath("")
                            suggestFolder.mutate(
                              { orgId, noteId: note.id },
                              {
                                onSuccess: (data) => {
                                  setAiSuggestions(data)
                                  setAiSelectedPath(data.best_path)
                                },
                              },
                            )
                          }}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          <span>Move by AI</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirm(note)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Note</DialogTitle>
            <DialogDescription>Create a note outside any workspace folder.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submitCreate() }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uc-title">Title</Label>
              <Input
                id="uc-title"
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
              <Label htmlFor="uc-slug">Slug</Label>
              <Input
                id="uc-slug"
                value={createSlug}
                onChange={(e) => setCreateSlug(e.target.value)}
                placeholder="quick-note"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!createTitle || !createSlug || createNote.isPending}>
                {createNote.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>Drop a file or click to browse. It will be parsed into a note.</DialogDescription>
          </DialogHeader>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
          >
            <input {...getInputProps()} />
            {uploadNote.isPending ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Uploading and parsing...</p>
              </div>
            ) : isDragActive ? (
              <div className="flex flex-col items-center gap-2">
                <FileUp className="h-8 w-8 text-primary" />
                <p className="text-sm font-medium">Drop your file here</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FileUp className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">Drag & drop or <span className="text-primary underline">browse</span></p>
                <p className="text-xs text-muted-foreground">Max 1 file</p>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Supported formats</p>
            <div className="flex flex-wrap gap-1.5">
              {["PDF", "DOCX", "PPTX", "HTML", "TXT", "PNG", "JPG", "JPEG"].map((fmt) => (
                <span key={fmt} className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                  .{fmt.toLowerCase()}
                </span>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setUploadOpen(false)} disabled={uploadNote.isPending}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              Delete <strong>&quot;{deleteConfirm?.title}&quot;</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteNote.isPending}>
              {deleteNote.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={moveNote !== null} onOpenChange={() => setMoveNote(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
            <DialogDescription>
              Move <strong>&quot;{moveNote?.title}&quot;</strong> into a workspace folder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uc-move-folder">Target Folder</Label>
              <select
                id="uc-move-folder"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={moveFolderId}
                onChange={(e) => setMoveFolderId(e.target.value)}
              >
                <option value="">Select a folder...</option>
                {folders?.map((f) => (
                  <option key={f.id} value={f.id}>{getFolderPath(f.id, folders)}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setMoveNote(null)}>Cancel</Button>
              <Button onClick={confirmMove} disabled={!moveFolderId || updateNote.isPending}>
                {updateNote.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Move
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={aiMoveNote !== null} onOpenChange={() => { setAiMoveNote(null); setAiSuggestions(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Folder Suggestion
            </DialogTitle>
            <DialogDescription>
              Best folder for <strong>&quot;{aiMoveNote?.title}&quot;</strong>
            </DialogDescription>
          </DialogHeader>

          {suggestFolder.isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : aiSuggestions ? (
            <div className="space-y-4">
              <div className="space-y-2">
                {aiSuggestions.suggestions.map((s: any, i: number) => {
                  const isBest = s.folder_path === aiSelectedPath
                  return (
                    <button
                      key={i}
                      className={`w-full text-left rounded-2xl border p-3 transition-colors ${
                        isBest ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                      onClick={() => setAiSelectedPath(s.folder_path)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{s.folder_path}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                          s.score >= 8 ? "bg-green-100 text-green-700" :
                          s.score >= 5 ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {s.score}/10
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{s.reason}</p>
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => { setAiMoveNote(null); setAiSuggestions(null) }}>Cancel</Button>
                <Button onClick={confirmAiMove} disabled={!aiSelectedPath || updateNote.isPending}>
                  {updateNote.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  Move to Selected
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
