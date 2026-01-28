"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ListOrdered, Quote, Code, Heading1, Heading2, Cloud, CloudOff, Info } from "lucide-react";
import { Spinner } from "@/components/spinner";
import { useUpdateNote } from "@/hooks/use-notes";

interface EditorProps {
    noteId: string;
    initialTitle: string;
    userName: string;
    provider: HocuspocusProvider;
    ydoc: Y.Doc;
}

export function Editor({ noteId, initialTitle, userName, provider, ydoc }: EditorProps) {
    const [title, setTitle] = useState(initialTitle);
    const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>(provider.status as any);
    const updateNote = useUpdateNote();

    useEffect(() => {
        provider.on('status', ({ status }: { status: any }) => setStatus(status));
    }, [provider]);

    // Debounced title update
    useEffect(() => {
        if (title === initialTitle) return;

        const timeout = setTimeout(() => {
            updateNote.mutate({ id: noteId, title });
        }, 1000);

        return () => clearTimeout(timeout);
    }, [title, noteId, initialTitle, updateNote]);

    const extensions = useMemo(() => [
        StarterKit.configure({
            history: false as any,
        }),
        Collaboration.configure({
            document: ydoc,
        }),
        CollaborationCursor.configure({
            provider: provider,
            user: {
                name: userName,
                color: "#10b981",
            },
        }),
    ], [provider, ydoc, userName]);

    const editor = useEditor({
        immediatelyRender: false,
        autofocus: 'end',
        extensions: extensions,
        editorProps: {
            attributes: {
                class: "prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl focus:outline-none max-w-none min-h-[calc(100vh-350px)] pb-20",
            },
        },
    }, [extensions]);

    if (!editor) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50/10">
                <Spinner className="text-primary size-8" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header / Meta */}
            <div className="px-8 pt-12 pb-4 max-w-3xl mx-auto w-full">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {status === 'connected' ? (
                            <>
                                <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                <span className="text-emerald-600">Synced to Brain</span>
                            </>
                        ) : (
                            <>
                                <CloudOff className="size-3 text-slate-300" />
                                <span>Syncing...</span>
                            </>
                        )}
                    </div>
                </div>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Note Title"
                    className="w-full text-4xl font-black tracking-tight text-slate-900 border-none outline-none placeholder:text-slate-200 focus:ring-0"
                />
            </div>

            {/* Toolbar */}
            <div className="border-y border-slate-100 p-2 flex items-center gap-1 sticky top-0 bg-white/80 backdrop-blur-md z-10 px-8">
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive("bold") ? "bg-slate-100 text-primary" : "text-slate-500"}
                >
                    <Bold size={16} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={editor.isActive("italic") ? "bg-slate-100 text-primary" : "text-slate-500"}
                >
                    <Italic size={16} />
                </Button>
                <div className="w-[1px] h-4 bg-slate-200 mx-1" />
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={editor.isActive("heading", { level: 1 }) ? "bg-slate-100 text-primary" : "text-slate-500"}
                >
                    <Heading1 size={16} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={editor.isActive("heading", { level: 2 }) ? "bg-slate-100 text-primary" : "text-slate-500"}
                >
                    <Heading2 size={16} />
                </Button>
                <div className="w-[1px] h-4 bg-slate-200 mx-1" />
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive("bulletList") ? "bg-slate-100 text-primary" : "text-slate-500"}
                >
                    <List size={16} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive("orderedList") ? "bg-slate-100 text-primary" : "text-slate-500"}
                >
                    <ListOrdered size={16} />
                </Button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto cursor-text px-8 pb-32" onClick={() => editor.commands.focus()}>
                <div className="max-w-3xl mx-auto py-10">
                    <EditorContent editor={editor} />
                </div>
            </div>
        </div>
    );
}
