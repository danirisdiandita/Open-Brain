import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, Save, Paperclip, Plus, X, Download } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useNote, useUpdateNote } from "@/hooks/useNotes"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"
import { useRecentNotes } from "@/hooks/useRecentNotes"
import api from "@/api/client"

interface Attachment {
  id: string
  filename: string
  content_type: string | null
  size: number
  created_at: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function NotePage() {
  const { noteId } = useParams<{ noteId: string; orgSlug: string }>()
  const navigate = useNavigate()
  const { selectedOrg } = useOrganization()
  const orgId = selectedOrg?.id
  const { data: note, isLoading } = useNote(orgId, noteId)
  const updateNote = useUpdateNote()
  const { trackRecentNote } = useRecentNotes(orgId)
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [uploading, setUploading] = useState(false)

  const { data: attachments, isLoading: attLoading } = useQuery({
    queryKey: ["attachments", orgId, noteId],
    queryFn: () => api.get<Attachment[]>(`/organizations/${orgId}/notes/${noteId}/attachments`).then((r) => r.data),
    enabled: !!orgId && !!noteId,
  })

  useEffect(() => {
    if (note) {
      setTitle(note.title)
      setContent(note.content ?? "")
      trackRecentNote(note.id)
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !orgId || !noteId) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      await api.post(`/organizations/${orgId}/notes/${noteId}/attachments`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      queryClient.invalidateQueries({ queryKey: ["attachments", orgId, noteId] })
    } catch { /* ignore */ }
    setUploading(false)
    if (e.target) e.target.value = ""
  }

  const handleDownload = async (att: Attachment) => {
    try {
      const res = await api.get<{ url: string }>(`/organizations/${orgId}/notes/${noteId}/attachments/${att.id}/url`)
      window.open(res.data.url, "_blank")
    } catch { /* ignore */ }
  }

  const handleDeleteAttachment = async (att: Attachment) => {
    try {
      await api.delete(`/organizations/${orgId}/notes/${noteId}/attachments/${att.id}`)
      queryClient.invalidateQueries({ queryKey: ["attachments", orgId, noteId] })
    } catch { /* ignore */ }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sidebar">
        <div className="max-w-4xl mx-auto p-6 space-y-4">
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
      <div className="max-w-4xl w-full mx-auto p-6 space-y-4 flex flex-col flex-1">
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

        <div className="bg-background rounded-2xl shadow-sm border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              Attachments
            </h3>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleUpload}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                Add File
              </Button>
            </div>
          </div>

          {attLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : attachments?.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No attachments yet</p>
          ) : (
            <div className="space-y-1">
              {attachments?.map((att) => (
                <div key={att.id} className="flex items-center justify-between rounded-md hover:bg-muted/50 px-3 py-2 transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{att.filename}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatSize(att.size)} · {att.content_type || "unknown"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(att)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteAttachment(att)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-background rounded-2xl shadow-sm border flex-1 flex flex-col">
          <SimpleEditor key={noteId} content={note.content ?? ""} onChange={setContent} />
        </div>
      </div>
    </div>
  )
}
