"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If no session, email confirmation is required
    if (!data.session) {
      setConfirmationSent(true);
      setLoading(false);
      return;
    }

    // If session exists, email confirmation is disabled — go straight to onboarding
    router.push("/onboarding");
    router.refresh();
  };

  if (confirmationSent) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold">Check your email</h1>
        <p className="mb-4 text-sm text-gray-500">
          We sent a confirmation link to <span className="font-medium text-black">{email}</span>.
          Click the link to activate your account.
        </p>
        <p className="text-sm text-gray-500">
          Didn&apos;t get it?{" "}
          <button
            onClick={() => {
              setConfirmationSent(false);
              setLoading(false);
            }}
            className="font-medium text-black"
          >
            Try again
          </button>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Create your account</h1>
      <p className="mb-8 text-sm text-gray-500">
        Share your city. Discover others.
      </p>

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            placeholder="At least 6 characters"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-black">
          Sign in
        </Link>
      </p>
    </div>
  );
}
