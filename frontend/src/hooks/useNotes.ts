import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { noteApi, type NotePayload, type NoteUpdatePayload } from "@/api/note"

export function useNotes(orgId?: string, folderId?: string) {
  return useQuery({
    queryKey: ["notes", orgId, folderId],
    queryFn: () => noteApi.list(orgId!, folderId),
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
