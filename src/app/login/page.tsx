"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();

    const cleanUsername = username.trim().toLowerCase();
    const internalEmail = `${cleanUsername}@aahman.local`;

    try {
      // Attempt login first
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: internalEmail,
          password,
        });

      if (signInError) {
        // Auto-bootstrap default admin account on first setup if username is 'admin'
        if (cleanUsername === "admin" && password === "123456") {
          const { data: signUpData, error: signUpError } =
            await supabase.auth.signUp({
              email: internalEmail,
              password: password,
              options: {
                data: {
                  full_name: "System Admin",
                  username: "admin",
                  role: "admin",
                },
              },
            });

          if (signUpError) throw signUpError;

          if (signUpData.user) {
            // Update profile role to admin
            await supabase
              .from("profiles")
              .update({ role: "admin", full_name: "System Admin", username: "admin" })
              .eq("id", signUpData.user.id);
          }

          toast.success("Initial Admin account initialized & logged in!");
          router.push("/");
          router.refresh();
          return;
        }

        throw new Error("Invalid username or password");
      }

      if (signInData.user) {
        toast.success("Logged in successfully!");
        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, hsl(210, 40%, 98%) 0%, hsl(214, 95%, 93%) 100%)",
      }}
    >
      {/* Background soft blue glows */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30 pointer-events-none"
        style={{ background: "hsl(217, 91%, 60%)", filter: "blur(80px)" }}
      />
      <div
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-30 pointer-events-none"
        style={{ background: "hsl(221, 83%, 43%)", filter: "blur(80px)" }}
      />

      {/* Centered Login Modal Card */}
      <div className="w-full max-w-md bg-card rounded-2xl border shadow-xl p-8 relative z-10 space-y-6">
        {/* Logo Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="Aahman Ethnic Wear Logo"
              width={120}
              height={120}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1
              className="text-3xl font-bold text-foreground"
              style={{ fontFamily: "Cormorant Garamond, serif" }}
            >
              Aahman
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 tracking-wider uppercase">
              Custom Ethnic Wear ERP
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter username (e.g. admin)"
              className="w-full px-4 py-2.5 rounded-xl border bg-background text-sm outline-none transition-all focus:ring-2"
              style={{
                borderColor: "hsl(var(--border))",
              }}
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl border bg-background text-sm outline-none transition-all focus:ring-2"
              style={{
                borderColor: "hsl(var(--border))",
              }}
            />
          </div>

          <button
            id="submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Default Credentials Note */}
        <div
          className="p-3.5 rounded-xl border text-xs text-center space-y-0.5"
          style={{
            borderColor: "hsl(var(--border))",
            background: "hsl(var(--muted) / 0.6)",
          }}
        >
          <p className="font-semibold text-primary">🔑 Default Admin Account</p>
          <p className="text-muted-foreground">
            Username: <span className="font-bold text-foreground">admin</span> | Password: <span className="font-bold text-foreground">123456</span>
          </p>
        </div>
      </div>
    </div>
  );
}
