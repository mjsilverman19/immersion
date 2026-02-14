/**
 * Creates a test account for local development.
 *
 * Usage:
 *   npx tsx scripts/create-test-account.ts
 *
 * Prerequisites:
 *   - .env.local must have NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set
 *   - Supabase project must be running (local or remote)
 *
 * Test account credentials:
 *   Email:    test@immersion.dev
 *   Password: testpass123
 *   Username: testuser
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load env vars from .env.local
function loadEnv() {
  try {
    const envPath = resolve(__dirname, "..", ".env.local");
    const envFile = readFileSync(envPath, "utf-8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex);
      const value = trimmed.slice(eqIndex + 1);
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local may not exist if env vars are set another way
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.\n" +
      "Copy .env.local.example to .env.local and fill in your Supabase credentials."
  );
  process.exit(1);
}

const TEST_EMAIL = "test@immersion.dev";
const TEST_PASSWORD = "testpass123";
const TEST_USERNAME = "testuser";
const TEST_DISPLAY_NAME = "Test User";

async function main() {
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

  console.log("Creating test account...");
  console.log(`  Email:    ${TEST_EMAIL}`);
  console.log(`  Password: ${TEST_PASSWORD}`);
  console.log(`  Username: ${TEST_USERNAME}`);
  console.log();

  // Step 1: Sign up the auth user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signUpError) {
    if (signUpError.message.includes("already registered")) {
      console.log("Auth user already exists, trying to sign in...");
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        });
      if (signInError) {
        console.error("Failed to sign in:", signInError.message);
        process.exit(1);
      }
      console.log("Signed in as existing user:", signInData.user?.id);
      await ensureProfile(supabase, signInData.user!.id);
      return;
    }
    console.error("Failed to sign up:", signUpError.message);
    process.exit(1);
  }

  const userId = signUpData.user?.id;
  if (!userId) {
    console.error("Sign up succeeded but no user ID returned.");
    process.exit(1);
  }

  console.log("Auth user created:", userId);

  // Step 2: Create the profile
  await ensureProfile(supabase, userId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureProfile(supabase: any, userId: string) {
  // Check if profile already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    console.log(`Profile already exists: @${existing.username}`);
    console.log("\nTest account is ready!");
    printCredentials();
    return;
  }

  // Get the first seeded city (Lisbon) as home city
  const { data: city } = await supabase
    .from("cities")
    .select("id, name")
    .eq("slug", "lisbon")
    .maybeSingle();

  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    username: TEST_USERNAME,
    display_name: TEST_DISPLAY_NAME,
    home_city_id: city?.id || null,
  });

  if (profileError) {
    console.error("Failed to create profile:", profileError.message);
    process.exit(1);
  }

  console.log("Profile created: @" + TEST_USERNAME);
  if (city) {
    console.log("Home city: " + city.name);
  }
  console.log("\nTest account is ready!");
  printCredentials();
}

function printCredentials() {
  console.log("\n--- Login Credentials ---");
  console.log(`  Email:    ${TEST_EMAIL}`);
  console.log(`  Password: ${TEST_PASSWORD}`);
  console.log("-------------------------\n");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
