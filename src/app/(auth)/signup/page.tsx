/**
 * Signup Page
 *
 * Allows users to create a new account.
 * Uses the VoiceFlow Pro design system.
 */

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Check } from "lucide-react";

// Validation schema
const signupSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().optional(),
    email: z.string().email("Please enter a valid email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const password = watch("password", "");

  // Password strength indicators
  const passwordChecks = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "One lowercase letter", valid: /[a-z]/.test(password) },
    { label: "One number", valid: /[0-9]/.test(password) },
  ];

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      // Create account
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setAuthError(result.error || "Failed to create account");
        return;
      }

      // Auto sign in after successful registration
      const signInResult = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Account created but sign in failed, redirect to login
        router.push("/login?message=account-created");
      } else {
        // Success - redirect to onboarding
        router.push("/onboarding");
        router.refresh();
      }
    } catch {
      setAuthError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/onboarding" });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-1/4 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl dark:bg-primary/10" />
        <div className="absolute inset-0 grid-bg" />
      </div>

      <div className="relative w-full max-w-md px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <h1 className="text-2xl font-bold text-foreground font-display">
                VoiceFlow<span className="text-gradient">Pro</span>
              </h1>
            </Link>
            <p className="text-muted-foreground mt-2">
              Create your free account
            </p>
          </div>

          {/* Card */}
          <div className="card-premium">
            {/* Error message */}
            {authError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
              >
                {authError}
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    First name
                  </label>
                  <input
                    {...register("firstName")}
                    type="text"
                    id="firstName"
                    autoComplete="given-name"
                    placeholder="John"
                    className="w-full"
                  />
                  {errors.firstName && (
                    <p className="mt-1.5 text-sm text-destructive">
                      {errors.firstName.message}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Last name
                  </label>
                  <input
                    {...register("lastName")}
                    type="text"
                    id="lastName"
                    autoComplete="family-name"
                    placeholder="Doe"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Work email
                </label>
                <input
                  {...register("email")}
                  type="email"
                  id="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="w-full"
                />
                {errors.email && (
                  <p className="mt-1.5 text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    id="password"
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Password requirements */}
                {password && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 space-y-1.5"
                  >
                    {passwordChecks.map((check, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-2 text-xs transition-colors ${
                          check.valid ? "text-success" : "text-muted-foreground"
                        }`}
                      >
                        <Check
                          className={`h-3 w-3 ${
                            check.valid ? "opacity-100" : "opacity-30"
                          }`}
                        />
                        {check.label}
                      </div>
                    ))}
                  </motion.div>
                )}

                {errors.password && (
                  <p className="mt-1.5 text-sm text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Confirm password
                </label>
                <input
                  {...register("confirmPassword")}
                  type={showPassword ? "text" : "password"}
                  id="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  className="w-full"
                />
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-sm text-destructive">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full"
              >
                {isLoading ? (
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <>
                    Create account
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            {/* OAuth buttons */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="btn-secondary w-full"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            {/* Sign in link */}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-primary hover:underline font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-foreground transition-colors">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
