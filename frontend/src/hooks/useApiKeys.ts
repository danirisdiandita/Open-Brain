import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apikeyApi } from "@/api/apikey"

export function useApiKeys(orgId: string | undefined) {
  return useQuery({
    queryKey: ["api-keys", orgId],
    queryFn: () => apikeyApi.list(orgId!),
    enabled: !!orgId,
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orgId, name }: { orgId: string; name: string }) =>
      apikeyApi.create(orgId, { name }),
    onSuccess: (_data, { orgId }) => {
      qc.invalidateQueries({ queryKey: ["api-keys", orgId] })
    },
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orgId, keyId }: { orgId: string; keyId: string }) =>
      apikeyApi.revoke(orgId, keyId),
    onSuccess: (_data, { orgId }) => {
      qc.invalidateQueries({ queryKey: ["api-keys", orgId] })
    },
  })
}
