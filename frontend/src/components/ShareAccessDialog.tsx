import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useOrganization } from "@/contexts/OrganizationContext"
import api from "@/api/client"

interface Member {
  user_id: string
  email: string
  full_name: string | null
  role: string
  access_scope: string
  joined_at: string
}

interface ShareTarget {
  type: "folder" | "note"
  id: string
  name: string
}

interface ShareAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: ShareTarget | null
}

export function ShareAccessDialog({ open, onOpenChange, target }: ShareAccessDialogProps) {
  const { selectedOrg } = useOrganization()
  const orgId = selectedOrg?.id
  const queryClient = useQueryClient()
  const [includeSubfolders, setIncludeSubfolders] = useState(false)
  const [grantedIds, setGrantedIds] = useState<Set<string>>(new Set())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  const { data: members } = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => api.get<Member[]>(`/organizations/${orgId}/members`).then((r) => r.data),
    enabled: !!orgId && open,
  })

  const { data: existingAccess } = useQuery({
    queryKey: ["access", target?.type, target?.id],
    queryFn: () =>
      api.get<{ user_id: string }[]>(
        `/organizations/${orgId}/${target!.type}s/${target!.id}/members`
      ).then((r) => r.data),
    enabled: !!orgId && !!target && open,
  })

  useEffect(() => {
    if (existingAccess) {
      setGrantedIds(new Set(existingAccess.map((a) => a.user_id)))
      setPendingIds(new Set())
    }
  }, [existingAccess])

  const grantMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      api.post(`/organizations/${orgId}/members/${userId}/${target!.type}s/${target!.id}`),
    onSuccess: (_, { userId }) => {
      setGrantedIds((prev) => new Set(prev).add(userId))
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
      queryClient.invalidateQueries({ queryKey: ["access", target?.type, target?.id] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      api.delete(`/organizations/${orgId}/members/${userId}/${target!.type}s/${target!.id}`),
    onSuccess: (_, { userId }) => {
      setGrantedIds((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
      queryClient.invalidateQueries({ queryKey: ["access", target?.type, target?.id] })
    },
  })

  const toggleMember = (userId: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const applyChanges = () => {
    if (!target) return
    pendingIds.forEach((userId) => {
      if (!grantedIds.has(userId)) {
        grantMutation.mutate({ userId })
      }
    })
    grantedIds.forEach((userId) => {
      if (!pendingIds.has(userId) && !grantMutation.isPending) {
        revokeMutation.mutate({ userId })
      }
    })
  }

  if (!target) return null

  const filtered = members?.filter((m) => m.access_scope !== "all")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share "{target.name}"
          </DialogTitle>
          <DialogDescription>
            Grant {target.type} access to team members with restricted access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {!filtered || filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              All members already have full access.
            </p>
          ) : (
            filtered.map((m) => {
              const isChecked = pendingIds.has(m.user_id) || (grantedIds.has(m.user_id) && !pendingIds.has(m.user_id))
              const isAlready = grantedIds.has(m.user_id)
              return (
                <label
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleMember(m.user_id)}
                    className="rounded"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{m.full_name || m.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.role} · {
                        m.access_scope === "selected" ? "Selected folders" :
                        m.access_scope === "blocked" ? "No access" : "All access"
                      }
                    </p>
                  </div>
                  {isAlready && !pendingIds.has(m.user_id) && (
                    <span className="text-[10px] text-muted-foreground">Shared</span>
                  )}
                </label>
              )
            })
          )}
        </div>

        {target.type === "folder" && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeSubfolders}
              onChange={(e) => setIncludeSubfolders(e.target.checked)}
              className="rounded"
            />
            Include subfolders
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button
            onClick={applyChanges}
            disabled={grantMutation.isPending || revokeMutation.isPending}
          >
            {(grantMutation.isPending || revokeMutation.isPending) && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
