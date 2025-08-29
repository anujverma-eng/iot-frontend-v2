import { z } from "zod";

export const emailSchema = z.string().email("Enter a valid e-mail");

export const passwordSchema = z
  .string()
  .min(8, "≥ 8 characters")
  .regex(/[A-Z]/, "1 uppercase")
  .regex(/[a-z]/, "1 lowercase")
  .regex(/[0-9]/, "1 number")
  .regex(/[!@#$%^&*]/, "1 symbol");

export const passwordsMatch = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const registerSchema = z.object({
  email   : emailSchema,
  password: passwordSchema,
  confirm : z.string(),
})
.refine((v) => v.password === v.confirm, {
  message: 'Passwords do not match',
  path   : ['confirm'],
});