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
    }
  }, [status, router]);

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

