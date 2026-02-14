function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `See .env.local.example for required variables.`
    );
  }
  return value;
}

export const supabaseUrl = getEnvVar("NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey = getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
