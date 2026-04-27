"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useCreateUserMutation } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RiEyeLine, RiEyeOffLine } from "@remixicon/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { UserRole, formatRole } from "@/lib/constants";
import { createUserSchema } from "@/lib/schemas";

interface CreateUserFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
  formId?: string;
  hideSubmit?: boolean;
}

export function CreateUserForm({ onSuccess, redirectTo, formId, hideSubmit }: CreateUserFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const { mutateAsync: createUser } = useCreateUserMutation();

  const form = useForm({
    defaultValues: {
      email: "",
      name: "",
      role: UserRole.Member as (typeof UserRole)[keyof typeof UserRole],
      password: "",
    },
    validators: {
      onChange: createUserSchema,
      onMount: createUserSchema,
    },
    onSubmit: async ({ value }) => {
      const fd = new FormData();
      fd.append("email", value.email);
      fd.append("name", value.name);
      fd.append("role", value.role);
      fd.append("password", value.password);
      await createUser(fd);
      form.reset();
      if (onSuccess) onSuccess();
      else if (redirectTo) router.push(redirectTo);
    },
  });

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="email">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Email</Label>
            <Input
              id={field.name}
              name={field.name}
              type="email"
              placeholder="name@sbma.com"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.isDirty &&
              field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors
                    .map((e) =>
                      typeof e === "string"
                        ? e
                        : (e?.message ?? "Invalid value")
                    )
                    .join(", ")}
                </p>
              )}
          </div>
        )}
      </form.Field>

      <form.Field name="name">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Name</Label>
            <Input
              id={field.name}
              name={field.name}
              placeholder="Juan Dela Cruz"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.isDirty &&
              field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors
                    .map((e) =>
                      typeof e === "string"
                        ? e
                        : (e?.message ?? "Invalid value")
                    )
                    .join(", ")}
                </p>
              )}
          </div>
        )}
      </form.Field>

      <form.Field name="role">
        {(field) => (
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={field.state.value}
              onValueChange={(v) =>
                field.handleChange(
                  v as (typeof UserRole)[keyof typeof UserRole]
                )
              }
            >
              <SelectTrigger className="w-full">
                <span className="flex flex-1 text-left text-sm">
                  {formatRole(field.state.value)}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserRole.Member}>
                  {formatRole(UserRole.Member)}
                </SelectItem>
                <SelectItem value={UserRole.Admin}>
                  {formatRole(UserRole.Admin)}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Password</Label>
            <div className="relative">
              <Input
                id={field.name}
                name={field.name}
                type={showPassword ? "text" : "password"}
                placeholder="Set a password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                  {field.state.meta.errors
                    .map((e) =>
                      typeof e === "string"
                        ? e
                        : (e?.message ?? "Invalid value")
                    )
                    .join(", ")}
                </p>
              )}
          </div>
        )}
      </form.Field>

      {!hideSubmit && (
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? "Creating..." : "Create User"}
            </Button>
          )}
        </form.Subscribe>
      )}
    </form>
  );
}
