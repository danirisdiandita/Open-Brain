import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface Folder {
    id: string;
    name: string;
    parentId: string | null;
    userId: string;
    createdAt: string;
    updatedAt: string;
}

export function useFolders() {
    return useQuery<Folder[]>({
        queryKey: ["folders"],
        queryFn: async () => {
            const res = await fetch("/api/folders");
            if (!res.ok) throw new Error("Failed to fetch folders");
            return res.json();
        },
    });
}

export function useCreateFolder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name: string; parentId?: string | null }) => {
            const res = await fetch("/api/folders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to create folder");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["folders"] });
            toast.success("Folder created successfully");
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to create folder");
        },
    });
}
