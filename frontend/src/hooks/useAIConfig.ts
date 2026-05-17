import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { orgApi, type AIConfigUpdate } from "@/api/organization"

export function useAIConfig(orgId?: string) {
  return useQuery({
    queryKey: ["ai-config", orgId],
    queryFn: () => orgApi.getAIConfig(orgId!),
    enabled: !!orgId,
  })
}

export function useUpdateAIConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ orgId, ...body }: { orgId: string } & AIConfigUpdate) =>
      orgApi.updateAIConfig(orgId, body),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ai-config", vars.orgId] })
    },
  })
}
