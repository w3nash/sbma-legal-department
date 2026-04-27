// app/(auth)/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { RiEyeLine, RiEyeOffLine, RiShieldKeyholeFill } from "@remixicon/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { signIn, useSession } from "@/lib/auth-client";
import { Route } from "@/lib/constants";
import { loginSchema } from "@/lib/schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RiErrorWarningLine } from "@remixicon/react";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [apiError, setApiError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (session) {
      router.push(Route.Cases);
      router.refresh();
    }
  }, [session, router]);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setApiError("");
      const result = await signIn.email({
        email: value.email,
        password: value.password,
        callbackURL: Route.Cases,
      });
      if (result.error) {
        setApiError(result.error.message || "Invalid credentials");
      } else {
        router.push(Route.Cases);
        router.refresh();
      }
    },
  });

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
        <div className="absolute top-8 left-8 h-24 w-24 border-t border-l border-[#c9a84c]/20" />
        <div className="absolute right-8 bottom-8 h-24 w-24 border-r border-b border-[#c9a84c]/20" />

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
              <p className="text-sm font-medium tracking-widest text-[#c9a84c] uppercase">
                Case Document Management
              </p>
              <div className="h-px w-8 bg-[#c9a84c]/40" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 text-xs tracking-widest text-white/30 uppercase">
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

            <form
              onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
              }}
              className="space-y-4"
            >
              {apiError && (
                <Alert variant="destructive" role="alert">
                  <RiErrorWarningLine className="h-4 w-4" />
                  <AlertDescription>{apiError}</AlertDescription>
                </Alert>
              )}

              <form.Field
                name="email"
                validators={{
                  onChange: loginSchema.shape.email,
                  onMount: loginSchema.shape.email,
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Email</Label>
                    <Input
                      id={field.name}
                      type="email"
                      placeholder="name@company.com"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={form.state.isSubmitting}
                    />
                    {field.state.meta.isDirty &&
                      field.state.meta.errors.length > 0 && (
                        <p className="text-sm text-destructive">
                          {field.state.meta.errors[0]?.message}
                        </p>
                      )}
                  </div>
                )}
              </form.Field>

              <form.Field
                name="password"
                validators={{
                  onChange: loginSchema.shape.password,
                  onMount: loginSchema.shape.password,
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Password</Label>
                    <div className="relative">
                      <Input
                        id={field.name}
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        disabled={form.state.isSubmitting}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <RiEyeOffLine className="size-4" />
                        ) : (
                          <RiEyeLine className="size-4" />
                        )}
                      </button>
                    </div>
                    {field.state.meta.isDirty &&
                      field.state.meta.errors.length > 0 && (
                        <p className="text-sm text-destructive">
                          {field.state.meta.errors[0]?.message}
                        </p>
                      )}
                  </div>
                )}
              </form.Field>

              <form.Subscribe
                selector={(state) =>
                  [state.canSubmit, state.isSubmitting] as const
                }
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!canSubmit || isSubmitting}
                  >
                    {isSubmitting ? "Authenticating..." : "Sign In"}
                  </Button>
                )}
              </form.Subscribe>

              <Separator className="my-4" />

              <p className="flex items-center justify-center gap-2 text-center text-xs tracking-widest text-muted-foreground uppercase">
                <RiShieldKeyholeFill className="size-4" />
                Authorized personnel only
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
