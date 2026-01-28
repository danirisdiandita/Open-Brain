import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    const note = await prisma.note.findUnique({
        where: {
            id,
            userId: session.user.id
        },
    });

    if (!note) {
        return new NextResponse("Not Found", { status: 404 });
    }

    return NextResponse.json(note);
}

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;
    const { title } = await req.json();

    const note = await prisma.note.update({
        where: {
            id,
            userId: session.user.id
        },
        data: { title },
    });

    return NextResponse.json(note);
}
