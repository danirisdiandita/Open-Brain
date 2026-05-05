import { useState, useMemo } from "react"
import { Link, useLocation } from "react-router-dom"
import { Brain, Home, Search, Settings, LogOut, Building2, ChevronsUpDown } from "lucide-react"

import { useLogout } from "@/hooks"
import { useOrganization } from "@/contexts/OrganizationContext"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { OrganizationModal } from "@/components/OrganizationModal"

export function AppSidebar() {
  const location = useLocation()
  const logout = useLogout()
  const { isMobile, setOpenMobile } = useSidebar()
  const { selectedOrg } = useOrganization()
  const [orgModalOpen, setOrgModalOpen] = useState(false)

  const orgPrefix = selectedOrg ? `/dashboard/${selectedOrg.slug}` : "/dashboard"

  const items = useMemo(() => [
    { title: "Dashboard", url: orgPrefix, icon: Home },
    { title: "Search", url: `${orgPrefix}/search`, icon: Search },
    { title: "Settings", url: `${orgPrefix}/settings`, icon: Settings },
  ], [orgPrefix])

  const handleNav = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/dashboard" onClick={handleNav}>
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                    <Brain className="size-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold">OpenBrain</span>
                    <span className="text-xs text-sidebar-foreground/60">RAG Powered Wiki</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarGroup>
          <SidebarGroupLabel>Organization</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setOrgModalOpen(true)}
                  className="justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="size-4 shrink-0" />
                    <span className="truncate">
                      {selectedOrg?.name ?? "Select organization"}
                    </span>
                  </div>
                  <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/50" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.url}
                      tooltip={item.title}
                    >
                      <Link to={item.url} onClick={handleNav}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={logout} tooltip="Sign Out">
                <LogOut />
                <span>Sign Out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <OrganizationModal open={orgModalOpen} onOpenChange={setOrgModalOpen} />
    </>
  )
}
