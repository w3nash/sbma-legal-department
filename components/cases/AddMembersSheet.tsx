"use client";

import { useState } from "react";
import { RiUserAddLine, RiCloseLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import { MembershipRole } from "@/lib/constants";
import {
  useAvailableUsersQuery,
  useAddCaseMembersMutation,
  type AvailableUser,
} from "@/hooks/use-cases";

export function AddMembersSheet({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comboKey, setComboKey] = useState(0);
  const [role, setRole] = useState<string>(MembershipRole.Viewer);

  const { data: availableUsers = [], isLoading } = useAvailableUsersQuery(
    caseId,
    open
  );
  const addMutation = useAddCaseMembersMutation(caseId);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedIds([]);
      setComboKey(0);
      setRole(MembershipRole.Viewer);
    }
    setOpen(nextOpen);
  };

  const unselectedUsers = availableUsers.filter(
    (u) => !selectedIds.includes(u.id)
  );

  const handleSelect = (v: unknown) => {
    const user = v as AvailableUser | null;
    if (!user) return;
    setSelectedIds((prev) => [...prev, user.id]);
    setComboKey((k) => k + 1);
  };

  const removeUser = (id: string) =>
    setSelectedIds((prev) => prev.filter((x) => x !== id));

  const handleAdd = () => {
    if (selectedIds.length === 0) return;
    addMutation.mutate(
      { userIds: selectedIds, role },
      { onSuccess: () => handleOpenChange(false) }
    );
  };

  const addLabel =
    selectedIds.length > 0
      ? `Add ${selectedIds.length} Member${selectedIds.length > 1 ? "s" : ""}`
      : "Add Members";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={<Button />}>
        <RiUserAddLine className="mr-1.5 size-4" />
        Add
      </SheetTrigger>

      <SheetContent className="flex flex-col overflow-hidden data-[side=right]:sm:max-w-md">
        <SheetHeader className="pr-12">
          <SheetTitle>Add Members</SheetTitle>
          <SheetDescription>
            Search and select team members to grant them access to this case.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6">
          <div className="space-y-2">
            <Label>Members</Label>

            {isLoading ? (
              <div className="flex h-10 items-center text-sm text-muted-foreground">
                Loading users…
              </div>
            ) : (
              <div className="space-y-2">
                {selectedIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedIds.map((id) => {
                      const user = availableUsers.find((u) => u.id === id);
                      return user ? (
                        <span
                          key={id}
                          className="inline-flex h-6 items-center gap-1 rounded-md bg-muted px-2 text-xs font-medium text-foreground"
                        >
                          {user.name}
                          <button
                            type="button"
                            onClick={() => removeUser(id)}
                            className="-mr-0.5 opacity-50 hover:opacity-100"
                          >
                            <RiCloseLine className="size-3" />
                            <span className="sr-only">Remove {user.name}</span>
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {/*
                 * key remounts on each pick — clears input without needing
                 * controlled inputValue, avoiding the onInputValueChange race.
                 * filter prop handles name+email matching internally.
                 */}
                <Combobox
                  key={comboKey}
                  items={unselectedUsers}
                  filter={(user: AvailableUser, inputValue: string) => {
                    const q = inputValue.toLowerCase();
                    return (
                      !q ||
                      user.name.toLowerCase().includes(q) ||
                      user.email.toLowerCase().includes(q)
                    );
                  }}
                  onValueChange={handleSelect}
                >
                  <ComboboxInput
                    placeholder={
                      selectedIds.length === 0 ? "Search users…" : "Add more…"
                    }
                  />
                  <ComboboxContent>
                    <ComboboxGroup>
                      <ComboboxLabel>
                        {unselectedUsers.length === 0
                          ? "No Available Users"
                          : "Available Users"}
                      </ComboboxLabel>
                      <ComboboxList>
                        {(user: AvailableUser) => (
                          <ComboboxItem key={user.id} value={user}>
                            {user.name} ({user.email})
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxGroup>
                  </ComboboxContent>
                </Combobox>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v ?? MembershipRole.Viewer)}
            >
              <SelectTrigger className="w-full">
                {role === MembershipRole.Uploader ? "Uploader" : "Viewer"}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MembershipRole.Viewer}>Viewer</SelectItem>
                <SelectItem value={MembershipRole.Uploader}>
                  Uploader
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="grid grid-cols-2">
          <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
          <Button
            disabled={selectedIds.length === 0 || addMutation.isPending}
            onClick={handleAdd}
          >
            {addMutation.isPending ? "Adding…" : addLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
