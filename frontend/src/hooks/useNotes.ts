import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { noteApi, type NotePayload, type NoteUpdatePayload } from "@/api/note"

const PAGE_SIZE = 20

export function useNotes(orgId?: string, folderId?: string) {
  return useQuery({
    queryKey: ["notes", orgId, folderId],
    queryFn: () => noteApi.list(orgId!, folderId, 0, 1000),
    enabled: !!orgId,
  })
}

export function useInfiniteNotes(orgId?: string, folderId?: string) {
  return useInfiniteQuery({
    queryKey: ["notes", orgId, folderId, "infinite"],
    queryFn: ({ pageParam = 0 }) => noteApi.list(orgId!, folderId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return allPages.length * PAGE_SIZE
    },
    enabled: !!orgId,
  })
}

export function useNote(orgId?: string, noteId?: string) {
  return useQuery({
    queryKey: ["notes", orgId, noteId],
    queryFn: () => noteApi.get(orgId!, noteId!),
    enabled: !!orgId && !!noteId,
  })
}

export function useCreateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orgId, body }: { orgId: string; body: NotePayload }) =>
      noteApi.create(orgId, body),
    onSuccess: (_data, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: ["notes", orgId] })
    },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orgId, id, body }: { orgId: string; id: string; body: NoteUpdatePayload }) =>
      noteApi.update(orgId, id, body),
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: ["notes", orgId] })
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orgId, id }: { orgId: string; id: string }) =>
      noteApi.delete(orgId, id),
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: ["notes", orgId] })
    },
  })
}

export function useUploadNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orgId, file, folderId }: { orgId: string; file: File; folderId?: string }) =>
      noteApi.upload(orgId, file, folderId),
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: ["notes", orgId] })
    },
  })
}

export function useSuggestFolder() {
  return useMutation({
    mutationFn: ({ orgId, noteId }: { orgId: string; noteId: string }) =>
      noteApi.suggestFolder(orgId, noteId),
  })
}
