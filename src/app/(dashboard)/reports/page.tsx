'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Chip,
  Tab,
  Tabs,
  Skeleton,
  Stack,
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  TrendingUp,
  TrendingDown,
  AttachMoney,
  ShoppingCart,
  Inventory,
  FileDownload,
  DateRange,
  ShowChart,
  PieChart as PieChartIcon,
} from '@mui/icons-material';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ReportData {
  salesReport: {
    totalSales: number;
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    topProducts: { name: string; quantity: number; revenue: number }[];
    dailySales: { date: string; total: number; count: number }[];
  };
  purchaseReport: {
    totalPurchases: number;
    totalAmount: number;
    topSuppliers: { name: string; amount: number }[];
  };
  inventoryReport: {
    totalProducts: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  expenseReport: {
    totalExpenses: number;
    byCategory: { category: string; amount: number }[];
  };
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [dateRange, setDateRange] = useState({
    from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    to: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [reportData, setReportData] = useState<ReportData | null>(null);

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/reports?from=${dateRange.from}&to=${dateRange.to}`
      );
      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDateRange = (range: string) => {
    const today = new Date();
    let from, to;

    switch (range) {
      case 'today':
        from = to = format(today, 'yyyy-MM-dd');
        break;
      case 'yesterday':
        from = to = format(subDays(today, 1), 'yyyy-MM-dd');
        break;
      case 'last7days':
        from = format(subDays(today, 7), 'yyyy-MM-dd');
        to = format(today, 'yyyy-MM-dd');
        break;
      case 'last30days':
        from = format(subDays(today, 30), 'yyyy-MM-dd');
        to = format(today, 'yyyy-MM-dd');
        break;
      case 'thisMonth':
        from = format(startOfMonth(today), 'yyyy-MM-dd');
        to = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
      default:
        return;
    }

    setDateRange({ from, to });
  };

  const profitMargin = reportData?.salesReport.totalRevenue
    ? ((reportData.salesReport.grossProfit / reportData.salesReport.totalRevenue) * 100).toFixed(1)
    : '0';

  // Chart configurations
  const salesChartData = {
    labels: reportData?.salesReport.dailySales?.map(d => format(new Date(d.date), 'MMM dd')) || [],
    datasets: [
      {
        label: 'Revenue',
        data: reportData?.salesReport.dailySales?.map(d => d.total) || [],
        fill: true,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: '#10b981',
        borderWidth: 3,
        tension: 0.4,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Sales Count',
        data: reportData?.salesReport.dailySales?.map(d => d.count * 100) || [],
        fill: false,
        borderColor: '#6366f1',
        borderWidth: 2,
        tension: 0.4,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 3,
        yAxisID: 'y1',
      },
    ],
  };

  const salesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 12, weight: 500 as const },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 14, weight: 'bold' as const },
        bodyFont: { size: 13 },
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        position: 'left' as const,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: {
          font: { size: 11 },
          callback: (value: any) => `Rs ${(value / 1000).toFixed(0)}k`,
        },
      },
      y1: {
        position: 'right' as const,
        grid: { display: false },
        ticks: {
          font: { size: 11 },
          callback: (value: any) => `${value / 100}`,
        },
      },
    },
  };

  const topProductsChartData = {
    labels: reportData?.salesReport.topProducts?.slice(0, 8).map(p => 
      p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name
    ) || [],
    datasets: [
      {
        label: 'Revenue',
        data: reportData?.salesReport.topProducts?.slice(0, 8).map(p => p.revenue) || [],
        backgroundColor: [
          '#10b981', '#3b82f6', '#f59e0b', '#ef4444', 
          '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'
        ],
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const topProductsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => `Revenue: Rs ${context.raw.toLocaleString()}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: {
          font: { size: 11 },
          callback: (value: any) => `Rs ${(value / 1000).toFixed(0)}k`,
        },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
    },
  };

  const expenseDoughnutData = {
    labels: reportData?.expenseReport.byCategory?.map(c => c.category) || ['No Data'],
    datasets: [
      {
        data: reportData?.expenseReport.byCategory?.map(c => c.amount) || [1],
        backgroundColor: [
          '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
          '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
        ],
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const expenseDoughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: { size: 12 },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => `Rs ${context.raw.toLocaleString()}`,
        },
      },
    },
  };

  const profitLossChartData = {
    labels: ['Revenue', 'Cost', 'Gross Profit', 'Expenses', 'Net Profit'],
    datasets: [
      {
        data: [
          reportData?.salesReport.totalRevenue || 0,
          reportData?.salesReport.totalCost || 0,
          reportData?.salesReport.grossProfit || 0,
          reportData?.expenseReport.totalExpenses || 0,
          (reportData?.salesReport.grossProfit || 0) - (reportData?.expenseReport.totalExpenses || 0),
        ],
        backgroundColor: ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'],
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const profitLossChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => `Rs ${context.raw.toLocaleString()}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11, weight: 500 as const } },
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: {
          font: { size: 11 },
          callback: (value: any) => `Rs ${(value / 1000).toFixed(0)}k`,
        },
      },
    },
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Reports & Analytics
        </Typography>
        <Button variant="outlined" startIcon={<FileDownload />} sx={{ borderRadius: 2 }}>
          Export Report
        </Button>
      </Box>

      {/* Date Range Selector */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <DateRange color="action" />
          <TextField
            size="small"
            type="date"
            label="From"
            value={dateRange.from}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <TextField
            size="small"
            type="date"
            label="To"
            value={dateRange.to}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Divider orientation="vertical" flexItem />
          <Stack direction="row" spacing={1}>
            {[
              { label: 'Today', value: 'today' },
              { label: 'Yesterday', value: 'yesterday' },
              { label: '7 Days', value: 'last7days' },
              { label: '30 Days', value: 'last30days' },
              { label: 'This Month', value: 'thisMonth' },
            ].map((btn) => (
              <Chip
                key={btn.value}
                label={btn.label}
                onClick={() => handleQuickDateRange(btn.value)}
                variant="outlined"
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'primary.light', color: 'white', borderColor: 'primary.main' }
                }}
              />
            ))}
          </Stack>
        </Box>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
            color: 'white',
            borderRadius: 3,
            boxShadow: '0 10px 40px rgba(16, 185, 129, 0.3)'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Revenue</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {loading ? <Skeleton width={100} /> : `Rs ${(reportData?.salesReport.totalRevenue || 0).toLocaleString()}`}
                  </Typography>
                </Box>
                <AttachMoney sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
            color: 'white',
            borderRadius: 3,
            boxShadow: '0 10px 40px rgba(99, 102, 241, 0.3)'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Gross Profit</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {loading ? <Skeleton width={100} /> : `Rs ${(reportData?.salesReport.grossProfit || 0).toLocaleString()}`}
                  </Typography>
                  <Chip
                    label={`${profitMargin}% margin`}
                    size="small"
                    sx={{ mt: 1, backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                </Box>
                <TrendingUp sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', 
            color: 'white',
            borderRadius: 3,
            boxShadow: '0 10px 40px rgba(239, 68, 68, 0.3)'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Expenses</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {loading ? <Skeleton width={100} /> : `Rs ${(reportData?.expenseReport.totalExpenses || 0).toLocaleString()}`}
                  </Typography>
                </Box>
                <TrendingDown sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
            color: 'white',
            borderRadius: 3,
            boxShadow: '0 10px 40px rgba(245, 158, 11, 0.3)'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Sales</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {loading ? <Skeleton width={60} /> : reportData?.salesReport.totalSales || 0}
                  </Typography>
                </Box>
                <ShoppingCart sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Report Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs 
          value={tabValue} 
          onChange={(_, v) => setTabValue(v)} 
          variant="scrollable" 
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              minHeight: 56,
            },
          }}
        >
          <Tab label="Sales Report" icon={<BarChartIcon />} iconPosition="start" />
          <Tab label="Purchase Report" icon={<ShoppingCart />} iconPosition="start" />
          <Tab label="Inventory Report" icon={<Inventory />} iconPosition="start" />
          <Tab label="Profit & Loss" icon={<ShowChart />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Sales Report */}
      {tabValue === 0 && (
        <Box>
          {/* Daily Sales Chart - Full Width Row */}
          <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  📈 Sales Trend
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Daily revenue and sales count
                </Typography>
              </Box>
            </Box>
            <Box sx={{ height: 400, width: '100%' }}>
              {loading ? (
                <Skeleton variant="rectangular" height="100%" sx={{ borderRadius: 2 }} />
              ) : (
                <Line data={salesChartData} options={salesChartOptions} />
              )}
            </Box>
          </Paper>

          {/* Top Products Row */}
          <Grid container spacing={3}>
            {/* Top Products Chart */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper sx={{ p: 3, borderRadius: 2, height: '100%' }}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" fontWeight="bold">
                    🏆 Top Selling Products
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    By revenue
                  </Typography>
                </Box>
                <Box sx={{ height: 350 }}>
                  {loading ? (
                    <Skeleton variant="rectangular" height="100%" sx={{ borderRadius: 2 }} />
                  ) : (
                    <Bar data={topProductsChartData} options={topProductsChartOptions} />
                  )}
                </Box>
              </Paper>
            </Grid>

            {/* Top Products Table */}
            <Grid size={{ xs: 12, md: 5 }}>
            <Paper sx={{ p: 3, borderRadius: 2, height: '100%' }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                📊 Sales Details
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Revenue</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton /></TableCell>
                          <TableCell><Skeleton /></TableCell>
                          <TableCell><Skeleton /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      reportData?.salesReport.topProducts?.slice(0, 10).map((product, index) => (
                        <TableRow key={index} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip 
                                label={index + 1} 
                                size="small" 
                                color={index < 3 ? 'primary' : 'default'}
                                sx={{ width: 24, height: 24, fontSize: 11 }}
                              />
                              <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                                {product.name}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">{product.quantity}</TableCell>
                          <TableCell align="right">
                            <Typography fontWeight="medium">
                              Rs {product.revenue.toLocaleString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
          </Grid>
        </Box>
      )}

      {/* Purchase Report */}
      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
                🛒 Purchase Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Box sx={{ 
                    textAlign: 'center', 
                    p: 3, 
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    borderRadius: 2 
                  }}>
                    <Typography variant="h3" fontWeight="bold" color="primary">
                      {loading ? <Skeleton width={60} /> : reportData?.purchaseReport.totalPurchases || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Purchases
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Box sx={{ 
                    textAlign: 'center', 
                    p: 3, 
                    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                    borderRadius: 2 
                  }}>
                    <Typography variant="h3" fontWeight="bold" color="error">
                      {loading ? <Skeleton width={100} /> : `Rs ${(reportData?.purchaseReport.totalAmount || 0).toLocaleString()}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Amount
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, borderRadius: 2, height: '100%' }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                🏭 Top Vendors
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Vendor</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton /></TableCell>
                          <TableCell><Skeleton /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      reportData?.purchaseReport.topSuppliers?.map((supplier, index) => (
                        <TableRow key={index} hover>
                          <TableCell>{supplier.name}</TableCell>
                          <TableCell align="right">
                            <Typography fontWeight="medium">
                              Rs {supplier.amount.toLocaleString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Inventory Report */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          {[
            { title: 'Total Products', value: reportData?.inventoryReport.totalProducts || 0, color: '#3b82f6', icon: '📦' },
            { title: 'Stock Value', value: `Rs ${(reportData?.inventoryReport.totalValue || 0).toLocaleString()}`, color: '#10b981', icon: '💰' },
            { title: 'Low Stock', value: reportData?.inventoryReport.lowStockCount || 0, color: '#f59e0b', icon: '⚠️' },
            { title: 'Out of Stock', value: reportData?.inventoryReport.outOfStockCount || 0, color: '#ef4444', icon: '❌' },
          ].map((item, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
              <Paper sx={{ 
                p: 3, 
                textAlign: 'center', 
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 }
              }}>
                <Typography variant="h2" sx={{ mb: 1 }}>{item.icon}</Typography>
                <Typography variant="h4" fontWeight="bold" sx={{ color: item.color }}>
                  {loading ? <Skeleton width={60} sx={{ mx: 'auto' }} /> : item.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.title}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Profit & Loss */}
      {tabValue === 3 && (
        <Grid container spacing={3}>
          {/* P&L Chart */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
                📊 Financial Overview
              </Typography>
              <Box sx={{ height: 300 }}>
                {loading ? (
                  <Skeleton variant="rectangular" height="100%" sx={{ borderRadius: 2 }} />
                ) : (
                  <Bar data={profitLossChartData} options={profitLossChartOptions} />
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Expense Breakdown */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
                🥧 Expense Breakdown
              </Typography>
              <Box sx={{ height: 300 }}>
                {loading ? (
                  <Skeleton variant="rectangular" height="100%" sx={{ borderRadius: 2 }} />
                ) : (
                  <Doughnut data={expenseDoughnutData} options={expenseDoughnutOptions} />
                )}
              </Box>
            </Paper>
          </Grid>

          {/* P&L Statement */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
                📋 Profit & Loss Statement
              </Typography>
              <TableContainer>
                <Table>
                  <TableBody>
                    <TableRow sx={{ backgroundColor: '#dcfce7' }}>
                      <TableCell colSpan={2}>
                        <Typography fontWeight="bold" color="success.main">💵 Income</Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ pl: 4 }}>Sales Revenue</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="medium">
                          Rs {(reportData?.salesReport.totalRevenue || 0).toLocaleString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ backgroundColor: '#fee2e2' }}>
                      <TableCell colSpan={2}>
                        <Typography fontWeight="bold" color="error.main">📦 Cost of Goods Sold</Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ pl: 4 }}>Cost of Sales</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="medium">
                          Rs {(reportData?.salesReport.totalCost || 0).toLocaleString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ backgroundColor: '#dbeafe' }}>
                      <TableCell>
                        <Typography fontWeight="bold" color="primary.main">💎 Gross Profit</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="primary.main" variant="h6">
                          Rs {(reportData?.salesReport.grossProfit || 0).toLocaleString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ backgroundColor: '#fef3c7' }}>
                      <TableCell colSpan={2}>
                        <Typography fontWeight="bold" color="warning.main">💸 Operating Expenses</Typography>
                      </TableCell>
                    </TableRow>
                    {reportData?.expenseReport.byCategory?.map((cat, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ pl: 4 }}>{cat.category}</TableCell>
                        <TableCell align="right">Rs {cat.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ 
                      background: (reportData?.salesReport.grossProfit || 0) - (reportData?.expenseReport.totalExpenses || 0) >= 0 
                        ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' 
                        : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                    }}>
                      <TableCell>
                        <Typography fontWeight="bold" variant="h6">
                          🎯 Net Profit
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          fontWeight="bold"
                          variant="h5"
                          color={
                            (reportData?.salesReport.grossProfit || 0) - (reportData?.expenseReport.totalExpenses || 0) >= 0
                              ? 'success.main'
                              : 'error.main'
                          }
                        >
                          Rs {(
                            (reportData?.salesReport.grossProfit || 0) - (reportData?.expenseReport.totalExpenses || 0)
                          ).toLocaleString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
