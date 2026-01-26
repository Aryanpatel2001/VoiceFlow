/**
 * NextAuth Type Extensions
 *
 * Extends the default NextAuth types with custom fields.
 */

import "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      organizationId: string | null;
      organizationName: string | null;
      organizationSlug: string | null;
      role: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    organizationId?: string | null;
    organizationName?: string | null;
    organizationSlug?: string | null;
    role?: string | null;
  }
}
