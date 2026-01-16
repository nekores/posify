'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Skeleton,
  Chip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShoppingCart as SalesIcon,
  Inventory as InventoryIcon,
  People as CustomersIcon,
  AttachMoney as MoneyIcon,
  Receipt as ExpensesIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useFormatCurrency } from '@/lib/currency';
import { useAppStore } from '@/store/useStore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DashboardData {
  todaySales: { total: number; count: number };
  monthSales: { total: number; count: number };
  totalProducts: number;
  totalCustomers: number;
  todayExpenses: number;
  cashInHand: number;
  recentSales: Array<{
    id: string;
    invoiceNo: string;
    customer: string;
    total: number;
    date: string;
  }>;
  dailySales: Array<{ date: string; total: number }>;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  loading?: boolean;
}

interface StatCardConfig {
  gradient: string;
  iconColor: string;
}

const cardConfigs: Record<string, StatCardConfig> = {
  sales: {
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    iconColor: 'rgba(255,255,255,0.7)',
  },
  month: {
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    iconColor: 'rgba(255,255,255,0.7)',
  },
  products: {
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    iconColor: 'rgba(255,255,255,0.7)',
  },
  customers: {
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    iconColor: 'rgba(255,255,255,0.7)',
  },
  cash: {
    gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    iconColor: 'rgba(255,255,255,0.7)',
  },
  expenses: {
    gradient: 'linear-gradient(135deg, #f43b47 0%, #453a94 100%)',
    iconColor: 'rgba(255,255,255,0.7)',
  },
};

function StatCard({ title, value, icon, color, trend, trendUp = true, subtitle, loading }: StatCardProps) {
  // Map color to card config
  const configKey = color === '#4caf50' ? 'sales' :
                   color === '#2196f3' ? 'month' :
                   color === '#ff9800' ? 'products' :
                   color === '#9c27b0' ? 'customers' :
                   color === '#00bcd4' ? 'cash' : 'expenses';
  
  const config = cardConfigs[configKey];

  return (
    <Card
      sx={{
        height: '100%',
        background: config.gradient,
        color: 'white',
        borderRadius: 3,
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
              {title}
            </Typography>
            {loading ? (
              <Skeleton variant="text" width={120} height={40} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
            ) : (
              <Typography variant="h4" fontWeight="bold" sx={{ color: 'white' }}>
                {value}
              </Typography>
            )}
            {subtitle && !loading && (
              <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
            {trend && !loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                {trendUp ? (
                  <TrendingUpIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', mr: 0.5 }} />
                ) : (
                  <TrendingDownIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', mr: 0.5 }} />
                )}
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  {trend}
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box sx={{ color: config.iconColor }}>
              {icon}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const formatCurrency = useFormatCurrency();
  const { currencySymbol } = useAppStore();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-PK', { 
      day: '2-digit', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Chart configuration
  const chartData = {
    labels: data?.dailySales.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric' });
    }) || [],
    datasets: [
      {
        label: 'Daily Sales',
        data: data?.dailySales.map(d => d.total) || [],
        fill: true,
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        tension: 0.4,
        pointBackgroundColor: '#4caf50',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        callbacks: {
          label: (context: any) => {
            const value = context.parsed?.y;
            return value != null ? `Sales: ${formatCurrency(value)}` : '';
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          callback: (value: number | string) => formatCurrency(Number(value)),
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  const today = new Date().toLocaleDateString('en-PK', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h4" fontWeight="bold">
          Dashboard
        </Typography>
        <Chip 
          icon={<CalendarIcon />} 
          label={today} 
          variant="outlined" 
          color="primary"
        />
      </Box>
      <Typography color="text.secondary" gutterBottom sx={{ mb: 4 }}>
        Welcome back! Here&apos;s what&apos;s happening with your store today.
      </Typography>

      {/* Stats Grid - 3 cards per row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Row 1 */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Today's Sales"
            value={data ? formatCurrency(data.todaySales.total) : formatCurrency(0)}
            icon={<SalesIcon sx={{ fontSize: 32 }} />}
            color="#4caf50"
            subtitle={data ? `${data.todaySales.count} transactions` : undefined}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="This Month"
            value={data ? formatCurrency(data.monthSales.total) : formatCurrency(0)}
            icon={<MoneyIcon sx={{ fontSize: 32 }} />}
            color="#2196f3"
            subtitle={data ? `${data.monthSales.count} transactions` : undefined}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Total Products"
            value={data?.totalProducts || 0}
            icon={<InventoryIcon sx={{ fontSize: 32 }} />}
            color="#ff9800"
            subtitle="Active products"
            loading={loading}
          />
        </Grid>
        
        {/* Row 2 */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Total Customers"
            value={data?.totalCustomers || 0}
            icon={<CustomersIcon sx={{ fontSize: 32 }} />}
            color="#9c27b0"
            subtitle="Registered customers"
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Cash in Hand"
            value={data ? formatCurrency(data.cashInHand) : formatCurrency(0)}
            icon={<MoneyIcon sx={{ fontSize: 32 }} />}
            color="#00bcd4"
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Today's Expenses"
            value={data ? formatCurrency(data.todayExpenses) : formatCurrency(0)}
            icon={<ExpensesIcon sx={{ fontSize: 32 }} />}
            color="#f44336"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Sales Overview (Last 7 Days)
            </Typography>
            {loading ? (
              <Skeleton variant="rectangular" height={320} />
            ) : data?.dailySales && data.dailySales.length > 0 ? (
              <Box sx={{ height: 320 }}>
                <Line data={chartData} options={chartOptions} />
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 320,
                  color: 'text.secondary',
                }}
              >
                No sales data available for chart
              </Box>
            )}
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, height: 400, overflow: 'hidden' }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Recent Sales
            </Typography>
            {loading ? (
              <Box>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} variant="text" height={60} sx={{ mb: 1 }} />
                ))}
              </Box>
            ) : data?.recentSales && data.recentSales.length > 0 ? (
              <List sx={{ maxHeight: 320, overflow: 'auto' }}>
                {data.recentSales.map((sale, index) => (
                  <Box key={sale.id}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" fontWeight="medium">
                              {sale.invoiceNo}
                            </Typography>
                            <Typography variant="body2" fontWeight="bold" color="success.main">
                              {formatCurrency(sale.total)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {sale.customer}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(sale.date)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < data.recentSales.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 320,
                  color: 'text.secondary',
                }}
              >
                No recent sales
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

