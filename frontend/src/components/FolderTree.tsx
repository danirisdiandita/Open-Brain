import { useState, useCallback, useRef } from "react"
import { Tree, type NodeRendererProps } from "react-arborist"
import { Folder, FolderOpen, Plus, Pencil, Trash2, GripVertical, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface FolderNode {
  id: string
  name: string
  slug: string
  description?: string
  children?: FolderNode[]
}

let nextId = 1
function genId() { return `folder-${nextId++}` }

function slugFromName(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

const initialData: FolderNode[] = []

export function FolderTree() {
  const [data, setData] = useState<FolderNode[]>(initialData)
  const treeRef = useRef<any>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "rename">("create")
  const [dialogParent, setDialogParent] = useState<string | null>(null)
  const [dialogNodeId, setDialogNodeId] = useState<string | null>(null)
  const [dialogName, setDialogName] = useState("")
  const [dialogSlug, setDialogSlug] = useState("")
  const [dialogDesc, setDialogDesc] = useState("")

  const findAndUpdate = useCallback((nodes: FolderNode[], id: string, updater: (node: FolderNode) => FolderNode): FolderNode[] => {
    return nodes.map((node): FolderNode => {
      if (node.id === id) return updater(node)
      if (node.children) return { ...node, children: findAndUpdate(node.children, id, updater) }
      return node
    })
  }, [])

  const findAndDelete = useCallback((nodes: FolderNode[], id: string): FolderNode[] => {
    return nodes
      .filter((node) => node.id !== id)
      .map((node): FolderNode => {
        if (node.children) return { ...node, children: findAndDelete(node.children, id) }
        return node
      })
  }, [])

  const addChild = useCallback((nodes: FolderNode[], parentId: string | null, child: FolderNode): FolderNode[] => {
    if (parentId === null) return [...nodes, child]
    return nodes.map((node): FolderNode => {
      if (node.id === parentId) {
        return { ...node, children: [...(node.children ?? []), child] }
      }
      if (node.children) return { ...node, children: addChild(node.children, parentId, child) }
      return node
    })
  }, [])

  const openCreateDialog = (parentId: string | null) => {
    setDialogMode("create")
    setDialogParent(parentId)
    setDialogNodeId(null)
    setDialogName("")
    setDialogSlug("")
    setDialogDesc("")
    setDialogOpen(true)
  }

  const openRenameDialog = (node: FolderNode) => {
    setDialogMode("rename")
    setDialogParent(null)
    setDialogNodeId(node.id)
    setDialogName(node.name)
    setDialogSlug(node.slug)
    setDialogDesc(node.description ?? "")
    setDialogOpen(true)
  }

  const handleDialogSubmit = () => {
    if (dialogMode === "create") {
      const newNode: FolderNode = {
        id: genId(),
        name: dialogName,
        slug: dialogSlug,
        description: dialogDesc || undefined,
        children: [],
      }
      setData((prev) => addChild(prev, dialogParent, newNode))
    } else if (dialogMode === "rename" && dialogNodeId) {
      setData((prev) =>
        findAndUpdate(prev, dialogNodeId, (node) => ({
          ...node,
          name: dialogName,
          slug: dialogSlug,
          description: dialogDesc || undefined,
        })),
      )
    }
    setDialogOpen(false)
  }

  const handleDelete = (nodeId: string) => {
    setData((prev) => findAndDelete(prev, nodeId))
  }

  const handleMove = useCallback((_args: { dragIds: string[]; parentId: string | null; index: number }) => {
    // TODO: implement drag-and-drop move
  }, [])

  const NodeRenderer = ({ node, style, dragHandle }: NodeRendererProps<FolderNode>) => {
    const folder = node.data

    return (
      <div
        style={style}
        className="flex items-center gap-1 pr-2 group"
        onClick={() => node.toggle()}
      >
        <span className="flex items-center shrink-0 w-5">
          {folder.children && folder.children.length > 0 ? (
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${node.isOpen ? "rotate-90" : ""}`} />
          ) : (
            <span className="w-4" />
          )}
        </span>

        <span className="shrink-0">
          {node.isOpen ? (
            <FolderOpen className="h-4 w-4 text-sidebar-foreground/70" />
          ) : (
            <Folder className="h-4 w-4 text-sidebar-foreground/70" />
          )}
        </span>

        <span className="flex-1 truncate text-sm">{folder.name}</span>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              openCreateDialog(folder.id)
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
              openRenameDialog(folder)
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
              handleDelete(folder.id)
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

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-medium text-sidebar-foreground/70">Folders</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => openCreateDialog(null)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="px-1">
          <Tree
            ref={treeRef}
            data={data}
            onMove={handleMove}
            width="100%"
            height={300}
            rowHeight={32}
            indent={16}
            disableDrag={false}
            disableDrop={false}
            renderCursor={() => null}
            padding={0}
          >
            {NodeRenderer}
          </Tree>
          {data.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-4">
              No folders yet. Click + to create one.
            </p>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "Create Folder" : "Rename Folder"}</DialogTitle>
            <DialogDescription>
              {dialogMode === "create" ? "Add a new folder to your workspace." : "Edit folder details."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); handleDialogSubmit() }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="tree-folder-name">Name</Label>
              <Input
                id="tree-folder-name"
                value={dialogName}
                onChange={(e) => {
                  setDialogName(e.target.value)
                  if (dialogMode === "create") setDialogSlug(slugFromName(e.target.value))
                }}
                placeholder="My Folder"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tree-folder-slug">Slug</Label>
              <Input
                id="tree-folder-slug"
                value={dialogSlug}
                onChange={(e) => setDialogSlug(e.target.value)}
                placeholder="my-folder"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tree-folder-desc">Description</Label>
              <Input
                id="tree-folder-desc"
                value={dialogDesc}
                onChange={(e) => setDialogDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!dialogName || !dialogSlug}>
                {dialogMode === "create" ? "Create" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
