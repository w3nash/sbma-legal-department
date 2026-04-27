"use client";

import { useForm } from "@tanstack/react-form";
import { createCaseSchema } from "@/lib/schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCaseAction } from "@/app/(app)/cases/_actions";
import { useRouter } from "next/navigation";
import { Route } from "@/lib/constants";

export default function NewCasePage() {
  const router = useRouter();
  const form = useForm({
    defaultValues: { title: "", caseNumber: "", description: "" },
    validators: { onBlur: createCaseSchema },
    onSubmit: async ({ value }) => {
      const fd = new FormData();
      fd.append("title", value.title);
      if (value.caseNumber) fd.append("caseNumber", value.caseNumber);
      if (value.description) fd.append("description", value.description);
      await createCaseAction(fd);
      router.push(Route.Cases);
    },
  });

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">New Case</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
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
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                <p className="text-sm text-red-500">
                  {field.state.meta.errors
                    .map((e) => (typeof e === "string" ? e : e.message))
                    .join(", ")}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="caseNumber">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Case Number (optional)</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="description">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Description (optional)</Label>
              <Textarea
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Case"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
