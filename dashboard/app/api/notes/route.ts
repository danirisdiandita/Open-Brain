import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId");

    const where: any = {
        userId: session.user.id,
    };

    if (folderId === "all") {
        // No additional filter, get all notes
    } else if (folderId) {
        where.folderId = folderId;
    } else {
        where.folderId = null;
    }

    const notes = await prisma.note.findMany({
        where,
        orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(notes);
}

export async function POST(req: Request) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { title, folderId, content } = await req.json();

    const note = await prisma.note.create({
        data: {
            title,
            folderId,
            content,
            userId: session.user.id,
        },
    });

    return NextResponse.json(note);
}
