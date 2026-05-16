import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { folderApi, type FolderPayload, type FolderUpdatePayload, type FolderTreeNode } from "@/api/folder"

export function useFolders(orgId?: string) {
  return useQuery({
    queryKey: ["folders", orgId],
    queryFn: () => folderApi.list(orgId!),
    enabled: !!orgId,
  })
}

export function useCreateFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orgId, body }: { orgId: string; body: FolderPayload }) => folderApi.create(orgId, body),
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: ["folders", orgId] })
    },
  })
}

export function useUpdateFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orgId, id, body }: { orgId: string; id: string; body: FolderUpdatePayload }) =>
      folderApi.update(orgId, id, body),
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: ["folders", orgId] })
    },
  })
}

export function useDeleteFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orgId, id }: { orgId: string; id: string }) => folderApi.delete(orgId, id),
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: ["folders", orgId] })
    },
  })
}

export function useGenerateFolders() {
  return useMutation({
    mutationFn: ({ orgId, description }: { orgId: string; description: string }) =>
      folderApi.generate(orgId, description),
  })
}

export function useApplyGeneratedFolders() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orgId, roots }: { orgId: string; roots: FolderTreeNode[] }) =>
      folderApi.applyGenerated(orgId, roots),
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: ["folders", orgId] })
    },
  })
}
