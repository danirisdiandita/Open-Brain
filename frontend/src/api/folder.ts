import api from "./client"

export interface FolderPayload {
  name: string
  slug: string
  description?: string
  parent_id?: string
  order_index?: number
}

export interface FolderUpdatePayload {
  name?: string
  slug?: string
  description?: string
  parent_id?: string
  order_index?: number
}

export interface FolderResponse {
  id: string
  organization_id: string
  parent_id: string | null
  name: string
  slug: string
  description: string | null
  order_index: number
  created_at: string
}

export const folderApi = {
  list: (orgId: string) => api.get<FolderResponse[]>(`/organizations/${orgId}/folders`).then((r) => r.data),

  get: (orgId: string, id: string) => api.get<FolderResponse>(`/organizations/${orgId}/folders/${id}`).then((r) => r.data),

  create: (orgId: string, body: FolderPayload) =>
    api.post<FolderResponse>(`/organizations/${orgId}/folders`, body).then((r) => r.data),

  update: (orgId: string, id: string, body: FolderUpdatePayload) =>
    api.patch<FolderResponse>(`/organizations/${orgId}/folders/${id}`, body).then((r) => r.data),

  delete: (orgId: string, id: string) => api.delete(`/organizations/${orgId}/folders/${id}`).then((r) => r.data),
}
