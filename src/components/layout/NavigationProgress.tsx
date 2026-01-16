'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Box, LinearProgress } from '@mui/material';

export default function NavigationProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (!loading) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: 3,
      }}
    >
      <LinearProgress
        sx={{
          height: 3,
          '& .MuiLinearProgress-bar': {
            background: 'linear-gradient(90deg, #11998e 0%, #38ef7d 100%)',
          },
        }}
      />
    </Box>
  );
}

