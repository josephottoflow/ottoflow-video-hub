import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      // Only allow @ottoflow.ai emails
      return profile?.email?.endsWith("@ottoflow.ai") ?? false;
    },
  },
  pages: {
    signIn: "/login",
    error:  "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
