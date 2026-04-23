import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(["admin", "member"]),
  password: z.string().min(8),
});

export const createCaseSchema = z.object({
  title: z.string().min(1),
  caseNumber: z.string().optional(),
  description: z.string().optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["viewer", "uploader"]),
});

export const uploadDocumentSchema = z.object({
  file: z.instanceof(File),
});
