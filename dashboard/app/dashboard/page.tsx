import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, LayoutDashboard, Settings, User, LogOut } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/login");
    }

    const { user } = session;

    return (
        <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-inter">
            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-200 flex flex-col bg-slate-50/50">
                <div className="p-6">
                    <div className="flex items-center gap-2 text-[#0ea5e9]">
                        <span className="material-symbols-outlined text-3xl font-bold">psychology</span>
                        <span className="text-xl font-bold text-slate-900 tracking-tight font-outfit">OpenBrain</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-4 space-y-1">
                    <Link href="/dashboard">
                        <Button variant="ghost" className="w-full justify-start gap-3 bg-white text-zinc-900 hover:bg-zinc-100 border border-zinc-200/50 shadow-sm">
                            <LayoutDashboard size={18} />
                            Overview
                        </Button>
                    </Link>
                    <Link href="/profile">
                        <Button variant="ghost" className="w-full justify-start gap-3 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100">
                            <User size={18} />
                            Profile
                        </Button>
                    </Link>
                    <Link href="/settings">
                        <Button variant="ghost" className="w-full justify-start gap-3 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100">
                            <Settings size={18} />
                            Settings
                        </Button>
                    </Link>
                </nav>

                <div className="p-4 border-t border-zinc-200">
                    <div className="flex items-center gap-3 px-2 py-3 rounded-lg bg-white border border-zinc-200">
                        <div className="size-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm text-white">
                            {user.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.name}</p>
                            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-8 bg-zinc-50/30">
                <div className="max-w-5xl mx-auto space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Welcome back, {user.name.split(' ')[0]} 👋</h1>
                            <p className="text-zinc-500 font-medium">Here's what's happening today.</p>
                        </div>
                        <Button variant="outline" className="border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600">
                            Last 30 Days
                        </Button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="border-zinc-200 bg-white shadow-md overflow-hidden group">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest text-indigo-600">Brain Power</CardDescription>
                                <CardTitle className="text-3xl font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">84%</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                                    <div className="h-full w-4/5 bg-indigo-500 rounded-full"></div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-zinc-200 bg-white shadow-md overflow-hidden group">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest text-emerald-600">Knowledge Tags</CardDescription>
                                <CardTitle className="text-3xl font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors">1,284</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card className="border-zinc-200 bg-white shadow-md overflow-hidden group">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest text-amber-600">Recent Syncs</CardDescription>
                                <CardTitle className="text-3xl font-bold text-zinc-900 group-hover:text-amber-600 transition-colors">12</CardTitle>
                            </CardHeader>
                        </Card>
                    </div>

                    {/* Main Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card className="border-zinc-200 bg-white text-zinc-900 shadow-md">
                            <CardHeader className="border-b border-zinc-100 pb-6">
                                <CardTitle className="text-xl">User Profile</CardTitle>
                                <CardDescription className="text-zinc-500">Your account details linked to this session.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Full Name</p>
                                    <p className="font-bold text-zinc-800">{user.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Email Address</p>
                                    <p className="font-bold text-zinc-800">{user.email}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Account status</p>
                                    <div className="flex items-center gap-2">
                                        <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                        <p className="font-bold uppercase text-xs text-emerald-600 tracking-wider">Active</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-zinc-200 bg-white text-zinc-900 shadow-md">
                            <CardHeader className="border-b border-zinc-100 pb-6">
                                <CardTitle className="text-xl">Quick Actions</CardTitle>
                                <CardDescription className="text-zinc-500">Common tasks and shortcuts.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <Button className="h-20 flex-col gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/10">
                                        <Brain size={20} />
                                        <span>New Memory</span>
                                    </Button>
                                    <Button variant="outline" className="h-20 flex-col gap-2 border-zinc-200 hover:bg-zinc-50 text-zinc-600">
                                        <Settings size={20} />
                                        <span>Preferences</span>
                                    </Button>
                                    <Button variant="outline" className="h-20 flex-col gap-2 border-zinc-200 hover:bg-zinc-50 text-zinc-600">
                                        <User size={20} />
                                        <span>Team Access</span>
                                    </Button>
                                    <form action="/api/auth/sign-out" method="POST">
                                        <Button variant="outline" className="h-20 w-full flex-col gap-2 border-zinc-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all text-zinc-600">
                                            <LogOut size={20} />
                                            <span>Sign Out</span>
                                        </Button>
                                    </form>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
