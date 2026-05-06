import { useState } from "react"
import { Folder, MoreHorizontal, Plus, Sparkles, Pencil, Trash } from "lucide-react"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useFolders, useDeleteFolder, useCreateFolder } from "@/hooks"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FolderModal } from "./FolderModal"
import { Link, useLocation } from "react-router-dom"

export function WorkspaceSidebarSection() {
  const { selectedOrg } = useOrganization()
  const { data: folders } = useFolders(selectedOrg?.id)
  const deleteFolder = useDeleteFolder()
  const location = useLocation()
  
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<any>(null)

  const orgPrefix = selectedOrg ? `/dashboard/${selectedOrg.slug}` : "/dashboard"

  if (!selectedOrg) return null

  const handleCreateManual = () => {
    setEditingFolder(null)
    setModalOpen(true)
  }

  const createFolder = useCreateFolder()

  const handleAutoStructure = async () => {
    if (!selectedOrg) return
    const defaultFolders = ["Engineering", "Product", "Marketing"]
    for (const name of defaultFolders) {
      const slug = name.toLowerCase()
      createFolder.mutate({
        orgId: selectedOrg.id,
        body: { name, slug },
      })
    }
  }

  const handleEdit = (folder: any) => {
    setEditingFolder(folder)
    setModalOpen(true)
  }

  const handleDelete = (folderId: string) => {
    if (confirm("Are you sure you want to delete this folder?")) {
      deleteFolder.mutate({ orgId: selectedOrg.id, id: folderId })
    }
  }

  return (
    <SidebarGroup>
      <div className="flex items-center justify-between pr-2">
        <SidebarGroupLabel>Workspace</SidebarGroupLabel>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-sidebar-foreground/50 hover:text-sidebar-foreground focus:outline-none flex h-5 w-5 items-center justify-center rounded-md">
              <Plus className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleCreateManual}>
              <Folder className="mr-2 h-4 w-4" />
              <span>Create Folder</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAutoStructure}>
              <Sparkles className="mr-2 h-4 w-4" />
              <span>Auto Structure with AI</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SidebarGroupContent>
        <SidebarMenu>
          {folders?.map((folder) => {
            const isActive = location.pathname.startsWith(`${orgPrefix}/folder/${folder.slug}`)
            return (
              <SidebarMenuItem key={folder.id}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={folder.name}>
                  <Link to={`${orgPrefix}/folder/${folder.slug}`}>
                    <Folder className="h-4 w-4" />
                    <span>{folder.name}</span>
                  </Link>
                </SidebarMenuButton>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuAction showOnHover>
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">More</span>
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(folder)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      <span>Edit</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive" 
                      onClick={() => handleDelete(folder.id)}
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>

      <FolderModal 
        open={modalOpen} 
        onOpenChange={setModalOpen} 
        folder={editingFolder} 
      />
    </SidebarGroup>
  )
}
