import api from "./client"

export interface OrgPayload {
  name: string
  slug: string
  description?: string
  is_public?: boolean
}

export interface OrgUpdatePayload {
  name?: string
  slug?: string
  description?: string
  is_public?: boolean
}

export interface OrgResponse {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  is_public: boolean
  role: "admin" | "editor" | "writer" | "viewer"
  created_at: string
}

export interface AIConfigField {
  value: string | number | null
  is_default: boolean
}

export interface AIConfigResponse {
  folder_suggestion_system: AIConfigField
  folder_tree_system: AIConfigField
  chat_system: AIConfigField
  rag_system: AIConfigField
  ai_model: AIConfigField
  temperature: AIConfigField
}

export interface AIConfigUpdate {
  folder_suggestion_system?: string | null
  folder_tree_system?: string | null
  chat_system?: string | null
  rag_system?: string | null
  ai_model?: string | null
  temperature?: number | null
}

export const orgApi = {
  list: () => api.get<OrgResponse[]>("/organizations").then((r) => r.data),

  get: (id: string) => api.get<OrgResponse>(`/organizations/${id}`).then((r) => r.data),

  create: (body: OrgPayload) =>
    api.post<OrgResponse>("/organizations", body).then((r) => r.data),

  update: (id: string, body: OrgUpdatePayload) =>
    api.patch<OrgResponse>(`/organizations/${id}`, body).then((r) => r.data),

  delete: (id: string) => api.delete(`/organizations/${id}`).then((r) => r.data),

  getAIConfig: (orgId: string) =>
    api.get<AIConfigResponse>(`/organizations/${orgId}/ai-config`).then((r) => r.data),

  updateAIConfig: (orgId: string, body: AIConfigUpdate) =>
    api.patch<AIConfigResponse>(`/organizations/${orgId}/ai-config`, body).then((r) => r.data),
}
