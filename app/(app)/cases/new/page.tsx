import { Route } from "@/lib/constants";
import { CreateCaseForm } from "@/components/cases/CreateCaseForm";

export default function NewCasePage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Case</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new case to organise documents and manage team member access.
        </p>
      </div>
      <CreateCaseForm redirectTo={Route.Cases} />
    </div>
  );
}
