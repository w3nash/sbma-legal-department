"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { updateCaseAction } from "@/app/(app)/cases/_actions";
import { updateCaseSchema } from "@/lib/schemas";

const DESCRIPTION_MAX = 500;

const statusLabels: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  archived: "Archived",
};

interface CaseSettingsFormProps {
  caseId: string;
  title: string;
  caseNumber: string | null;
  description: string | null;
  status: string;
  formId?: string;
  hideSubmit?: boolean;
  onSuccess?: () => void;
  redirectTo?: string;
}

export function CaseSettingsForm({
  caseId,
  title,
  caseNumber,
  description,
  status,
  formId,
  hideSubmit,
  onSuccess,
  redirectTo,
}: CaseSettingsFormProps) {
  const router = useRouter();
  const form = useForm({
    defaultValues: {
      title,
      caseNumber: caseNumber ?? "",
      description: description ?? "",
      status,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onBlur: updateCaseSchema as any },
    onSubmit: async ({ value }) => {
      const fd = new FormData();
      fd.append("title", value.title);
      fd.append("caseNumber", value.caseNumber);
      fd.append("status", value.status);
      if (value.description) fd.append("description", value.description);
      await updateCaseAction(caseId, fd);
      if (onSuccess) onSuccess();
      else router.push(redirectTo ?? `/cases/${caseId}`);
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

      <form.Field name="status">
        {(field) => (
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={field.state.value}
              onValueChange={(v) => field.handleChange(v ?? "open")}
            >
              <SelectTrigger className="w-full">
                {statusLabels[field.state.value] ?? field.state.value}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>

      {!hideSubmit && (
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          )}
        </form.Subscribe>
      )}
    </form>
  );
}
