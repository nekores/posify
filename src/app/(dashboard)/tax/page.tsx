'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  AccountBalance as TaxIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useFormatCurrency } from '@/lib/currency';

interface TaxStats {
  thisYear: number;
  lastYear: number;
  thisMonth: number;
  lastMonth: number;
  dailyTax: Array<{
    date: string;
    tax: number;
  }>;
  monthlyTax: Array<{
    month: string;
    tax: number;
  }>;
}

export default function TaxManagementPage() {
  const formatCurrency = useFormatCurrency();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TaxStats | null>(null);

  useEffect(() => {
    fetchTaxStats();
  }, []);

  const fetchTaxStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tax/stats');
      const data = await res.json();
      
      // Check if the response contains an error
      if (data.error) {
        console.error('API returned error:', data.error, data.details);
        return;
      }
      
      // Validate the response has the expected structure
      if (typeof data.thisYear === 'number' && typeof data.thisMonth === 'number') {
        setStats(data);
      } else {
        console.error('Invalid tax stats response:', data);
      }
    } catch (error) {
      console.error('Error fetching tax stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!stats) {
    return (
      <Box>
        <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>
          Tax Management
        </Typography>
        <Typography color="error">Failed to load tax statistics</Typography>
      </Box>
    );
  }

  const yearGrowth = stats.lastYear > 0 
    ? ((stats.thisYear - stats.lastYear) / stats.lastYear) * 100 
    : 0;
  const monthGrowth = stats.lastMonth > 0 
    ? ((stats.thisMonth - stats.lastMonth) / stats.lastMonth) * 100 
    : 0;

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>
        Tax Management
      </Typography>

      {/* Summary Cards - 4 cards in a row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* This Year Tax */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              height: '100%',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                    Tax This Year
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {formatCurrency(stats.thisYear)}
                  </Typography>
                  {yearGrowth !== 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                      {yearGrowth > 0 ? (
                        <TrendingUpIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <TrendingDownIcon sx={{ fontSize: 16 }} />
                      )}
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        {yearGrowth > 0 ? '+' : ''}{yearGrowth.toFixed(1)}%
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    borderRadius: 2,
                    p: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TaxIcon sx={{ fontSize: 32 }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Last Year Tax */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white',
              height: '100%',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                    Tax Last Year
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {formatCurrency(stats.lastYear)}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8, mt: 1, display: 'block' }}>
                    Previous year
                  </Typography>
                </Box>
                <Box
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    borderRadius: 2,
                    p: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TaxIcon sx={{ fontSize: 32 }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* This Month Tax */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
              height: '100%',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                    Tax This Month
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {formatCurrency(stats.thisMonth)}
                  </Typography>
                  {monthGrowth !== 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                      {monthGrowth > 0 ? (
                        <TrendingUpIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <TrendingDownIcon sx={{ fontSize: 16 }} />
                      )}
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        {monthGrowth > 0 ? '+' : ''}{monthGrowth.toFixed(1)}%
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    borderRadius: 2,
                    p: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TaxIcon sx={{ fontSize: 32 }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Last Month Tax */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              color: 'white',
              height: '100%',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                    Tax Last Month
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {formatCurrency(stats.lastMonth)}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8, mt: 1, display: 'block' }}>
                    Previous month
                  </Typography>
                </Box>
                <Box
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    borderRadius: 2,
                    p: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TaxIcon sx={{ fontSize: 32 }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Monthly Tax Breakdown */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Monthly Tax Collection (This Year)
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell align="right">Tax Collected</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.monthlyTax.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      No tax data available
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.monthlyTax.map((item, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography fontWeight="medium">{item.month}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="primary">
                          {formatCurrency(item.tax)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={item.tax > 0 ? 'Active' : 'No Tax'}
                          color={item.tax > 0 ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Daily Tax (Last 7 Days) */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Daily Tax Collection (Last 7 Days)
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Tax Collected</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.dailyTax.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} align="center">
                      No tax data available
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.dailyTax.map((item, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography fontWeight="medium">
                          {format(new Date(item.date), 'MMM dd, yyyy')}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="primary">
                          {formatCurrency(item.tax)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
