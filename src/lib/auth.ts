import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from './prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Username and password are required');
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: { equals: credentials.username, mode: 'insensitive' } },
              { email: { equals: credentials.username, mode: 'insensitive' } },
            ],
            status: 2, // Active
          },
          include: {
            profile: true,
            store: true,
          },
        });

        if (!user) {
          throw new Error('Invalid username or password');
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isValid) {
          throw new Error('Invalid username or password');
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          storeId: user.storeId,
          name: user.profile?.firstName 
            ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim()
            : user.username,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.storeId = user.storeId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
        session.user.storeId = token.storeId as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // Use environment variable or fallback for Electron builds
  secret: process.env.NEXTAUTH_SECRET || 'posify-electron-secret-key-2024',
};

