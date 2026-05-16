import { useMemo, useCallback, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ReactFlow,
  Handle,
  Position,
  Background,
  Panel,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import dagre from "@dagrejs/dagre"
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
  const isHorizontal = data.targetPos === "left"
  return (
    <div className="flex items-center gap-2 bg-[#021b33] text-slate-200 border border-[#383782] rounded-lg px-4 py-2.5 text-[13px] font-medium cursor-pointer whitespace-nowrap select-none">
      <Handle type="target" position={isHorizontal ? Position.Left : Position.Top} style={{ visibility: "hidden" }} />
      <Folder className="h-4 w-4 shrink-0 text-indigo-400" />
      <span>{data.label as string}</span>
      <Handle type="source" position={isHorizontal ? Position.Right : Position.Bottom} style={{ visibility: "hidden" }} />
    </div>
  )
}

function NoteNode({ data }: NodeProps) {
  const isHorizontal = data.targetPos === "left"
  return (
    <div className="flex items-center gap-1.5 bg-[#1a2744] text-slate-400 border border-dashed border-slate-600 rounded-md px-3 py-1.5 text-xs cursor-pointer whitespace-nowrap select-none">
      <Handle type="target" position={isHorizontal ? Position.Left : Position.Top} style={{ visibility: "hidden" }} />
      <StickyNote className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      <span>{data.label as string}</span>
      <Handle type="source" position={isHorizontal ? Position.Right : Position.Bottom} style={{ visibility: "hidden" }} />
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

function flattenTree(tree: TreeNode[], parentId: string | null, nodes: Node[], edges: Edge[]) {
  for (const node of tree) {
    const isNote = node.kind === "note"
    nodes.push({
      id: node.id,
      type: isNote ? "note" : "folder",
      data: { label: node.name, path: node.slug, noteId: node.noteId ?? null, kind: node.kind },
      position: { x: 0, y: 0 },
    })
    if (parentId) {
      edges.push({ id: `${parentId}->${node.id}`, source: parentId, target: node.id })
    }
    if (node.children.length > 0) {
      flattenTree(node.children, node.id, nodes, edges)
    }
  }
}

function applyDagreLayout(rawNodes: Node[], rawEdges: Edge[], direction: "TB" | "LR" = "TB") {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 60, edgesep: 30, ranksep: 100 })

  for (const node of rawNodes) {
    const isNote = node.type === "note"
    g.setNode(node.id, { width: isNote ? 140 : 180, height: isNote ? 32 : 40 })
  }

  for (const edge of rawEdges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const isHorizontal = direction === "LR"
  return rawNodes.map((node) => {
    const pos = g.node(node.id)
    const isNote = node.type === "note"
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      data: {
        ...node.data,
        targetPos: isHorizontal ? "left" : "top",
        sourcePos: isHorizontal ? "right" : "bottom",
      },
      position: {
        x: pos.x - (isNote ? 70 : 90),
        y: pos.y - (isNote ? 16 : 20),
      },
    }
  })
}

export function FolderFlow() {
  const { selectedOrg } = useOrganization()
  const { data: folders } = useFolders(selectedOrg?.id)
  const { data: notes } = useNotes(selectedOrg?.id)
  const navigate = useNavigate()

  const [direction, setDirection] = useState<"TB" | "LR">("LR")

  const nodeTypes = useMemo(() => ({ folder: FolderNode, note: NoteNode }), [])

  const layouted = useMemo(() => {
    if (!folders || folders.length === 0) return { nodes: [], edges: [] }
    const tree = buildTree(folders, notes ?? [])
    const rawNodes: Node[] = []
    const rawEdges: Edge[] = []
    flattenTree(tree, null, rawNodes, rawEdges)
    const nodes = applyDagreLayout(rawNodes, rawEdges, direction)
    return { nodes, edges: rawEdges }
  }, [folders, notes, direction])

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

  if (layouted.nodes.length === 0) return null

  return (
    <div className="w-full h-full border rounded-lg overflow-hidden bg-muted/20">
      <ReactFlow
        nodes={layouted.nodes}
        edges={layouted.edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: "step", style: { stroke: "#818cf8", strokeWidth: 2.5 } }}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll
        zoomOnDoubleClick
        zoomOnPinch
        onNodeClick={onNodeClick}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#383782" gap={20} />
        <Panel position="top-right" className="flex gap-1">
          <button
            className={`text-xs px-2 py-1 rounded border ${direction === "LR" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
            onClick={() => setDirection("LR")}
          >
            Horizontal
          </button>
          <button
            className={`text-xs px-2 py-1 rounded border ${direction === "TB" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
            onClick={() => setDirection("TB")}
          >
            Vertical
          </button>
        </Panel>
      </ReactFlow>
    </div>
  )
}
