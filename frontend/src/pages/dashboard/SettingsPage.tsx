import { useState, useEffect } from "react"
import { RotateCcw, Loader2, Check, AlertCircle, Plus, Copy, Key, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useAIConfig, useUpdateAIConfig } from "@/hooks/useAIConfig"
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "@/hooks/useApiKeys"
import type { AIConfigUpdate } from "@/api/organization"
import type { ApiKeyCreated } from "@/api/apikey"

const PROMPT_FIELDS = [
  { key: "folder_suggestion_system", label: "Folder Suggestion", description: "System prompt for suggesting folders for notes" },
  { key: "folder_tree_system", label: "Folder Tree Generation", description: "System prompt for generating folder structures" },
  { key: "chat_system", label: "Chat Assistant", description: "System prompt for the chat assistant. Use {history_section} and {context} variables." },
  { key: "rag_system", label: "RAG Search", description: "System prompt for RAG-based search. Use {context} variable." },
] as const

const TEMPLATE_VARS = [
  { name: "{org_name}", desc: "Organization name" },
  { name: "{date}", desc: "Current date (ISO)" },
  { name: "{note_title}", desc: "Note title (folder suggestion)" },
  { name: "{note_content}", desc: "Note content preview (folder suggestion)" },
  { name: "{history_section}", desc: "Conversation history (chat)" },
  { name: "{context}", desc: "RAG context chunks (chat/rag)" },
]

export default function SettingsPage() {
  const { selectedOrg } = useOrganization()
  const orgId = selectedOrg?.id
  const currentRole = selectedOrg?.role ?? "viewer"
  const canEdit = currentRole === "admin" || currentRole === "editor"

  const { data: config, isLoading } = useAIConfig(orgId)
  const updateMutation = useUpdateAIConfig()

  const [form, setForm] = useState<Record<string, string | number>>({})
  const [saved, setSaved] = useState(false)

  const [showCreateKey, setShowCreateKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: apiKeys, isLoading: keysLoading } = useApiKeys(orgId)
  const createKeyMut = useCreateApiKey()
  const revokeKeyMut = useRevokeApiKey()

  useEffect(() => {
    if (config) {
      setForm({
        folder_suggestion_system: config.folder_suggestion_system.value ?? "",
        folder_tree_system: config.folder_tree_system.value ?? "",
        chat_system: config.chat_system.value ?? "",
        rag_system: config.rag_system.value ?? "",
        ai_model: config.ai_model.value ?? "",
        temperature: config.temperature.value ?? 0.3,
      })
      setSaved(false)
    }
  }, [config])

  if (!orgId) return null

  const isDirty = config
    ? form.folder_suggestion_system !== (config.folder_suggestion_system.value ?? "") ||
      form.folder_tree_system !== (config.folder_tree_system.value ?? "") ||
      form.chat_system !== (config.chat_system.value ?? "") ||
      form.rag_system !== (config.rag_system.value ?? "") ||
      form.ai_model !== (config.ai_model.value ?? "") ||
      Number(form.temperature) !== Number(config.temperature.value ?? 0.3)
    : false

  const handleChange = (key: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleReset = (key: string) => {
    if (!config) return
    const fieldMap: Record<string, string | number | null> = {
      folder_suggestion_system: config.folder_suggestion_system.value,
      folder_tree_system: config.folder_tree_system.value,
      chat_system: config.chat_system.value,
      rag_system: config.rag_system.value,
      ai_model: config.ai_model.value,
      temperature: config.temperature.value,
    }
    const val = fieldMap[key]
    if (val !== undefined) {
      handleChange(key, val ?? "")
    }
  }

  const handleSave = () => {
    if (!orgId) return
    const body: AIConfigUpdate = {
      folder_suggestion_system: String(form.folder_suggestion_system) || null,
      folder_tree_system: String(form.folder_tree_system) || null,
      chat_system: String(form.chat_system) || null,
      rag_system: String(form.rag_system) || null,
      ai_model: String(form.ai_model) || null,
      temperature: Number(form.temperature) || null,
    }

    updateMutation.mutate({ orgId, ...body }, {
      onSuccess: () => setSaved(true),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure AI behavior for {selectedOrg?.name ?? "this organization"}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : config ? (
        <>
          {/* ── AI Model & Temperature ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Model</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-model">Model</Label>
                <Input
                  id="ai-model"
                  value={String(form.ai_model ?? "")}
                  onChange={(e) => handleChange("ai_model", e.target.value)}
                  placeholder="gpt-4.1-mini"
                  disabled={!canEdit}
                />
                {!config.ai_model.is_default && (
                  <p className="text-xs text-muted-foreground">
                    Default: gpt-4.1-mini
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature ({form.temperature})</Label>
                <Input
                  id="temperature"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.temperature ?? ""}
                  onChange={(e) => handleChange("temperature", parseFloat(e.target.value) || 0)}
                  disabled={!canEdit}
                />
                {!config.temperature.is_default && (
                  <p className="text-xs text-muted-foreground">
                    Default: 0.3
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── System Prompts ── */}
          {PROMPT_FIELDS.map(({ key, label, description }) => (
            <Card key={key}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{label}</CardTitle>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!config[key].is_default && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                        Custom
                      </span>
                    )}
                    {canEdit && !config[key].is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleReset(key)}
                        title="Reset to default"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={String(form[key] ?? "")}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="font-mono text-xs min-h-[120px]"
                  disabled={!canEdit}
                  placeholder={String(config[key].value ?? "")}
                />
              </CardContent>
            </Card>
          ))}

          {/* ── Template Variables Reference ── */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-sm">Available Template Variables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {TEMPLATE_VARS.map((v) => (
                  <div key={v.name} className="flex items-baseline gap-2 text-xs">
                    <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{v.name}</code>
                    <span className="text-muted-foreground">{v.desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Save Bar ── */}
          {canEdit && (
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={!isDirty || updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : saved ? (
                  <Check className="mr-2 h-3.5 w-3.5" />
                ) : null}
                {saved ? "Saved" : "Save Changes"}
              </Button>
              {isDirty && (
                <span className="text-xs text-muted-foreground">Unsaved changes</span>
              )}
              {updateMutation.isError && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {updateMutation.error instanceof Error ? updateMutation.error.message : "Failed to save"}
                </span>
              )}
            </div>
          )}
        </>
      ) : null}

      {/* ── API Keys ── */}
      {currentRole === "admin" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">API Keys</CardTitle>
              <Button size="sm" onClick={() => { setShowCreateKey(true); setCreatedKey(null); setNewKeyName(""); setCopied(false) }}>
                <Plus className="mr-1.5 h-4 w-4" />
                Create New Key
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {keysLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : apiKeys && apiKeys.length > 0 ? (
              <div className="space-y-2">
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{key.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(key.created_at).toLocaleDateString()}
                          {key.last_used_at ? ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}` : " · Never used"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (window.confirm(`Revoke "${key.name}"? This cannot be undone.`)) {
                          revokeKeyMut.mutate({ orgId: orgId!, keyId: key.id })
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No API keys yet. Create one to get started.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Create API Key Dialog ── */}
      <Dialog open={showCreateKey} onOpenChange={setShowCreateKey}>
        <DialogContent className="sm:max-w-md">
          {createdKey ? (
            <>
              <DialogHeader>
                <DialogTitle>API Key Created</DialogTitle>
                <DialogDescription>
                  Copy this key now. You won&apos;t be able to see it again.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                <code className="flex-1 font-mono text-xs break-all select-all">
                  {createdKey.raw_token}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(createdKey.raw_token)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { setShowCreateKey(false); setCreatedKey(null) }}>
                  Done
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Create New API Key</DialogTitle>
                <DialogDescription>
                  Give your key a name so you can identify it later.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">Key Name</Label>
                  <Input
                    id="key-name"
                    placeholder="e.g. Slack Bot, Zapier"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newKeyName.trim()) {
                        createKeyMut.mutate(
                          { orgId: orgId!, name: newKeyName.trim() },
                          { onSuccess: (data) => setCreatedKey(data) },
                        )
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateKey(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      createKeyMut.mutate(
                        { orgId: orgId!, name: newKeyName.trim() || "Default" },
                        { onSuccess: (data) => setCreatedKey(data) },
                      )
                    }}
                    disabled={createKeyMut.isPending}
                  >
                    {createKeyMut.isPending ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Create
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
