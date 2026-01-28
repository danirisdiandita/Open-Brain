import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const folders = await prisma.folder.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(folders);
}

export async function POST(req: Request) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { name, parentId } = await req.json();

    const folder = await prisma.folder.create({
        data: {
            name,
            parentId,
            userId: session.user.id,
        },
    });

    return NextResponse.json(folder);
}
