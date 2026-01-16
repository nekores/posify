'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import MainLayout from '@/components/layout/MainLayout';
import NavigationProgress from '@/components/layout/NavigationProgress';
import { useAppStore } from '@/store/useStore';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { syncCurrencyFromSettings } = useAppStore();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && session?.user?.role === 'USER') {
      // User role can only access POS, redirect to POS if trying to access other pages
      const path = window.location.pathname;
      if (path !== '/pos' && !path.startsWith('/pos/')) {
        router.push('/pos');
      }
    }
  }, [status, router, session]);

  // Sync currency from settings on mount
  useEffect(() => {
    if (status === 'authenticated') {
      syncCurrencyFromSettings();
    }
  }, [status, syncCurrencyFromSettings]);

  if (status === 'loading') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <NavigationProgress />
      <MainLayout>{children}</MainLayout>
    </>
  );
}

