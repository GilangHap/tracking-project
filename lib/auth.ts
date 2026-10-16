import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

interface AppUser {
  id: string;
  email: string;
  role: string;
}

export const { auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const { rows } = await db.query<AppUser & { password_hash: string }>(
          "select id, email, password_hash, role from public.users where lower(email) = $1",
          [email],
        );
        const u = rows[0];
        if (!u) return null;
        const ok = await bcrypt.compare(password, u.password_hash);
        if (!ok) return null;
        return { id: u.id, email: u.email, role: u.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as unknown as AppUser).id;
        token.role = (user as unknown as AppUser).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as Record<string, unknown>).id =
          token.uid as string;
        (session.user as unknown as Record<string, unknown>).role =
          token.role as string;
      }
      return session;
    },
  },
});
