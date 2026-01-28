"use client";

import { useState } from "react";
import { useFolders, useCreateFolder } from "@/hooks/use-folders";
import { useNotes, useCreateNote } from "@/hooks/use-notes";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import { Folder, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ClientOnlyDate } from "@/components/client-only-date";

export function NotesSidebar() {
    const params = useParams();
    const router = useRouter();
    const selectedNoteId = params.id as string;

    const { data: folders, isLoading: foldersLoading } = useFolders();
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>('all');
    const { data: notes, isLoading: notesLoading } = useNotes(selectedFolderId);

    const createFolder = useCreateFolder();
    const createNote = useCreateNote();

    const [newFolderName, setNewFolderName] = useState("");
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;

        await createFolder.mutateAsync({ name: newFolderName, parentId: null });
        setNewFolderName("");
        setIsCreatingFolder(false);
    };

    const handleCreateNote = async () => {
        const newNote = await createNote.mutateAsync({
            title: "Untitled Note",
            folderId: selectedFolderId
        });
        router.push(`/dashboard/notes/${newNote.id}`);
    };

    return (
        <div className="flex h-full bg-white overflow-hidden border-r border-slate-200">
            {/* Folder sidebar */}
            <div className="w-56 border-r border-slate-100 flex flex-col bg-slate-50/10">
                <div className="p-4 flex items-center justify-between border-b border-slate-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                    <h2 className="font-semibold text-[10px] uppercase tracking-widest text-slate-400">Library</h2>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-slate-400 hover:text-primary transition-all rounded-full"
                        onClick={() => setIsCreatingFolder(true)}
                        disabled={createFolder.isPending}
                    >
                        {createFolder.isPending ? <Spinner className="size-3" /> : <Plus size={14} />}
                    </Button>
                </div>

                <div className="flex-1 overflow-auto p-2 space-y-0.5">
                    {/* General Categories */}
                    <div
                        className={cn(
                            "group flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer mb-2",
                            selectedFolderId === 'all'
                                ? "bg-primary/5 text-primary"
                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
                        )}
                        onClick={() => setSelectedFolderId('all')}
                    >
                        <span className="material-symbols-outlined text-lg opacity-70">inventory_2</span>
                        <span className="text-xs font-semibold flex-1 truncate">All Notes</span>
                    </div>

                    <div
                        className={cn(
                            "group flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer mb-4",
                            selectedFolderId === null
                                ? "bg-primary/5 text-primary"
                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
                        )}
                        onClick={() => setSelectedFolderId(null)}
                    >
                        <span className="material-symbols-outlined text-lg opacity-70">drafts</span>
                        <span className="text-xs font-semibold flex-1 truncate">Uncategorized</span>
                    </div>

                    <h3 className="px-3 pb-1 text-[9px] font-bold uppercase text-slate-400 tracking-widest">Folders</h3>
                    {isCreatingFolder && (
                        <form onSubmit={handleCreateFolder} className="px-2 mb-2">
                            <Input
                                autoFocus
                                className="h-8 text-xs rounded-lg border-slate-200"
                                placeholder="Folder name..."
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                onBlur={() => !newFolderName && setIsCreatingFolder(false)}
                            />
                        </form>
                    )}

                    {foldersLoading ? (
                        <div className="flex justify-center py-4 text-slate-400">
                            <Spinner />
                        </div>
                    ) : (
                        folders?.map(folder => (
                            <div
                                key={folder.id}
                                className={cn(
                                    "group flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                                    selectedFolderId === folder.id
                                        ? "bg-primary/5 text-primary"
                                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
                                )}
                                onClick={() => setSelectedFolderId(folder.id)}
                            >
                                <Folder size={14} className={cn(selectedFolderId === folder.id ? "text-primary" : "text-slate-300")} />
                                <span className="text-xs font-medium flex-1 truncate">{folder.name}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Notes list */}
            <div className="w-64 flex flex-col bg-white">
                <div className="p-4 flex items-center justify-between border-b border-slate-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                    <h2 className="font-semibold text-[10px] uppercase tracking-widest text-slate-400">Notes</h2>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-slate-400 hover:text-primary transition-all rounded-full"
                        onClick={handleCreateNote}
                        disabled={createNote.isPending}
                    >
                        {createNote.isPending ? <Spinner className="size-3" /> : <Plus size={14} />}
                    </Button>
                </div>

                <div className="flex-1 overflow-auto">
                    {notesLoading ? (
                        <div className="flex justify-center py-8 text-slate-400">
                            <Spinner />
                        </div>
                    ) : notes?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50/20">
                            <p className="text-[10px] font-medium text-slate-400">No notes here</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {notes?.map(note => (
                                <Link
                                    key={note.id}
                                    href={`/dashboard/notes/${note.id}`}
                                    className={cn(
                                        "block p-4 cursor-pointer transition-all border-l-2",
                                        selectedNoteId === note.id
                                            ? "bg-primary/5 border-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                                            : "hover:bg-slate-50 border-transparent"
                                    )}
                                >
                                    <h3 className={cn(
                                        "text-xs font-semibold truncate",
                                        selectedNoteId === note.id ? "text-primary" : "text-slate-700"
                                    )}>
                                        {note.title || "Untitled Note"}
                                    </h3>
                                    <p className="text-[9px] uppercase font-bold tracking-wider text-slate-300 mt-1">
                                        <ClientOnlyDate date={note.updatedAt} />
                                    </p>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
