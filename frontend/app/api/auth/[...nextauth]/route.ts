import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Username",
      // 1. Remove the password field from the login form
      credentials: {
        username: { label: "Username", type: "text", placeholder: "e.g., testuser" }
      },
      async authorize(credentials) {
        try {
          // 2. Adjust the payload to only send what your backend expects
          // Note: If your backend /users/login expects something different, adjust the body here.
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/users/login`, {
            method: 'POST',
            body: JSON.stringify({ username: credentials?.username }),
            headers: { "Content-Type": "application/json" }
          });

          const user = await res.json();

          if (res.ok && user) {
            return { 
              id: user.user_id?.toString() || user.id?.toString(), 
              token: user.access_token, 
              name: user.username 
            };
          }
          return null;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.accessToken = (user as any).token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
      }
      (session as any).accessToken = token.accessToken as string;
      return session;
    }
  }
});

export { handler as GET, handler as POST };