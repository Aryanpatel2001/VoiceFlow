/**
 * NextAuth Configuration
 *
 * Configures authentication providers and callbacks.
 *
 * @module lib/auth/config
 * @see docs/features/02-authentication.md
 */

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import {
  findUserByEmail,
  verifyPassword,
  updateLastLogin,
  findUserWithOrg,
  createUser,
} from "@/services/user.service";

export const authOptions: NextAuthOptions = {
  providers: [
    // Email/Password authentication
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        // Find user
        const user = await findUserByEmail(credentials.email);
        if (!user) {
          throw new Error("Invalid email or password");
        }

        // Verify password
        const isValid = await verifyPassword(user, credentials.password);
        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        // Check if user is active
        if (!user.is_active) {
          throw new Error("Account has been deactivated");
        }

        // Update last login
        await updateLastLogin(user.id);

        // Return user object (will be available in session)
        return {
          id: user.id,
          email: user.email,
          name: [user.first_name, user.last_name].filter(Boolean).join(" ") || null,
          image: user.avatar_url,
        };
      },
    }),

    // Google OAuth (optional)
    ...(process.env.GOOGLE_OAUTH_CLIENT_ID
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],

  // Session configuration
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  // JWT configuration
  jwt: {
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  // Custom pages
  pages: {
    signIn: "/login",
    signUp: "/signup",
    error: "/login",
    verifyRequest: "/verify-email",
    newUser: "/onboarding",
  },

  // Callbacks
  callbacks: {
    // Add custom data to JWT token
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.email = user.email;

        // Fetch organization data
        const userWithOrg = await findUserWithOrg(user.id);
        if (userWithOrg) {
          token.organizationId = userWithOrg.organization_id;
          token.organizationName = userWithOrg.organization_name;
          token.organizationSlug = userWithOrg.organization_slug;
          token.role = userWithOrg.role;
        }
      }

      // Update session when triggered
      if (trigger === "update" && session) {
        // Refresh organization data
        const userWithOrg = await findUserWithOrg(token.id as string);
        if (userWithOrg) {
          token.organizationId = userWithOrg.organization_id;
          token.organizationName = userWithOrg.organization_name;
          token.organizationSlug = userWithOrg.organization_slug;
          token.role = userWithOrg.role;
        }
      }

      return token;
    },

    // Add custom data to session
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.organizationId = token.organizationId as string | null;
        session.user.organizationName = token.organizationName as string | null;
        session.user.organizationSlug = token.organizationSlug as string | null;
        session.user.role = token.role as string | null;
      }
      return session;
    },

    // Control if user is allowed to sign in
    async signIn({ user, account, profile }) {
      // For OAuth, we might need to create the user
      if (account?.provider === "google" && profile?.email) {
        const existingUser = await findUserByEmail(profile.email);
        if (!existingUser) {
          // Create new user from Google profile
          await createUser({
            email: profile.email,
            password: crypto.randomUUID(), // Random password for OAuth users
            firstName: (profile as any).given_name,
            lastName: (profile as any).family_name,
          });
        }
      }
      return true;
    },

    // Redirect after sign in
    async redirect({ url, baseUrl }) {
      // If URL starts with base URL, allow it
      if (url.startsWith(baseUrl)) return url;
      // If URL is relative, prepend base URL
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Otherwise, redirect to dashboard
      return `${baseUrl}/dashboard`;
    },
  },

  // Events
  events: {
    async signIn({ user, account, isNewUser }) {
      console.log(`User signed in: ${user.email} via ${account?.provider}`);
      if (isNewUser) {
        console.log(`New user created: ${user.email}`);
      }
    },
    async signOut({ token }) {
      console.log(`User signed out: ${token?.email}`);
    },
  },

  // Debug in development
  debug: process.env.NODE_ENV === "development",
};
