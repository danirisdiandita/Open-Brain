import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { NotesSidebar } from "@/components/notes/notes-sidebar";

export default async function NotesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/login");
    }

    const { user } = session;

    return (
        <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-inter">
            <DashboardSidebar user={user} />
            <div className="flex-1 flex overflow-hidden">
                <NotesSidebar />
                <main className="flex-1 overflow-hidden bg-white">
                    {children}
                </main>
            </div>
        </div>
    );
}
