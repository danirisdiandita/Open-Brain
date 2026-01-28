"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await authClient.requestPasswordReset({
            email,
            redirectTo: "/reset-password",
        });

        if (error) {
            toast.error(error.message || "Failed to send reset link");
            setLoading(false);
            return;
        }

        toast.success("Reset link sent!", {
            description: "If an account exists for this email, we've sent a password reset link.",
        });
        setLoading(false);
    };

    return (
        <div className="bg-slate-50 min-h-screen flex items-center justify-center p-4 md:p-8 font-inter">
            <div className="w-full max-w-lg">
                <Card className="p-8 md:p-12 rounded-[2.5rem] shadow-sm border-slate-200/50 bg-white">
                    <div className="mb-10 flex items-center justify-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-xl leading-none">psychology</span>
                        </div>
                        <span className="font-outfit text-2xl font-semibold text-slate-900">OpenBrain</span>
                    </div>
                    <div className="mb-10 text-center">
                        <h1 className="text-3xl font-outfit font-semibold text-slate-900 mb-4 tracking-tight">Reset Password</h1>
                        <p className="text-slate-500">Enter your email and we'll send you a link to reset your password.</p>
                    </div>
                    <form className="space-y-4" onSubmit={handleReset}>
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
                        <Button
                            className="w-full bg-primary hover:bg-sky-600 text-white font-semibold h-14 rounded-2xl transition-all shadow-lg shadow-sky-200 mt-2 disabled:opacity-50 text-lg"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Sending link..." : "Send Reset Link"}
                        </Button>
                    </form>
                    <p className="mt-8 text-center text-slate-500">
                        Remembered your password? <Link className="text-primary font-semibold hover:underline" href="/login">Sign in</Link>
                    </p>
                </Card>
            </div>
        </div>
    );
}
