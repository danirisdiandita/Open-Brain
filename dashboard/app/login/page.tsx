"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const { data: session } = authClient.useSession();

    if (session) {
        router.replace("/dashboard");
        return null;
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await authClient.signIn.email({
            email,
            password,
        });

        if (error) {
            if (error.message?.toLowerCase().includes("verify") || error.message?.toLowerCase().includes("verification")) {
                const { error: resendError } = await authClient.sendVerificationEmail({
                    email,
                    callbackURL: "/dashboard",
                });

                if (!resendError) {
                    toast.warning("Email not verified", {
                        description: "We've resent a verification link to your email. Please check your inbox.",
                    });
                    setLoading(false);
                    return;
                }
            }
            toast.error(error.message || "Failed to login");
            setLoading(false);
            return;
        }

        setLoading(false);
        toast.success("Welcome back!");
        router.push("/dashboard");
    };

    return (
        <div className="bg-slate-50 min-h-screen flex items-center justify-center p-4 md:p-8 font-inter">
            <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                <div className="flex flex-col gap-6">
                    <Card className="p-8 md:p-12 rounded-[2.5rem] shadow-sm border-slate-200/50 flex-grow bg-white">
                        <div className="mb-10 flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                                <span className="material-symbols-outlined text-xl leading-none">psychology</span>
                            </div>
                            <span className="font-outfit text-2xl font-semibold text-slate-900">OpenBrain</span>
                        </div>
                        <div className="mb-10">
                            <h1 className="text-4xl md:text-5xl font-outfit font-semibold text-slate-900 mb-4 leading-tight tracking-tight">Welcome back to OpenBrain</h1>
                            <p className="text-slate-500 text-lg">Continue building your second brain and connecting your knowledge.</p>
                        </div>
                        <form className="space-y-4" onSubmit={handleLogin}>
                            <div className="space-y-2">
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10">mail</span>
                                    <Input
                                        className="h-14 pl-12 rounded-2xl border-slate-200 bg-slate-50 text-slate-900 focus-visible:ring-primary transition-all outline-none"
                                        placeholder="Email address"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10">lock</span>
                                    <Input
                                        className="h-14 pl-12 pr-12 rounded-2xl border-slate-200 bg-slate-50 text-slate-900 focus-visible:ring-primary transition-all outline-none"
                                        placeholder="Password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors focus:outline-none z-10"
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? "visibility_off" : "visibility"}
                                    </button>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Link href="/forgot-password" title="sm" className="text-sm font-medium text-primary hover:underline">
                                    Forgot password?
                                </Link>
                            </div>
                            <Button
                                className="w-full bg-primary hover:bg-sky-600 text-white font-semibold h-14 rounded-2xl transition-all shadow-lg shadow-sky-200 mt-2 disabled:opacity-50 text-lg"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? "Signing in..." : "Sign In"}
                            </Button>
                        </form>
                        <div className="relative my-8 text-center text-white">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-100"></div>
                            </div>
                            <span className="relative px-4 text-sm text-slate-400 bg-white">or</span>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full flex items-center justify-center gap-3 border-slate-200 h-14 rounded-2xl text-slate-700 hover:bg-slate-50 transition-all font-semibold"
                            onClick={() => authClient.signIn.social({ provider: "google" })}
                        >
                            <img alt="Google Logo" className="w-5 h-5" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAZ8jXRFaTe-IR_umVeUFwyDpt9ZnYW5JRAwUDyOZeEnTBCrgaDCR2NaHKga0FqO2WSnkhStSLoXRrvPVqLIPCtb7XFxGDgFWMm1mh8TTBbaXp_GlqE3mYFj-8hBjMFYR7f1wq6-FRYiGGjVQ1fJkfwbCqwWmw_W2VGnEGi_3DQySOrJQKQ6XKUYgEO1YnTqT3-8AUcKC1Nuq66H9ARqK3AvTAhpAIkfkrXTeQPEBk3IZPNP4me7PmSkJvMfkTD55nd_5mhT9GBmmnA" />
                            Sign in with Google
                        </Button>
                        <p className="mt-8 text-center text-slate-500">
                            Don't have an account? <Link className="text-primary font-semibold hover:underline" href="/signup">Sign up</Link>
                        </p>
                    </Card>
                    <Card className="p-6 rounded-[2rem] shadow-sm border-slate-200/50 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-4">
                            <div className="flex -space-x-3">
                                <img alt="User 1" className="w-10 h-10 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop" />
                                <img alt="User 2" className="w-10 h-10 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop" />
                                <img alt="User 3" className="w-10 h-10 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop" />
                            </div>
                            <div>
                                <p className="text-slate-900 font-semibold leading-none mb-1">Join with 50k+ Thinkers</p>
                                <p className="text-slate-500 text-sm">See how they use OpenBrain</p>
                            </div>
                        </div>
                        <Button variant="outline" size="icon" className="w-12 h-12 rounded-full border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
                            <span className="material-symbols-outlined">north_east</span>
                        </Button>
                    </Card>
                </div>
                <div className="relative overflow-hidden rounded-[3rem] bg-primary flex flex-col justify-between p-8 md:p-12 text-white">
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl -mr-20 -mt-20"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-300 rounded-full blur-3xl -ml-20 -mb-20"></div>
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-4xl md:text-5xl font-outfit font-medium leading-tight mb-6">
                            Capture everything,<br />connect anything.
                        </h2>
                    </div>
                    <div className="relative z-10 flex-grow flex items-center justify-center py-12">
                        <div className="relative w-full max-w-sm aspect-square">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-64 h-64 border-2 border-white/20 rounded-full flex items-center justify-center animate-pulse">
                                    <div className="w-48 h-48 border-2 border-white/40 rounded-full flex items-center justify-center animate-spin" style={{ animationDuration: '15s' }}>
                                        <div className="w-4 h-4 bg-white rounded-full absolute top-0 -mt-2"></div>
                                        <div className="w-32 h-32 border border-white/60 rounded-full"></div>
                                    </div>
                                </div>
                                <div className="absolute w-24 h-24 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 transform rotate-45 flex items-center justify-center shadow-2xl">
                                    <span className="material-symbols-outlined text-4xl transform -rotate-45 leading-none">auto_awesome</span>
                                </div>
                                <div className="absolute top-4 left-10 w-8 h-8 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/30">
                                    <span className="material-symbols-outlined text-sm leading-none">psychology_alt</span>
                                </div>
                                <div className="absolute bottom-12 right-6 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                                    <span className="material-symbols-outlined text-lg leading-none">lightbulb</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="relative z-10 bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex gap-2 text-white">
                                <div className="w-3 h-3 rounded-full bg-white/30"></div>
                                <div className="w-3 h-3 rounded-full bg-white/30"></div>
                                <div className="w-3 h-3 rounded-full bg-white/30"></div>
                            </div>
                            <div className="flex gap-2">
                                <div className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-lg leading-none transition-transform hover:-translate-x-0.5 hover:translate-y-0.5">south_west</span>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-white text-primary flex items-center justify-center">
                                    <span className="material-symbols-outlined text-lg leading-none transition-transform hover:translate-x-0.5 hover:-translate-y-0.5">north_east</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-white/90 font-light leading-relaxed">
                            Organize your learning path with semantic relationships. Your digital garden, completely under your control.
                        </p>
                        <div className="mt-4 flex items-center gap-3">
                            <div className="px-4 py-2 rounded-full bg-white/20 border border-white/20 text-xs font-medium backdrop-blur-md uppercase tracking-wider">
                                Privacy First
                            </div>
                            <div className="px-4 py-2 rounded-full bg-white/20 border border-white/20 text-xs font-medium backdrop-blur-md uppercase tracking-wider">
                                Fast Sync
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
