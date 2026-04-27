"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { createCaseSchema } from "@/lib/schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCaseAction } from "@/app/(app)/cases/_actions";
import { Route } from "@/lib/constants";

const DESCRIPTION_MAX = 500;

interface CreateCaseFormProps {
  formId?: string;
  hideSubmit?: boolean;
  onSuccess?: () => void;
  redirectTo?: string;
}

export function CreateCaseForm({
  formId,
  hideSubmit,
  onSuccess,
  redirectTo,
}: CreateCaseFormProps) {
  const router = useRouter();
  const form = useForm({
    defaultValues: { title: "", caseNumber: "", description: "" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onBlur: createCaseSchema as any },
    onSubmit: async ({ value }) => {
      const fd = new FormData();
      fd.append("title", value.title);
      fd.append("caseNumber", value.caseNumber);
      if (value.description) fd.append("description", value.description);
      await createCaseAction(fd);
      form.reset();
      if (onSuccess) onSuccess();
      else router.push(redirectTo ?? Route.Cases);
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
      <form.Field name="title">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Title</Label>
            <Input
              id={field.name}
              name={field.name}
              placeholder="e.g. Smith vs. Jones"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.isTouched &&
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

      <form.Field name="caseNumber">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Case Number</Label>
            <Input
              id={field.name}
              name={field.name}
              placeholder="e.g. SBMA-2026-001"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.isTouched &&
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

      <form.Field name="description">
        {(field) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={field.name}>Description (optional)</Label>
              <span className="text-xs text-muted-foreground">
                {field.state.value.length}/{DESCRIPTION_MAX}
              </span>
            </div>
            <Textarea
              id={field.name}
              name={field.name}
              placeholder="Brief summary of the case, parties involved, or relevant context…"
              maxLength={DESCRIPTION_MAX}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        )}
      </form.Field>

      {!hideSubmit && (
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Creating…" : "Create Case"}
            </Button>
          )}
        </form.Subscribe>
      )}
    </form>
  );
}
