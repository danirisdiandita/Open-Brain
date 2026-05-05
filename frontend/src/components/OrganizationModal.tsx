import { useState } from "react"
import { Building2, Plus, Pencil, Trash2, Check, AlertTriangle, Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  useOrganizations,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
} from "@/hooks/useOrganizations"
import { useOrganization } from "@/contexts/OrganizationContext"
import type { OrgResponse } from "@/api/organization"

type View = "list" | "create" | "edit" | "delete"

interface FormFields {
  name: string
  slug: string
  description: string
  is_public: boolean
}

const emptyForm: FormFields = { name: "", slug: "", description: "", is_public: false }

function slugFromName(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrganizationModal({ open, onOpenChange }: Props) {
  const { data: orgs, isLoading } = useOrganizations()
  const { selectedOrg, selectOrg } = useOrganization()
  const createOrg = useCreateOrganization()
  const updateOrg = useUpdateOrganization()
  const deleteOrg = useDeleteOrganization()

  const [view, setView] = useState<View>("list")
  const [form, setForm] = useState<FormFields>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")

  const reset = () => {
    setView("list")
    setForm(emptyForm)
    setEditId(null)
    setDeleteConfirm("")
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const handleSelect = (org: OrgResponse) => {
    selectOrg(org)
    handleClose()
  }

  const handleCreate = () => {
    createOrg.mutate(
      { name: form.name, slug: form.slug, description: form.description || undefined, is_public: form.is_public },
      {
        onSuccess: (org) => {
          selectOrg(org)
          handleClose()
        },
      },
    )
  }

  const handleUpdate = () => {
    if (!editId) return
    updateOrg.mutate(
      {
        id: editId,
        name: form.name || undefined,
        slug: form.slug || undefined,
        description: form.description || undefined,
        is_public: form.is_public,
      },
      {
        onSuccess: () => {
          reset()
        },
      },
    )
  }

  const handleDelete = () => {
    if (!editId) return
    deleteOrg.mutate(editId, {
      onSuccess: () => {
        if (selectedOrg?.id === editId) selectOrg(orgs?.[0] ?? null as unknown as OrgResponse)
        reset()
      },
    })
  }

  const openEdit = (org: OrgResponse) => {
    setEditId(org.id)
    setForm({
      name: org.name,
      slug: org.slug,
      description: org.description ?? "",
      is_public: org.is_public,
    })
    setView("edit")
  }

  const openDelete = (org: OrgResponse) => {
    setEditId(org.id)
    setForm({ ...emptyForm, name: org.name })
    setDeleteConfirm("")
    setView("delete")
  }

  const isAdmin = (org: OrgResponse) => org.role === "admin"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {view === "list" && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Organizations</DialogTitle>
            <DialogDescription>Select or manage your organizations</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {orgs?.map((org) => (
                <div
                  key={org.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    org.id === selectedOrg?.id
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <button
                    onClick={() => handleSelect(org)}
                    className="flex flex-1 items-center gap-3 text-left min-w-0"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate text-sm">{org.name}</p>
                      <p className="text-xs text-muted-foreground">{org.slug}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                      {org.role}
                    </span>
                    {org.id === selectedOrg?.id && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                  {isAdmin(org) && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(org)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDelete(org)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <Separator />

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setForm(emptyForm)
              setView("create")
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Organization
          </Button>
        </DialogContent>
      )}

      {view === "create" && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>Set up a new workspace for your team</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleCreate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: slugFromName(e.target.value),
                  }))
                }
                placeholder="My Organization"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="my-organization"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What's this org about?"
              />
            </div>
            <div className="flex items-center justify-between gap-4 pt-2">
              <Button type="button" variant="ghost" onClick={() => setView("list")}>
                Back
              </Button>
              <Button type="submit" disabled={createOrg.isPending || !form.name || !form.slug}>
                {createOrg.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
            {createOrg.isError && (
              <p className="text-sm text-destructive">
                {createOrg.error instanceof Error ? createOrg.error.message : "Failed to create"}
              </p>
            )}
          </form>
        </DialogContent>
      )}

      {view === "edit" && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleUpdate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: form.slug === slugFromName(f.name)
                      ? slugFromName(e.target.value)
                      : f.slug,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-slug">Slug</Label>
              <Input
                id="edit-slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4 pt-2">
              <Button type="button" variant="ghost" onClick={() => setView("list")}>
                Back
              </Button>
              <Button type="submit" disabled={updateOrg.isPending}>
                {updateOrg.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
            {updateOrg.isError && (
              <p className="text-sm text-destructive">
                {updateOrg.error instanceof Error ? updateOrg.error.message : "Failed to update"}
              </p>
            )}
          </form>
        </DialogContent>
      )}

      {view === "delete" && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Organization
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the organization
              <strong> &quot;{form.name}&quot;</strong> and all its data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type <span className="font-semibold">{form.name}</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={form.name}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Button type="button" variant="ghost" onClick={() => setView("list")}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteConfirm !== form.name || deleteOrg.isPending}
              >
                {deleteOrg.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Organization
              </Button>
            </div>
            {deleteOrg.isError && (
              <p className="text-sm text-destructive">
                {deleteOrg.error instanceof Error ? deleteOrg.error.message : "Failed to delete"}
              </p>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
