import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Loader2, Paperclip, Plus, X, Download, Share2, ArrowLeft, Save, FolderOpen, Undo2 } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useNote, useUpdateNote } from "@/hooks/useNotes"
import { useFolders } from "@/hooks/useFolders"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"
import { ShareAccessDialog } from "@/components/ShareAccessDialog"
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
  const { noteId, orgSlug } = useParams<{ noteId: string; orgSlug: string }>()
  const navigate = useNavigate()
  const { selectedOrg } = useOrganization()
  const orgId = selectedOrg?.id
  const { data: note, isLoading } = useNote(orgId, noteId)
  const updateNote = useUpdateNote()
  const { trackRecentNote } = useRecentNotes(orgId)
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: flatFolders } = useFolders(orgId)

  const folderPath = (() => {
    if (!note?.folder_id || !flatFolders) return null
    const segments: { name: string; slug: string }[] = []
    let current = flatFolders.find((f) => f.id === note.folder_id)
    while (current) {
      segments.unshift({ name: current.name, slug: current.slug })
      current = flatFolders.find((f) => f.id === current!.parent_id)
    }
    return segments
  })()

  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [uploading, setUploading] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [backDialogOpen, setBackDialogOpen] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
  const originalTitle = useRef("")
  const originalContent = useRef("")
  const [saving, setSaving] = useState(false)

  const isDirty = title !== originalTitle.current || content !== originalContent.current

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  const { data: attachments, isLoading: attLoading } = useQuery({
    queryKey: ["attachments", orgId, noteId],
    queryFn: () => api.get<Attachment[]>(`/organizations/${orgId}/notes/${noteId}/attachments`).then((r) => r.data),
    enabled: !!orgId && !!noteId,
  })

  useEffect(() => {
    if (note) {
      setTitle(note.title)
      setContent(note.content ?? "")
      originalTitle.current = note.title
      originalContent.current = note.content ?? ""
      trackRecentNote(note.id)
    }
  }, [note])

  const handleSave = useCallback(() => {
    if (!orgId || !noteId) return
    setSaving(true)
    updateNote.mutate({
      orgId,
      id: noteId,
      body: { title, content },
    }, {
      onSuccess: () => {
        originalTitle.current = title
        originalContent.current = content
        setSaving(false)
      },
      onError: () => setSaving(false),
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

  const handleEditorImageUpload = useCallback(async (
    file: File,
    onProgress?: (event: { progress: number }) => void
  ): Promise<string> => {
    if (!orgId || !noteId) throw new Error("Missing org or note id")

    const form = new FormData()
    form.append("file", file)

    const res = await api.post<{ id: string }>(
      `/organizations/${orgId}/notes/${noteId}/attachments`,
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) onProgress?.({ progress: Math.round((e.loaded / e.total) * 100) })
        },
      }
    )

    queryClient.invalidateQueries({ queryKey: ["attachments", orgId, noteId] })

    const urlRes = await api.get<{ url: string }>(
      `/organizations/${orgId}/notes/${noteId}/attachments/${res.data.id}/url`
    )
    return urlRes.data.url
  }, [orgId, noteId, queryClient])

  const imageAttachments = (attachments || []).filter(a => a.content_type?.startsWith("image/"))

  const fetchAttachmentUrl = useCallback(async (attachmentId: string): Promise<string> => {
    const res = await api.get<{ url: string }>(
      `/organizations/${orgId}/notes/${noteId}/attachments/${attachmentId}/url`
    )
    return res.data.url
  }, [orgId, noteId])

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
          <Skeleton className="h-6 w-32 !bg-sidebar-accent/30" />
          <Skeleton className="h-10 w-full !bg-sidebar-accent/30" />
          <Skeleton className="h-[400px] w-full !bg-sidebar-accent/30" />
        </div>
    )
  }

  if (!note) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-muted-foreground">Note not found.</p>
          <Button variant="link" onClick={() => navigate(-1)} className="mt-2">
            Go back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="max-w-4xl w-full mx-auto flex flex-col flex-1">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setBackDialogOpen(true)} title="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0 !bg-transparent"
            placeholder="Untitled"
          />
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setShareOpen(true)}>
            <Share2 className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          <Button onClick={handleSave} disabled={!isDirty || saving} size="sm" className="shrink-0">
            {saving ? (
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
          <SimpleEditor key={noteId} content={note.content ?? ""} onChange={setContent} uploadImage={handleEditorImageUpload} imageAttachments={imageAttachments} fetchAttachmentUrl={fetchAttachmentUrl} />
        </div>
      </div>

      <ShareAccessDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        target={noteId ? { type: "note", id: noteId, name: note?.title || "this note" } : null}
      />

      <Dialog open={backDialogOpen} onOpenChange={(open) => { setBackDialogOpen(open); if (!open) setPendingNavigation(null) }}>
        <DialogContent className="sm:max-w-sm">
          {pendingNavigation ? (
            <>
              <DialogHeader>
                <DialogTitle>Unsaved changes</DialogTitle>
                <DialogDescription>
                  You have unsaved changes. Leave without saving?
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingNavigation(null)}>
                  Stay
                </Button>
                <Button variant="destructive" onClick={() => { setBackDialogOpen(false); pendingNavigation() }}>
                  Leave
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Go back</DialogTitle>
                <DialogDescription>Where would you like to go?</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    if (isDirty) {
                      setPendingNavigation(() => () => navigate(-1))
                    } else {
                      setBackDialogOpen(false)
                      navigate(-1)
                    }
                  }}
                >
                  <Undo2 className="mr-2 h-4 w-4" />
                  Previous page
                </Button>
                {folderPath && (
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      const path = folderPath.map((f) => f.slug).join("/")
                      if (isDirty) {
                        setPendingNavigation(() => () => navigate(`/dashboard/${orgSlug}/${path}`))
                      } else {
                        setBackDialogOpen(false)
                        navigate(`/dashboard/${orgSlug}/${path}`)
                      }
                    }}
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    {folderPath.map((f) => f.name).join(" / ")}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setBackDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
