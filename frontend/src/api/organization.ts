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

export const orgApi = {
  list: () => api.get<OrgResponse[]>("/organizations").then((r) => r.data),

  get: (id: string) => api.get<OrgResponse>(`/organizations/${id}`).then((r) => r.data),

  create: (body: OrgPayload) =>
    api.post<OrgResponse>("/organizations", body).then((r) => r.data),

  update: (id: string, body: OrgUpdatePayload) =>
    api.patch<OrgResponse>(`/organizations/${id}`, body).then((r) => r.data),

  delete: (id: string) => api.delete(`/organizations/${id}`).then((r) => r.data),
}
