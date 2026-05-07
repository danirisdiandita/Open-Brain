import { useMemo } from "react"
import { Folder } from "lucide-react"
import { FolderContent } from "@/components/FolderContent"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useFolders } from "@/hooks/useFolders"
import { useCurrentFolderPath } from "@/hooks/useSyncOrgFromSlug"

export default function FolderPage() {
  const { selectedOrg } = useOrganization()
  const currentPath = useCurrentFolderPath()
  const { data: folders } = useFolders(selectedOrg?.id)

  const currentFolder = useMemo(() => {
    if (!folders || currentPath.length === 0) return null
    let parentId: string | null = null
    let last: typeof folders[number] | undefined
    for (const slug of currentPath) {
      const f = folders.find((f) => f.slug === slug && f.parent_id === parentId)
      if (!f) return null
      last = f
      parentId = f.id
    }
    return last ?? null
  }, [folders, currentPath])

  if (!currentFolder) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Folder className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{currentFolder.name}</h1>
          {currentFolder.description && (
            <p className="text-sm text-muted-foreground mt-1">{currentFolder.description}</p>
          )}
        </div>
      </div>

      <FolderContent folderId={currentFolder.id} />
    </div>
  )
}
