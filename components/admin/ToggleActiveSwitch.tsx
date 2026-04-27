"use client";

import { useState } from "react";
import { useToggleUserActiveMutation } from "@/hooks/use-admin";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ToggleActiveSwitch({
  userId,
  isActive,
  userName,
}: {
  userId: string;
  isActive: boolean;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const { mutate: toggle, isPending } = useToggleUserActiveMutation();

  if (!isActive) {
    return (
      <div className="flex w-36 items-center gap-2">
        <Switch
          checked={false}
          disabled={isPending}
          onCheckedChange={() => toggle({ userId, isActive: true })}
        />
        <span className="text-sm text-muted-foreground">
          {isPending ? "Updating..." : "Deactivated"}
        </span>
      </div>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <button
            type="button"
            className="flex w-36 cursor-pointer items-center gap-2"
          />
        }
      >
        <Switch checked={true} disabled={isPending} />
        <span className="text-sm text-muted-foreground">
          {isPending ? "Updating..." : "Active"}
        </span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate User Account</AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            You are about to deactivate <strong>{userName}</strong>&apos;s
            account. When you deactivate this user:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md bg-accent p-3">
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            <li>They will be immediately logged out of all sessions</li>
            <li>They will no longer be able to sign in</li>
            <li>They will lose access to all cases and documents</li>
            <li>This action can be reversed by reactivating the account</li>
          </ul>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setOpen(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              toggle(
                { userId, isActive: false },
                { onSuccess: () => setOpen(false) }
              );
            }}
          >
            {isPending ? "Deactivating..." : "Deactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
