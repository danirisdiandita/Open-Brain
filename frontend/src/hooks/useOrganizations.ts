import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { orgApi, type OrgPayload, type OrgUpdatePayload } from "@/api/organization"

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: orgApi.list,
  })
}

export function useCreateOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: OrgPayload) => orgApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] })
    },
  })
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & OrgUpdatePayload) =>
      orgApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] })
    },
  })
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => orgApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] })
    },
  })
}
