"use client";

import { Button } from "@/components/ui/button";
import { Brain, LayoutDashboard, Settings, User, FileText, Folder, LogOut, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

interface DashboardSidebarProps {
    user: {
        name: string;
        email: string;
    };
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    const handleSignOut = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/login");
                },
            },
        });
    };

    const navItems = [
        {
            title: "Overview",
            href: "/dashboard",
            icon: LayoutDashboard,
        },
        {
            title: "Notes",
            href: "/dashboard/notes",
            icon: FileText,
        },
        {
            title: "Profile",
            href: "/profile",
            icon: User,
        },
        {
            title: "Settings",
            href: "/settings",
            icon: Settings,
        },
    ];

    return (
        <aside className="w-64 border-r border-slate-200 flex flex-col bg-slate-50/50">
            <div className="p-6">
                <Link href="/" className="flex items-center gap-2 text-[#0ea5e9]">
                    <span className="material-symbols-outlined text-3xl font-bold">psychology</span>
                    <span className="text-xl font-bold text-slate-900 tracking-tight font-outfit text-primary">OpenBrain</span>
                </Link>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
                    return (
                        <Link key={item.href} href={item.href}>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start gap-3 transition-colors",
                                    isActive
                                        ? "bg-white text-slate-900 border border-slate-200/50 shadow-sm"
                                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                )}
                            >
                                <item.icon size={18} />
                                {item.title}
                            </Button>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-200">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full h-auto p-2 hover:bg-white flex items-center gap-3 rounded-lg border border-slate-200 shadow-sm transition-all group">
                            <div className="size-8 rounded-full bg-primary flex items-center justify-center font-bold text-sm text-white shrink-0">
                                {user.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-medium truncate">{user.name}</p>
                                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                            </div>
                            <ChevronDown className="size-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Account
                        </div>
                        <Link href="/profile">
                            <DropdownMenuItem className="cursor-pointer">
                                <User className="size-4 mr-2" />
                                Profile
                            </DropdownMenuItem>
                        </Link>
                        <Link href="/settings">
                            <DropdownMenuItem className="cursor-pointer">
                                <Settings className="size-4 mr-2" />
                                Settings
                            </DropdownMenuItem>
                        </Link>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 cursor-pointer"
                            onClick={handleSignOut}
                        >
                            <LogOut className="size-4 mr-2" />
                            Sign Out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </aside>
    );
}
