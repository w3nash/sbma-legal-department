// app/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, useSession } from "@/lib/auth-client";
import { Route } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.push(Route.Cases);
      router.refresh();
    }
  }, [session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await signIn.email({
      email,
      password,
      callbackURL: Route.Cases,
    });

    setIsLoading(false);

    if (result.error) {
      setError(result.error.message || "Invalid credentials");
    } else {
      router.push(Route.Cases);
      router.refresh();
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left column - Government Archive Branding */}
      <div className="relative hidden flex-col items-center justify-center overflow-hidden bg-[#0a1628] p-10 text-white lg:flex">
        {/* Geometric cross pattern watermark */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Decorative corner borders */}
        <div className="absolute left-8 top-8 h-24 w-24 border-l border-t border-[#c9a84c]/20" />
        <div className="absolute bottom-8 right-8 h-24 w-24 border-b border-r border-[#c9a84c]/20" />

        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="rounded-full border border-[#c9a84c]/20 bg-[#0f2447]/50 p-6 backdrop-blur-sm">
            <Image
              src="/sbma-logo.png"
              alt="SBMA Logo"
              width={100}
              height={100}
              className="rounded"
              priority
            />
          </div>
          <div className="text-center">
            <h1 className="font-serif text-3xl font-semibold tracking-wide text-white">
              SBMA Legal Affairs
            </h1>
            <div className="mt-2 flex items-center justify-center gap-3">
              <div className="h-px w-8 bg-[#c9a84c]/40" />
              <p className="text-sm font-medium uppercase tracking-widest text-[#c9a84c]">
                Case Document Management
              </p>
              <div className="h-px w-8 bg-[#c9a84c]/40" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 text-xs uppercase tracking-widest text-white/30">
          &copy; {new Date().getFullYear()} SBMA Legal Affairs
        </div>
      </div>

      {/* Right column - Minimal Login Form */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-center gap-3 lg:hidden">
          <Image
            src="/sbma-logo.png"
            alt="SBMA Logo"
            width={32}
            height={32}
            className="rounded"
          />
          <span className="text-lg font-semibold text-[#0a1628] dark:text-[#e8e2d4]">
            SBMA Legal Affairs
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-muted-foreground">
                Enter your credentials to access your account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" role="alert">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href={Route.ForgotPassword}
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Authenticating..." : "Sign In"}
              </Button>

              <Separator className="my-4" />

              <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">
                Authorized personnel only
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
