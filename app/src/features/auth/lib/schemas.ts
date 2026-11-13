import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const codeSchema = z.string().regex(/^\d{6}$/);
