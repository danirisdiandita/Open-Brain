import api from "./client"

export interface NotePayload {
  title: string
  slug: string
  content?: string
  folder_id?: string
}

export interface NoteUpdatePayload {
  title?: string
  slug?: string
  content?: string
  is_published?: boolean
  folder_id?: string
}

export interface NoteResponse {
  id: string
  organization_id: string
  folder_id: string | null
  title: string
  slug: string
  content: string | null
  content_type: string
  is_published: boolean
  order_index: number
  created_by: string
  created_at: string
  updated_at: string
}

export const noteApi = {
  list: (orgId: string, folderId?: string) =>
    api.get<NoteResponse[]>("/organizations/" + orgId + "/notes", {
      params: folderId ? { folder_id: folderId } : {},
    }).then((r) => r.data),

  get: (orgId: string, id: string) =>
    api.get<NoteResponse>(`/organizations/${orgId}/notes/${id}`).then((r) => r.data),

  create: (orgId: string, body: NotePayload) =>
    api.post<NoteResponse>(`/organizations/${orgId}/notes`, body).then((r) => r.data),

  update: (orgId: string, id: string, body: NoteUpdatePayload) =>
    api.patch<NoteResponse>(`/organizations/${orgId}/notes/${id}`, body).then((r) => r.data),

  delete: (orgId: string, id: string) =>
    api.delete(`/organizations/${orgId}/notes/${id}`).then((r) => r.data),
}
