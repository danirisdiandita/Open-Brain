import { useCallback, useRef, useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Tree, type NodeRendererProps } from "react-arborist"
import { Folder, FolderOpen, Plus, Pencil, Trash2, GripVertical, ChevronRight, Loader2 } from "lucide-react"

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
import { Label } from "@/components/ui/label"
import { useOrganization } from "@/contexts/OrganizationContext"
import {
  useFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
} from "@/hooks/useFolders"
import { useCurrentFolderPath } from "@/hooks/useSyncOrgFromSlug"
import type { FolderResponse } from "@/api/folder"

interface TreeNode {
  id: string
  name: string
  slug: string
  description?: string
  order_index: number
  children?: TreeNode[]
}

function slugFromName(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

function buildTree(flat: FolderResponse[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const f of flat) {
    map.set(f.id, {
      id: f.id,
      name: f.name,
      slug: f.slug,
      description: f.description ?? undefined,
      order_index: f.order_index,
      children: [],
    })
  }

  for (const f of flat) {
    const node = map.get(f.id)!
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children!.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function findNodeBySlugPath(tree: TreeNode[] | undefined, slugs: string[]): TreeNode | null {
  if (!tree || slugs.length === 0) return null
  const slug = slugs[0]
  for (const node of tree) {
    if (node.slug === slug) {
      if (slugs.length === 1) return node
      return findNodeBySlugPath(node.children, slugs.slice(1))
    }
  }
  return null
}

export function FolderTree() {
  const { selectedOrg } = useOrganization()
  const orgId = selectedOrg?.id
  const navigate = useNavigate()
  const currentPath = useCurrentFolderPath()

  const { data: flatFolders, isLoading } = useFolders(orgId)
  const createFolder = useCreateFolder()
  const updateFolder = useUpdateFolder()
  const deleteFolder = useDeleteFolder()

  const treeRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(200)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      if (el.clientHeight > 0) setContainerHeight(el.clientHeight)
    }
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const treeData: TreeNode[] = flatFolders ? buildTree(flatFolders) : []
  const currentFolder = findNodeBySlugPath(treeData, currentPath)

  useEffect(() => {
    const tree = treeRef.current
    if (!tree || !currentPath.length) {
      tree?.closeAll()
      return
    }

    let lastId: string | null = null
    let currentTree = treeData
    for (const slug of currentPath) {
      const node = currentTree.find((n: TreeNode) => n.slug === slug)
      if (!node) break
      lastId = node.id
      tree.open(node.id)
      currentTree = node.children ?? []
    }
    if (lastId) tree.scrollTo(lastId)
  }, [currentPath, treeData])

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createParentId, setCreateParentId] = useState<string | null>(null)
  const [createName, setCreateName] = useState("")
  const [createSlug, setCreateSlug] = useState("")
  const [createDesc, setCreateDesc] = useState("")

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editNodeId, setEditNodeId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editSlug, setEditSlug] = useState("")
  const [editDesc, setEditDesc] = useState("")

  const handleCreate = useCallback(
    ({ parentId }: { parentId: string | null; type?: string }) => {
      if (!orgId) return
      setCreateParentId(parentId)
      setCreateName("")
      setCreateSlug("")
      setCreateDesc("")
      setCreateDialogOpen(true)
      return { cancelled: true } as any
    },
    [orgId],
  )

  const openEditDialog = (node: TreeNode) => {
    setEditNodeId(node.id)
    setEditName(node.name)
    setEditSlug(node.slug)
    setEditDesc(node.description ?? "")
    setEditDialogOpen(true)
  }

  const submitEdit = () => {
    if (!orgId || !editNodeId || !editName || !editSlug) return
    updateFolder.mutate({
      orgId,
      id: editNodeId,
      body: { name: editName, slug: editSlug, description: editDesc || undefined },
    })
    setEditDialogOpen(false)
  }

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteNodeId, setDeleteNodeId] = useState<string | null>(null)
  const [deleteNodeName, setDeleteNodeName] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState("")

  const openDeleteDialog = (node: TreeNode) => {
    setDeleteNodeId(node.id)
    setDeleteNodeName(node.name)
    setDeleteConfirm("")
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (!orgId || !deleteNodeId || deleteConfirm !== deleteNodeName) return
    const flat = flatFolders?.find((f) => f.id === deleteNodeId)
    if (flat && currentFolder?.id === deleteNodeId) {
      const parentSlugs = currentPath.slice(0, -1)
      navigate(`/dashboard/${selectedOrg?.slug}/${parentSlugs.join("/")}`.replace(/\/$/, ""), { replace: true })
    }
    deleteFolder.mutate({ orgId, id: deleteNodeId })
    setDeleteDialogOpen(false)
  }

  const handleDelete = useCallback(
    (_args: { ids: string[] }) => {
      // handled via dialog
    },
    [],
  )

  const handleMove = useCallback(
    ({ dragIds, parentId, index }: { dragIds: string[]; parentId: string | null; index: number }) => {
      if (!orgId || dragIds.length === 0) return
      for (const id of dragIds) {
        updateFolder.mutate({ orgId, id, body: { parent_id: parentId ?? undefined, order_index: index } })
      }
    },
    [orgId, updateFolder],
  )

  const submitCreate = () => {
    if (!orgId || !createName || !createSlug) return
    createFolder.mutate({
      orgId,
      body: {
        name: createName,
        slug: createSlug,
        description: createDesc || undefined,
        parent_id: createParentId ?? undefined,
      },
    })
    setCreateDialogOpen(false)
  }

  const handleNavigateToFolder = (node: TreeNode, pathToHere: string[]) => {
    const slugs = [...pathToHere, node.slug]
    navigate(`/dashboard/${selectedOrg?.slug}/${slugs.join("/")}`)
  }

  const NodeRenderer = ({ node, style, dragHandle }: NodeRendererProps<TreeNode>) => {
    const data = node.data
    const nodePath = getNodePath(node)
    const isCurrent = currentFolder?.id === data.id

    return (
      <div
        style={style}
        className={`flex items-center gap-1 pr-2 group rounded-sm ${isCurrent ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}
      >
        <span className="flex items-center shrink-0 w-5">
          {node.isInternal ? (
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform cursor-pointer ${node.isOpen ? "rotate-90" : ""}`}
              onClick={(e) => {
                e.stopPropagation()
                node.toggle()
              }}
            />
          ) : (
            <span className="w-4" />
          )}
        </span>

        <button
          className="flex items-center gap-1 flex-1 min-w-0 text-left"
          onClick={() => handleNavigateToFolder(data, nodePath)}
        >
          <span className="shrink-0">
            {isCurrent ? (
              <FolderOpen className="h-4 w-4 text-sidebar-accent-foreground" />
            ) : (
              <Folder className="h-4 w-4 text-sidebar-foreground/70" />
            )}
          </span>

          <span className="flex-1 truncate text-sm">{data.name}</span>
        </button>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              handleCreate({ parentId: data.id })
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              openEditDialog(data)
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              openDeleteDialog(data)
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <div
            {...dragHandle}
            className="h-6 w-6 flex items-center justify-center cursor-grab"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  function getNodePath(node: any): string[] {
    const slugs: string[] = []
    let current = node
    while (current?.parent?.data) {
      slugs.unshift(current.parent.data.slug)
      current = current.parent
    }
    return slugs
  }

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex flex-col space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-medium text-sidebar-foreground/70">Workspaces</span>
        </div>
        <div className="flex-1 min-h-0 space-y-1 px-2">
          <Skeleton className="h-6 w-3/4 !bg-sidebar-accent/30" />
          <Skeleton className="h-6 w-1/2 ml-4 !bg-sidebar-accent/30" />
          <Skeleton className="h-6 w-2/3 ml-4 !bg-sidebar-accent/30" />
          <Skeleton className="h-6 w-1/3 !bg-sidebar-accent/30" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-medium text-sidebar-foreground/70">Workspaces</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleCreate({ parentId: null, type: "internal" })}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 min-h-0" ref={containerRef}>
          {treeData.length > 0 ? (
            <Tree<TreeNode>
              ref={treeRef}
              data={treeData}
              onCreate={handleCreate}
              onDelete={handleDelete}
              onMove={handleMove}
              width="100%"
              height={containerHeight}
              rowHeight={32}
              indent={16}
              disableDrag={false}
              disableDrop={false}
              renderCursor={() => null}
              padding={0}
            >
              {NodeRenderer}
            </Tree>
          ) : (
            <p className="text-[11px] text-muted-foreground text-center py-4">
              No folders yet. Click + to create one.
            </p>
          )}
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>Add a new folder to your workspace.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); submitCreate() }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="ft-name">Name</Label>
              <Input
                id="ft-name"
                value={createName}
                onChange={(e) => {
                  setCreateName(e.target.value)
                  setCreateSlug(slugFromName(e.target.value))
                }}
                placeholder="My Folder"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ft-slug">Slug</Label>
              <Input
                id="ft-slug"
                value={createSlug}
                onChange={(e) => setCreateSlug(e.target.value)}
                placeholder="my-folder"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ft-desc">Description</Label>
              <Input
                id="ft-desc"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!createName || !createSlug || createFolder.isPending}>
                {createFolder.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Create
              </Button>
            </div>
            {createFolder.isError && (
              <p className="text-sm text-destructive">
                {createFolder.error instanceof Error ? createFolder.error.message : "Failed to create"}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Folder</DialogTitle>
            <DialogDescription>Rename or update folder details.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); submitEdit() }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value)
                  if (editSlug === slugFromName(editName)) {
                    setEditSlug(slugFromName(e.target.value))
                  }
                }}
                placeholder="My Folder"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-slug">Slug</Label>
              <Input
                id="edit-slug"
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                placeholder="my-folder"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Input
                id="edit-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!editName || !editSlug || updateFolder.isPending}>
                {updateFolder.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Save
              </Button>
            </div>
            {updateFolder.isError && (
              <p className="text-sm text-destructive">
                {updateFolder.error instanceof Error ? updateFolder.error.message : "Failed to update"}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>&quot;{deleteNodeName}&quot;</strong> and all nested subfolders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type <span className="font-semibold">{deleteNodeName}</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={deleteNodeName}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteConfirm !== deleteNodeName || deleteFolder.isPending}
              >
                {deleteFolder.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Delete
              </Button>
            </div>
            {deleteFolder.isError && (
              <p className="text-sm text-destructive">
                {deleteFolder.error instanceof Error ? deleteFolder.error.message : "Failed to delete"}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
