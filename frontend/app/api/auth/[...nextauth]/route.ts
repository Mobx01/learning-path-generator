import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Username",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "e.g., testuser" }
      },
      async authorize(credentials) {
        try {
          const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
          const cleanBackendUrl = backendUrl.replace(/\/$/, "");

          console.log(`NextAuth fetching login from backend: ${cleanBackendUrl}/users/login`);

          const res = await fetch(`${cleanBackendUrl}/users/login`, {
            method: 'POST',
            body: JSON.stringify({ username: credentials?.username }),
            headers: { "Content-Type": "application/json" }
          });

          if (!res.ok) {
            console.error(`Backend auth route error status: ${res.status}`);
            return null;
          }

          const user = await res.json();

          if (user) {
            return { 
              id: user.user_id?.toString() || user.id?.toString(), 
              token: user.access_token, 
              name: user.username 
            };
          }
          return null;
        } catch (error) {
          console.error("NextAuth link connection error:", error);
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