import api from "./client"

export interface ApiKey {
  id: string
  name: string
  last_used_at: string | null
  is_active: boolean
  created_at: string
}

export interface ApiKeyCreated extends ApiKey {
  raw_token: string
}

export interface ApiKeyCreatePayload {
  name: string
}

export const apikeyApi = {
  list: (orgId: string) =>
    api.get<ApiKey[]>(`/organizations/${orgId}/api-keys`).then((r) => r.data),

  create: (orgId: string, body: ApiKeyCreatePayload) =>
    api.post<ApiKeyCreated>(`/organizations/${orgId}/api-keys`, body).then((r) => r.data),

  revoke: (orgId: string, keyId: string) =>
    api.delete(`/organizations/${orgId}/api-keys/${keyId}`),
}
