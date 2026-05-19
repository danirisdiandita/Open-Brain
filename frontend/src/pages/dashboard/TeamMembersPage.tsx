import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Users, MoreHorizontal, Mail, Shield, Crown, Loader2,
  UserPlus, Clock, X, Trash2, UserCheck, Copy, Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useFolders } from "@/hooks/useFolders"
import { useAuth } from "@/contexts/AuthContext"
import api from "@/api/client"

const ROLES = [
  { value: "admin", label: "Admin", icon: Crown, description: "Full access to organization, members, and content" },
  { value: "editor", label: "Editor", icon: Shield, description: "Can create, edit, delete, and organize content" },
  { value: "writer", label: "Writer", icon: Users, description: "Can create and edit own pages" },
  { value: "viewer", label: "Viewer", icon: Users, description: "Read-only access" },
] as const

interface Member {
  user_id: string
  email: string
  full_name: string | null
  role: (typeof ROLES)[number]["value"]
  joined_at: string
}

interface Invitation {
  id: string
  email: string
  role: (typeof ROLES)[number]["value"]
  created_at: string
  expires_at: string
}

function RoleBadge({ role }: { role: string }) {
  const r = ROLES.find((x) => x.value === role) ?? ROLES[3]
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
      role === "admin" ? "bg-amber-100 text-amber-700" :
      role === "editor" ? "bg-blue-100 text-blue-700" :
      role === "writer" ? "bg-green-100 text-green-700" :
      "bg-muted text-muted-foreground"
    }`}>
      <r.icon className="h-3 w-3" />
      {r.label}
    </span>
  )
}

export default function TeamMembersPage() {
  const { selectedOrg } = useOrganization()
  const { email: userEmail } = useAuth()
  const orgId = selectedOrg?.id
  const queryClient = useQueryClient()

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => api.get<Member[]>(`/organizations/${orgId}/members`).then((r) => r.data),
    enabled: !!orgId,
  })

  const { data: invitations, isLoading: invLoading } = useQuery({
    queryKey: ["invitations", orgId],
    queryFn: () => api.get<Invitation[]>(`/organizations/${orgId}/invitations`).then((r) => r.data),
    enabled: !!orgId,
  })

  const { data: folders } = useFolders(orgId)

  const currentRole = selectedOrg?.role ?? "viewer"
  const isAdmin = currentRole === "admin"

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<(typeof ROLES)[number]["value"]>("editor")
  const [inviteScope, setInviteScope] = useState<string>("all")
  const [inviteFolderIds, setInviteFolderIds] = useState<string[]>([])
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [removeConfirm, setRemoveConfirm] = useState<Member | null>(null)
  const [changeRole, setChangeRole] = useState<{ member: Member; role: (typeof ROLES)[number]["value"] } | null>(null)
  const [revokeInvite, setRevokeInvite] = useState<Invitation | null>(null)

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string; access_scope: string; folder_ids?: string[] }) =>
      api.post(`/organizations/${orgId}/invitations`, data).then((r) => r.data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["invitations", orgId] })
      setInviteLink(response.invite_link || null)
      setInviteFolderIds([])
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      api.delete(`/organizations/${orgId}/invitations/${invitationId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invitations", orgId] }),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/organizations/${orgId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", orgId] })
      setRemoveConfirm(null)
    },
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/organizations/${orgId}/members/${userId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", orgId] })
      setChangeRole(null)
    },
  })

  if (!orgId) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage members and invitations for {selectedOrg?.name ?? "this organization"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* ── Role cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((role) => {
          const count = members?.filter((m) => m.role === role.value).length ?? 0
          return (
            <Card key={role.value} className="border-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <role.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{role.label}</p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">{role.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Members table ── */}
      <div className="rounded-2xl border">
        <div className="px-4 py-3 border-b bg-muted/50">
          <h2 className="text-sm font-semibold">Active Members ({members?.length ?? 0})</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Member</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Role</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 hidden sm:table-cell">Joined</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5 w-12" />
            </tr>
          </thead>
          <tbody>
            {membersLoading ? (
              <tr><td colSpan={4} className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : members?.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No members yet</td></tr>
            ) : (
              members?.map((m) => (
                <tr key={m.user_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {(m.full_name || m.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {m.full_name || m.email}
                          {userEmail && m.email === userEmail && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">You</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><RoleBadge role={m.role} /></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                    {new Date(m.joined_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {ROLES.map((r) => (
                            <DropdownMenuItem
                              key={r.value}
                              onClick={() => setChangeRole({ member: m, role: r.value })}
                              disabled={m.role === r.value}
                            >
                              <r.icon className="mr-2 h-4 w-4" />
                              <span>{m.role === r.value ? `Already ${r.label}` : `Change to ${r.label}`}</span>
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setRemoveConfirm(m)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Remove</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pending invitations ── */}
      {(invitations?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-dashed">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Pending Invitations ({invitations?.length})
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Email</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Role</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 hidden sm:table-cell">Invited</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5 w-12" />
              </tr>
            </thead>
            <tbody>
              {invLoading ? (
                <tr><td colSpan={4} className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : (
                invitations?.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm truncate">{p.email}</p>
                          <p className="text-[10px] text-muted-foreground">Not registered yet</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><RoleBadge role={p.role} /></td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRevokeInvite(p)}>
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Invite dialog ── */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) { setInviteLink(null); setInviteEmail(""); setInviteScope("all"); setCopied(false) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join {selectedOrg?.name ?? "this organization"}.
            </DialogDescription>
          </DialogHeader>

          {inviteLink ? (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-3">Invitation created. Share this link:</p>
                <div className="flex items-center gap-2">
                  <Input value={inviteLink} readOnly className="text-xs font-mono" />
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-10 w-10 shrink-0"
                    onClick={() => { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => { setInviteOpen(false); setInviteLink(null); setInviteEmail(""); setInviteScope("all"); setCopied(false) }}>Close</Button>
              </div>
            </div>
          ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tm-email">Email address</Label>
              <Input
                id="tm-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="grid gap-2">
                {ROLES.map((role) => (
                  <button
                    key={role.value}
                    className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors ${
                      inviteRole === role.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => setInviteRole(role.value)}
                  >
                    <role.icon className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{role.label}</p>
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    </div>
                    {inviteRole === role.value && (
                      <div className="ml-auto">
                        <UserCheck className="h-5 w-5 text-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Folder Access</Label>
              <div className="grid gap-2">
                {[
                  { value: "all", label: "All Folders", desc: "Access all current and future folders" },
                  { value: "selected", label: "Selected Folders", desc: "Only access specific folders you choose" },
                  { value: "blocked", label: "No Access", desc: "Block everything — grant access later" },
                ].map((scope) => (
                  <button
                    key={scope.value}
                    className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors ${
                      inviteScope === scope.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => setInviteScope(scope.value)}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{scope.label}</p>
                      <p className="text-xs text-muted-foreground">{scope.desc}</p>
                    </div>
                    {inviteScope === scope.value && <UserCheck className="h-5 w-5 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
            {inviteScope === "selected" && (
              <div className="space-y-2">
                <Label>Select Folders</Label>
                <div className="max-h-[200px] overflow-y-auto rounded-2xl border p-2 space-y-1">
                  {folders?.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No folders yet</p>
                  ) : (
                    folders?.map((f) => (
                      <label
                        key={f.id}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={inviteFolderIds.includes(f.id)}
                          onChange={() => {
                            setInviteFolderIds((prev) =>
                              prev.includes(f.id)
                                ? prev.filter((id) => id !== f.id)
                                : [...prev, f.id]
                            )
                          }}
                        />
                        <span className="text-sm truncate">
                          {f.name}
                          {f.parent_id && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                              in {folders?.find((p) => p.id === f.parent_id)?.name || "..."}
                            </span>
                          )}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button
                onClick={() =>
                  inviteMutation.mutate({
                    email: inviteEmail,
                    role: inviteRole,
                    access_scope: inviteScope,
                    folder_ids: inviteScope === "selected" ? inviteFolderIds : undefined,
                  })
                }
                disabled={!inviteEmail || inviteMutation.isPending}
              >
                {inviteMutation.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Send Invitation
              </Button>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Remove confirm ── */}
      <Dialog open={removeConfirm !== null} onOpenChange={() => setRemoveConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Remove <strong>{removeConfirm?.full_name || removeConfirm?.email}</strong> from the organization? They will lose access to all content.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setRemoveConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => removeMutation.mutate(removeConfirm!.user_id)} disabled={removeMutation.isPending}>
              {removeMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Change role confirm ── */}
      <Dialog open={changeRole !== null} onOpenChange={() => setChangeRole(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Change <strong>{changeRole?.member.full_name || changeRole?.member.email}</strong>'s role to{" "}
              <strong>{ROLES.find((r) => r.value === changeRole?.role)?.label}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setChangeRole(null)}>Cancel</Button>
            <Button onClick={() => changeRoleMutation.mutate({ userId: changeRole!.member.user_id, role: changeRole!.role })} disabled={changeRoleMutation.isPending}>
              {changeRoleMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Change Role
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Revoke invitation confirm ── */}
      <Dialog open={revokeInvite !== null} onOpenChange={() => setRevokeInvite(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke Invitation</DialogTitle>
            <DialogDescription>
              Revoke the invitation for <strong>{revokeInvite?.email}</strong>? They will no longer be able to join.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setRevokeInvite(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { revokeMutation.mutate(revokeInvite!.id); setRevokeInvite(null) }} disabled={revokeMutation.isPending}>
              {revokeMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Revoke
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
