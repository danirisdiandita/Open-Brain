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
  list: (orgId: string, folderId?: string, skip = 0, limit = 20) =>
    api.get<NoteResponse[]>("/organizations/" + orgId + "/notes", {
      params: {
        ...(folderId ? { folder_id: folderId } : {}),
        skip,
        limit,
      },
    }).then((r) => r.data),

  get: (orgId: string, id: string) =>
    api.get<NoteResponse>(`/organizations/${orgId}/notes/${id}`).then((r) => r.data),

  create: (orgId: string, body: NotePayload) =>
    api.post<NoteResponse>(`/organizations/${orgId}/notes`, body).then((r) => r.data),

  update: (orgId: string, id: string, body: NoteUpdatePayload) =>
    api.patch<NoteResponse>(`/organizations/${orgId}/notes/${id}`, body).then((r) => r.data),

  delete: (orgId: string, id: string) =>
    api.delete(`/organizations/${orgId}/notes/${id}`).then((r) => r.data),

  upload: (orgId: string, file: File, folderId?: string) => {
    const form = new FormData()
    form.append("file", file)
    if (folderId) form.append("folder_id", folderId)
    return api.post<NoteResponse>(`/organizations/${orgId}/notes/upload`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data)
  },

  suggestFolder: (orgId: string, noteId: string, allowNew = false) =>
    api.post<SuggestFolderResponse>(`/organizations/${orgId}/notes/${noteId}/suggest-folder`, { allow_new: allowNew }).then((r) => r.data),
}

export interface FolderSuggestion {
  folder_path: string
  reason: string
  score: number
  is_new?: boolean
  new_folder_name?: string | null
  new_folder_slug?: string | null
  new_folder_description?: string | null
}

export interface SuggestFolderResponse {
  suggestions: FolderSuggestion[]
  best_path: string
}
