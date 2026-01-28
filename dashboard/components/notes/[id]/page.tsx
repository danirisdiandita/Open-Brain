"use client";

import { authClient } from "@/lib/auth-client";
import { Editor } from "../editor";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { Spinner } from "@/components/spinner";
import { useNote } from "@/hooks/use-notes";

export default function NoteDetailPage() {
    const params = useParams();
    const { data: session } = authClient.useSession();
    const noteId = params.id as string;

    const { data: note, isLoading: noteLoading } = useNote(noteId);

    const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
    const ydoc = useMemo(() => new Y.Doc(), [noteId]);

    useEffect(() => {
        const hocuspocusProvider = new HocuspocusProvider({
            url: "ws://127.0.0.1:1234",
            name: `note-${noteId}`,
            document: ydoc,
        });

        setProvider(hocuspocusProvider);

        return () => {
            hocuspocusProvider.destroy();
        };
    }, [noteId, ydoc]);

    if (!session || !provider || noteLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50/10">
                <Spinner className="text-primary size-8" />
            </div>
        );
    }

    return (
        <div className="h-full">
            <Editor
                key={noteId}
                noteId={noteId}
                initialTitle={note?.title || ""}
                userName={session.user.name}
                provider={provider}
                ydoc={ydoc}
            />
        </div>
    );
}
