"use client";

import { useState } from "react";
import { addCaseMember, removeCaseMember } from "@/app/(app)/cases/_actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MembershipRole } from "@/lib/constants";

interface Member {
  id: string;
  user: { id: string; name: string; email: string };
  role: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export function CaseMemberManager({
  caseId,
  members,
  allUsers,
}: {
  caseId: string;
  members: Member[];
  allUsers: User[];
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<typeof MembershipRole[keyof typeof MembershipRole]>(
    MembershipRole.Viewer
  );

  const availableUsers = allUsers.filter(
    (u) => !members.some((m) => m.user.id === u.id)
  );

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Case Members</h3>
      <div className="flex gap-2">
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select user..." />
          </SelectTrigger>
          <SelectContent>
            {availableUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name} ({u.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={role}
          onValueChange={(v) =>
            setRole(v as typeof MembershipRole[keyof typeof MembershipRole])
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MembershipRole.Viewer}>Viewer</SelectItem>
            <SelectItem value={MembershipRole.Uploader}>Uploader</SelectItem>
          </SelectContent>
        </Select>

        <Button
          onClick={() => {
            const fd = new FormData();
            fd.append("userId", userId);
            fd.append("role", role);
            addCaseMember(caseId, fd);
            setUserId("");
          }}
          disabled={!userId}
        >
          Add
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                {m.user.name} ({m.user.email})
              </TableCell>
              <TableCell className="capitalize">{m.role}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCaseMember(caseId, m.user.id)}
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
