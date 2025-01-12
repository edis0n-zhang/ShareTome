import NextAuth from "next-auth"
import GithubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"

const providers = [
  GithubProvider({
    clientId: process.env.GITHUB_ID as string,
    clientSecret: process.env.GITHUB_SECRET as string,
  }),
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  }),
]

if (process.env.DEV_AUTH === 'true') {
  providers.push(
    CredentialsProvider({
      name: 'Dev User',
      credentials: {},
      async authorize() {
        return {
          id: 'dev-user',
          name: 'Development User',
          email: 'dev@example.com',
          image: null,
        }
      },
    })
  )
}

const handler = NextAuth({
  providers,
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
    async signIn({ user, account, profile, email, credentials }) {
      console.log('SignIn attempt:', { user, account, profile, email });
      return true;
    },
    async redirect({ url, baseUrl }) {
      console.log('Redirect:', { url, baseUrl });
      return url.startsWith(baseUrl) ? url : baseUrl;
    },
    async error({ error, options }) {
      console.error('Authentication Error:', error)
    }
  },
})

export { handler as GET, handler as POST }
