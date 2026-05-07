import { useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { FolderFlow } from "@/components/FolderFlow"
import { FolderContent } from "@/components/FolderContent"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useFolders } from "@/hooks/useFolders"
import { useCurrentFolderPath } from "@/hooks/useSyncOrgFromSlug"

export default function DashboardPage() {
  const [searchParams] = useSearchParams()
  const registered = searchParams.get("registered") === "true"
  const { selectedOrg } = useOrganization()
  const currentPath = useCurrentFolderPath()
  const { data: folders } = useFolders(selectedOrg?.id)


  console.log('currentPath', currentPath)

  const currentFolderId = useMemo(() => {

    if (!folders || currentPath.length === 0) return undefined
    let parentId: string | null = null
    for (const slug of currentPath) {
      const f = folders.find((f) => f.slug === slug && f.parent_id === parentId)
      if (!f) return undefined
      parentId = f.id
    }
    return parentId ?? undefined

  }, [folders, currentPath])


  console.log('currentFolderId', currentFolderId)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome to your OpenBrain knowledge base</p>
      </div>

      {registered && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6">
            <p className="text-sm text-green-700">
              Account created successfully. Check your email to verify your address.
            </p>
          </CardContent>
        </Card>
      )}

      {currentPath.length === 0 ? (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">Workspace Structure</h2>
          <p className="text-sm text-muted-foreground">Visual overview of your organization's knowledge base tree</p>
          <FolderFlow />
        </div>
      ) : (
        <div>
          <h1>Content</h1>
          <FolderContent folderId={currentFolderId} />
        </div>
      )}


    </div>
  )
}
