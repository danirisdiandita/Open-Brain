import { useState, useMemo, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  Folder,
  FileText,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  LayoutList,
  LayoutGrid,
} from "lucide-react"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useFolders, useDeleteFolder } from "@/hooks/useFolders"
import { useInfiniteNotes, useCreateNote, useDeleteNote } from "@/hooks/useNotes"
import { useCurrentFolderPath } from "@/hooks/useSyncOrgFromSlug"
import { FolderModal } from "./FolderModal"
import type { FolderResponse } from "@/api/folder"
import type { NoteResponse } from "@/api/note"

function slugFromName(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" })
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" })
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
}

type TableRow =
  | { kind: "folder"; data: FolderResponse }
  | { kind: "note"; data: NoteResponse }

type ViewMode = "table" | "grid"

interface FolderContentProps {
  folderId?: string
}

export function FolderContent({ folderId }: FolderContentProps) {
  const { selectedOrg } = useOrganization()
  const navigate = useNavigate()
  const orgId = selectedOrg?.id
  const currentPath = useCurrentFolderPath()

  const { data: allFolders } = useFolders(orgId)
  const {
    data: notesData,
    isLoading: notesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteNotes(orgId, folderId)
  const createNote = useCreateNote()
  const deleteNote = useDeleteNote()
  const deleteFolder = useDeleteFolder()

  const allNotes = useMemo(
    () => notesData?.pages.flat() ?? [],
    [notesData?.pages],
  )

  const childFolders = useMemo(
    () => allFolders?.filter((f) => f.parent_id === folderId) ?? [],
    [allFolders, folderId],
  )

  const rows = useMemo((): TableRow[] => {
    const sortedFolders = [...childFolders].sort((a, b) => a.name.localeCompare(b.name))
    const sortedNotes = [...allNotes].sort((a, b) => a.title.localeCompare(b.title))
    return [
      ...sortedFolders.map((f): TableRow => ({ kind: "folder", data: f })),
      ...sortedNotes.map((n): TableRow => ({ kind: "note", data: n })),
    ]
  }, [childFolders, allNotes])

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem("folderViewMode")
    return stored === "grid" ? "grid" : "table"
  })

  const setViewModeAndPersist = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem("folderViewMode", mode)
  }

  const [createNoteOpen, setCreateNoteOpen] = useState(false)
  const [createNoteTitle, setCreateNoteTitle] = useState("")
  const [createNoteSlug, setCreateNoteSlug] = useState("")

  const [folderModalOpen, setFolderModalOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<FolderResponse | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string
    name: string
    kind: "folder" | "note"
  } | null>(null)

  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const submitCreateNote = () => {
    if (!orgId || !createNoteTitle || !createNoteSlug) return
    createNote.mutate({
      orgId,
      body: { title: createNoteTitle, slug: createNoteSlug, folder_id: folderId },
    })
    setCreateNoteOpen(false)
    setCreateNoteTitle("")
    setCreateNoteSlug("")
  }

  const confirmDelete = () => {
    if (!orgId || !deleteConfirm) return
    if (deleteConfirm.kind === "note") {
      deleteNote.mutate({ orgId, id: deleteConfirm.id })
    } else {
      deleteFolder.mutate({ orgId, id: deleteConfirm.id })
    }
    setDeleteConfirm(null)
  }

  const handleRowClick = (row: TableRow) => {
    if (!selectedOrg) return
    if (row.kind === "folder") {
      const path = [...currentPath, row.data.slug].join("/")
      navigate(`/dashboard/${selectedOrg.slug}/${path}`)
    } else {
      navigate(`/dashboard/${selectedOrg.slug}/note/${row.data.id}`)
    }
  }

  const handleEditFolder = (folder: FolderResponse) => {
    setEditingFolder(folder)
    setFolderModalOpen(true)
  }

  const handleCreateFolder = () => {
    setEditingFolder(null)
    setFolderModalOpen(true)
  }

  if (!orgId) return null

  if (notesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const renderGrid = () => (
    <>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed flex flex-col items-center justify-center py-16 px-4 text-center">
          <Folder className="h-10 w-10 text-muted-foreground/30 mb-4" />
          <h3 className="text-base font-medium">This folder is empty</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Add folders to organize your workspace, or create notes to start writing.
          </p>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleCreateFolder} variant="outline" size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Folder
            </Button>
            <Button onClick={() => setCreateNoteOpen(true)} variant="outline" size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Note
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((row) => {
            const isFolder = row.kind === "folder"
            const name = isFolder ? row.data.name : row.data.title
            const dateStr = isFolder ? row.data.created_at : row.data.updated_at

            return (
              <Card
                key={`${row.kind}-${row.data.id}`}
                className="cursor-pointer hover:shadow-md transition-shadow p-4 group"
                onClick={() => handleRowClick(row)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    {isFolder ? (
                      <Folder className="h-5 w-5 shrink-0 text-indigo-400 mt-0.5" />
                    ) : (
                      <FileText className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{name}</h3>
                      <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                        {formatDate(dateStr)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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
                        {isFolder && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditFolder(row.data)
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>Edit</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirm({ id: row.data.id, name, kind: row.kind })
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {hasNextPage && (
        <div ref={loadMoreRef} className="flex items-center justify-center py-4">
          {isFetchingNextPage && (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
    </>
  )

  const renderTable = () => (
    <>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed flex flex-col items-center justify-center py-16 px-4 text-center">
          <Folder className="h-10 w-10 text-muted-foreground/30 mb-4" />
          <h3 className="text-base font-medium">This folder is empty</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Add folders to organize your workspace, or create notes to start writing.
          </p>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleCreateFolder} variant="outline" size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Folder
            </Button>
            <Button onClick={() => setCreateNoteOpen(true)} variant="outline" size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Note
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-24">
                  Type
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-36">
                  Modified
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isFolder = row.kind === "folder"
                const name = isFolder ? row.data.name : row.data.title
                const dateStr = isFolder ? row.data.created_at : row.data.updated_at

                return (
                  <tr
                    key={`${row.kind}-${row.data.id}`}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(row)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        {isFolder ? (
                          <Folder className="h-4 w-4 shrink-0 text-indigo-400" />
                        ) : (
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <span className="text-sm font-medium truncate">{name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {isFolder ? "Folder" : "Note"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(dateStr)}
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
                          {isFolder && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditFolder(row.data)
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirm({ id: row.data.id, name, kind: row.kind })
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {hasNextPage && (
            <div ref={loadMoreRef} className="flex items-center justify-center py-4 border-t">
              {isFetchingNextPage && (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>
          )}
        </div>
      )}
    </>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          {folderId ? "Contents" : "Root"}
        </h2>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-none rounded-l-md"
              onClick={() => setViewModeAndPersist("table")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-none rounded-r-md"
              onClick={() => setViewModeAndPersist("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCreateFolder}>
                <Folder className="mr-2 h-4 w-4" />
                <span>New Folder</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreateNoteOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                <span>New Note</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {viewMode === "grid" ? renderGrid() : renderTable()}

      <Dialog open={createNoteOpen} onOpenChange={setCreateNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Note</DialogTitle>
            <DialogDescription>Create a new note in this folder.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitCreateNote()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={createNoteTitle}
                onChange={(e) => {
                  setCreateNoteTitle(e.target.value)
                  setCreateNoteSlug(slugFromName(e.target.value))
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
                value={createNoteSlug}
                onChange={(e) => setCreateNoteSlug(e.target.value)}
                placeholder="getting-started"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateNoteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!createNoteTitle || !createNoteSlug || createNote.isPending}>
                {createNote.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <FolderModal
        open={folderModalOpen}
        onOpenChange={setFolderModalOpen}
        folder={editingFolder as any}
      />

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Delete {deleteConfirm?.kind === "folder" ? "Folder" : "Note"}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>&quot;{deleteConfirm?.name}&quot;</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteNote.isPending || deleteFolder.isPending}
            >
              {(deleteNote.isPending || deleteFolder.isPending) && (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              )}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
