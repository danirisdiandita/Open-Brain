import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/api/client"

interface RecentNote {
  note_id: string
  title: string
  folder_id: string | null
  folder_name: string
  opened_at: string
}

export function useRecentNotes(orgId?: string) {
  const queryClient = useQueryClient()

  const { data: recentNotes } = useQuery({
    queryKey: ["recent", orgId],
    queryFn: () => api.get<RecentNote[]>(`/organizations/${orgId}/recent`).then((r) => r.data),
    enabled: !!orgId,
  })

  const trackMutation = useMutation({
    mutationFn: (noteId: string) =>
      api.post(`/organizations/${orgId}/recent`, { note_id: noteId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recent", orgId] }),
  })

  return {
    recentNotes: (recentNotes ?? []) as RecentNote[],
    trackRecentNote: trackMutation.mutate,
  }
}

export function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}
