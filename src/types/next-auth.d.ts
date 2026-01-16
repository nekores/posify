import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    username: string;
    email: string;
    role: string;
    storeId: string | null;
    name?: string;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      email: string;
      role: string;
      storeId: string | null;
      name?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    username: string;
    role: string;
    storeId: string | null;
  }
}

