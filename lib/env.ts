import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  JWT_SECRET: z.string().min(16),
  ADMIN_PASSWORD: z.string().min(4),
  NEXT_PUBLIC_APP_NAME: z.string().optional()
});

export const env = schema.parse({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME
});
