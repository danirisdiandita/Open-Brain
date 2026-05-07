import { useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  ReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { useFolders } from "@/hooks/useFolders"
import { useOrganization } from "@/contexts/OrganizationContext"
import type { FolderResponse } from "@/api/folder"

interface TreeNode {
  id: string
  name: string
  slug: string
  children: TreeNode[]
}

function buildTree(flat: FolderResponse[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const f of flat) {
    map.set(f.id, { id: f.id, name: f.name, slug: f.slug, children: [] })
  }

  for (const f of flat) {
    const node = map.get(f.id)!
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children.push(node)
    } else {
      roots.push(node)
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

    nodes.push({
      id: node.id,
      type: "default",
      data: { label: node.name, path: nodePath },
      position: { x, y: currentY },
      style: {
        background: "#021b33",
        color: "#e2e8f0",
        border: "1px solid #383782",
        borderRadius: 8,
        padding: "10px 16px",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
      },
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
      edges.push({
        id: `${node.id}->${child.id}`,
        source: node.id,
        target: child.id,
        style: { stroke: "#383782", strokeWidth: 2 },
        animated: true,
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
  const navigate = useNavigate()

  const { nodes, edges } = useMemo(() => {
    if (!folders || folders.length === 0) return { nodes: [], edges: [] }
    const tree = buildTree(folders)
    return layoutTree(tree, 0, 0)
  }, [folders])

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const path = (node.data as any).path as string
      if (path) {
        navigate(`/dashboard/${selectedOrg?.slug}/${path}`)
      }
    },
    [navigate, selectedOrg?.slug],
  )

  if (nodes.length === 0) return null

  return (
    <div className="w-full h-[400px] border rounded-lg overflow-hidden bg-muted/20">
      <ReactFlow
        nodes={nodes}
        edges={edges}
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
