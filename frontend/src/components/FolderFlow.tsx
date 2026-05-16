import { useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  ReactFlow,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Folder, StickyNote } from "lucide-react"

import { useFolders } from "@/hooks/useFolders"
import { useNotes } from "@/hooks/useNotes"
import { useOrganization } from "@/contexts/OrganizationContext"
import type { FolderResponse } from "@/api/folder"
import type { NoteResponse } from "@/api/note"

interface TreeNode {
  id: string
  name: string
  slug: string
  children: TreeNode[]
  kind: "folder" | "note"
  noteId?: string
}

function FolderNode({ data }: NodeProps) {
  return (
    <div className="flex items-center gap-2 bg-[#021b33] text-slate-200 border border-[#383782] rounded-lg px-4 py-2.5 text-[13px] font-medium cursor-pointer whitespace-nowrap select-none">
      <Handle type="target" position={Position.Left} style={{ visibility: "hidden" }} />
      <Folder className="h-4 w-4 shrink-0 text-indigo-400" />
      <span>{data.label as string}</span>
      <Handle type="source" position={Position.Right} style={{ visibility: "hidden" }} />
    </div>
  )
}

function NoteNode({ data }: NodeProps) {
  return (
    <div className="flex items-center gap-1.5 bg-[#1a2744] text-slate-400 border border-dashed border-slate-600 rounded-md px-3 py-1.5 text-xs cursor-pointer whitespace-nowrap select-none">
      <Handle type="target" position={Position.Left} style={{ visibility: "hidden" }} />
      <StickyNote className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      <span>{data.label as string}</span>
      <Handle type="source" position={Position.Right} style={{ visibility: "hidden" }} />
    </div>
  )
}

function buildTree(flat: FolderResponse[], notes: NoteResponse[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const f of flat) {
    map.set(f.id, { id: f.id, name: f.name, slug: f.slug, children: [], kind: "folder" })
  }

  for (const f of flat) {
    const node = map.get(f.id)!
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const notesByFolder = new Map<string, NoteResponse[]>()
  for (const n of notes) {
    const key = n.folder_id ?? "__root__"
    if (!notesByFolder.has(key)) notesByFolder.set(key, [])
    notesByFolder.get(key)!.push(n)
  }

  for (const [folderId, folderNotes] of notesByFolder) {
    const parent = folderId === "__root__" ? null : map.get(folderId)
    const target = parent ? parent.children : roots
    for (const note of folderNotes) {
      target.push({
        id: `note-${note.id}`,
        name: note.title,
        slug: note.slug,
        children: [],
        kind: "note",
        noteId: note.id,
      })
    }
  }

  return roots
}

function layoutTree(
  tree: TreeNode[],
  x = 0,
  y = 0,
  depth = 0,
  slugPath = "",
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const dx = 220
  const dy = 60

  const total = tree.reduce((sum, t) => sum + countNodes(t), 0)
  let currentY = y - ((total - 1) * dy) / 2

  for (const node of tree) {
    const childCount = countNodes(node)
    const childY = currentY + ((childCount - 1) * dy) / 2
    const nodePath = slugPath ? `${slugPath}/${node.slug}` : node.slug

    const isNote = node.kind === "note"

    nodes.push({
      id: node.id,
      type: isNote ? "note" : "folder",
      data: {
        label: node.name,
        path: isNote ? undefined : nodePath,
        noteId: node.noteId ?? null,
        kind: node.kind,
      },
      position: { x, y: currentY },
    })

    const { nodes: childNodes, edges: childEdges } = layoutTree(
      node.children,
      x + dx,
      childY,
      depth + 1,
      nodePath,
    )
    nodes.push(...childNodes)

    for (const child of node.children) {
      const isChildNote = child.kind === "note"
      edges.push({
        id: `${node.id}->${child.id}`,
        source: node.id,
        target: child.id,
        ...(isChildNote && {
          style: { stroke: "#64748b", strokeWidth: 1.5, strokeDasharray: "4 2" },
        }),
      })
    }
    edges.push(...childEdges)

    currentY += dy
  }

  return { nodes, edges }
}

function countNodes(tree: TreeNode): number {
  let count = 1
  for (const child of tree.children) count += countNodes(child)
  return count
}

export function FolderFlow() {
  const { selectedOrg } = useOrganization()
  const { data: folders } = useFolders(selectedOrg?.id)
  const { data: notes } = useNotes(selectedOrg?.id)
  const navigate = useNavigate()

  const nodeTypes = useMemo(() => ({ folder: FolderNode, note: NoteNode }), [])

  const { nodes, edges } = useMemo(() => {
    if (!folders || folders.length === 0) return { nodes: [], edges: [] }
    const tree = buildTree(folders, notes ?? [])
    return layoutTree(tree, 0, 0)
  }, [folders, notes])

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const data = node.data as any
      if (data.noteId) {
        navigate(`/dashboard/${selectedOrg?.slug}/note/${data.noteId}`)
      } else if (data.path) {
        navigate(`/dashboard/${selectedOrg?.slug}/${data.path}`)
      }
    },
    [navigate, selectedOrg?.slug],
  )

  if (nodes.length === 0) return null

  return (
    <div className="w-full h-full border rounded-lg overflow-hidden bg-muted/20">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          type: "step",
          style: { stroke: "#818cf8", strokeWidth: 2.5 },
        }}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        onNodeClick={onNodeClick}
        proOptions={{ hideAttribution: true }}
      />
    </div>
  )
}
