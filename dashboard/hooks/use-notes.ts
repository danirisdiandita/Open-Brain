import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface Note {
    id: string;
    title: string;
    content: string | null;
    folderId: string | null;
    userId: string;
    createdAt: string;
    updatedAt: string;
}

export function useNotes(folderId?: string | null) {
    return useQuery<Note[]>({
        queryKey: ["notes", folderId],
        queryFn: async () => {
            const url = folderId ? `/api/notes?folderId=${folderId}` : "/api/notes";
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch notes");
            return res.json();
        },
    });
}

export function useNote(id: string) {
    return useQuery<Note>({
        queryKey: ["note", id],
        queryFn: async () => {
            const res = await fetch(`/api/notes/${id}`);
            if (!res.ok) throw new Error("Failed to fetch note");
            return res.json();
        },
    });
}

export function useCreateNote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { title: string; folderId?: string | null; content?: string }) => {
            const res = await fetch("/api/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to create note");
            return res.json();
        },
        onSuccess: (newNote) => {
            queryClient.invalidateQueries({ queryKey: ["notes", newNote.folderId] });
            toast.success("Note created successfully");
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to create note");
        },
    });
}

export function useUpdateNote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...data }: { id: string; title: string }) => {
            const res = await fetch(`/api/notes/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to update note");
            return res.json();
        },
        onSuccess: (note) => {
            queryClient.invalidateQueries({ queryKey: ["notes"] });
            queryClient.invalidateQueries({ queryKey: ["note", note.id] });
        },
    });
}
