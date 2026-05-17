import { Link, Outlet } from "react-router-dom"
import { Folder } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { Chatbot } from "@/components/Chatbot"
import { useSyncOrgFromSlug, useCurrentFolderPath } from "@/hooks/useSyncOrgFromSlug"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useFolders } from "@/hooks/useFolders"

function resolveFolderNames(flatFolders: any[] | undefined, slugs: string[]): { name: string; resolved: boolean }[] {
  if (!flatFolders) return slugs.map((slug) => ({ name: slug, resolved: false }))
  return slugs.map((slug) => {
    const f = flatFolders.find((f: any) => f.slug === slug)
    return f ? { name: f.name, resolved: true } : { name: slug, resolved: false }
  })
}

export default function DashboardLayout() {
  useSyncOrgFromSlug()
  const { selectedOrg } = useOrganization()
  const currentPath = useCurrentFolderPath()
  const { data: flatFolders, isLoading } = useFolders(selectedOrg?.id)
  const names = resolveFolderNames(flatFolders, currentPath)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={`/dashboard/${selectedOrg?.slug}`}>
                    {selectedOrg?.name ?? "Dashboard"}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {names.map(({ name, resolved }, i) => (
                <BreadcrumbItem key={i}>
                  <BreadcrumbSeparator />
                  {i === names.length - 1 ? (
                    <BreadcrumbPage>
                      {resolved ? name : isLoading ? <Skeleton className="h-4 w-20 inline-block" /> : name}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={`/dashboard/${selectedOrg?.slug}/${currentPath.slice(0, i + 1).join("/")}`}>
                        <Folder className="mr-1 h-3.5 w-3.5 inline" />
                        {resolved ? name : isLoading ? <Skeleton className="h-3 w-16 inline-block" /> : name}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <Outlet />
        </div>
      </SidebarInset>
      <Chatbot />
    </SidebarProvider>
  )
}
