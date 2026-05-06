import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { useCreateFolder, useUpdateFolder } from "@/hooks"
import { useOrganization } from "@/contexts/OrganizationContext"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const folderSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  slug: z.string().min(2, "Slug must be at least 2 characters"),
})

type FolderFormValues = z.infer<typeof folderSchema>

interface FolderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder?: any
}

export function FolderModal({ open, onOpenChange, folder }: FolderModalProps) {
  const { selectedOrg } = useOrganization()
  const createFolder = useCreateFolder()
  const updateFolder = useUpdateFolder()

  const form = useForm<FolderFormValues>({
    resolver: zodResolver(folderSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  })

  useEffect(() => {
    if (folder) {
      form.reset({ name: folder.name, slug: folder.slug })
    } else {
      form.reset({ name: "", slug: "" })
    }
  }, [folder, form])

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  }

  const onSubmit = async (data: FolderFormValues) => {
    if (!selectedOrg) return

    if (folder) {
      updateFolder.mutate(
        { orgId: selectedOrg.id, id: folder.id, body: data },
        { onSuccess: () => onOpenChange(false) }
      )
    } else {
      createFolder.mutate(
        { orgId: selectedOrg.id, body: data },
        { onSuccess: () => onOpenChange(false) }
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{folder ? "Edit Folder" : "Create Folder"}</DialogTitle>
          <DialogDescription>
            {folder ? "Update your folder details." : "Add a new folder to your workspace."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. Engineering" 
                      {...field} 
                      onChange={(e) => {
                        field.onChange(e)
                        if (!folder) {
                          form.setValue("slug", generateSlug(e.target.value), {
                            shouldValidate: true,
                          })
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="engineering" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createFolder.isPending || updateFolder.isPending}>
                {createFolder.isPending || updateFolder.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
