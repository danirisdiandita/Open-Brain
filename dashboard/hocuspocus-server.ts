import { Server } from "@hocuspocus/server";
import { prisma } from "./lib/prisma";
import * as Y from "yjs";

const server = new Server({
    port: 1234,

    // Persistence: Load data from Prisma
    async onLoadDocument(data: any) {
        const noteId = data.documentName.replace("note-", "");

        try {
            const note = await prisma.note.findUnique({
                where: { id: noteId },
                select: { content: true },
            });

            if (note?.content) {
                // Convert Base64 back to Uint8Array and apply to Y.Doc
                const binaryState = Buffer.from(note.content, 'base64');
                Y.applyUpdate(data.document, binaryState);
                console.log(`Loaded document from DB for note: ${noteId}`);
            }
        } catch (error) {
            console.error(`Failed to load document for ${noteId}: ${error}`);
        }

        return data.document;
    },

    // Autosave: Store data to Prisma when it changes
    async onStoreDocument(data: any) {
        const noteId = data.documentName.replace("note-", "");

        try {
            if (noteId.length < 10) return; // Basic validation for UUID

            // Encode Y.Doc to Base64 binary update
            const state = Buffer.from(Y.encodeStateAsUpdate(data.document)).toString('base64');

            await prisma.note.update({
                where: { id: noteId },
                data: {
                    content: state,
                    updatedAt: new Date(),
                },
            });

            // Autoversioning: Create a snapshot every 5 minutes (simplified logic)
            // In a real app, you'd check the timestamp of the last version
            const lastVersion = await prisma.noteVersion.findFirst({
                where: { noteId },
                orderBy: { createdAt: 'desc' },
            });

            const FIVE_MINUTES = 5 * 60 * 1000;
            if (!lastVersion || (Date.now() - lastVersion.createdAt.getTime() > FIVE_MINUTES)) {
                await prisma.noteVersion.create({
                    data: {
                        noteId,
                        content: state,
                    },
                });
                console.log(`Auto-versioned note: ${noteId}`);
            }

            console.log(`Auto-saved document for note: ${noteId}`);
        } catch (error) {
            console.error(`Failed to store document for ${noteId}: ${error}`);
        }
    },
});

server.listen();
console.log("Hocuspocus collaboration server (with Persistence & Autoversioning) running on ws://127.0.0.1:1234");
