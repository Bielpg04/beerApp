import { z } from 'zod';

/** Same rules as public.is_valid_username. */
export const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/;

export const normalizeUsername = (input: string) => input.trim().toLowerCase();

export const usernameSchema = z
  .string()
  .regex(USERNAME_PATTERN)
  .refine((u) => !u.startsWith('.') && !u.endsWith('.'));

export const displayNameSchema = z.string().trim().min(1).max(50);

export const bioSchema = z.string().max(160);

export const isValidUsername = (u: string) => usernameSchema.safeParse(u).success;
