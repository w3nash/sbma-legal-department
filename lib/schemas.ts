import { z } from "zod";
import { UserRole, MembershipRole } from "./constants";

export const loginSchema = z
  .object({
    email: z.email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  })
  .refine((data) => data.email.trim().length > 0, "Email is required");

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum([UserRole.Admin, UserRole.Member]),
  password: z.string().min(8),
});

export const createCaseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  caseNumber: z.string().min(1, "Case number is required"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or fewer")
    .optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum([MembershipRole.Viewer, MembershipRole.Uploader]),
});

export const updateCaseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  caseNumber: z.string().min(1, "Case number is required"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or fewer")
    .optional(),
  status: z.enum(["open", "closed", "archived"]),
});

export const uploadDocumentSchema = z.object({
  file: z.instanceof(File),
});
