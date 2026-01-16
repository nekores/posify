'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Card,
  CardContent,
  ToggleButtonGroup,
  ToggleButton,
  Stack,
} from '@mui/material';
import {
  Search,
  Visibility,
  Receipt,
  Print,
  FileDownload,
  Add,
  TrendingUp,
  AttachMoney,
  ShoppingCart,
  Today,
  DateRange,
  CalendarMonth,
  AllInclusive,
  FilterList,
  Delete,
  Warning,
  AccountBalance as ProfitIcon,
} from '@mui/icons-material';
import { Grid } from '@mui/material';
import toast from 'react-hot-toast';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { useSession } from 'next-auth/react';

interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  product: {
    name: string;
    sku: string;
  };
}

interface Sale {
  id: string;
  invoiceNo: string;
  customerId: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  due: number;
  status: string;
  date: string;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
  user: {
    username: string;
  } | null;
  items: SaleItem[];
}

type DateFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

export default function SalesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMINISTRATOR';
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Date filter states
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [fromDate, setFromDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [showCustomDates, setShowCustomDates] = useState(false);
  
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    totalItems: 0,
    avgSaleValue: 0,
  });

  // Get date range based on filter
  const getDateRange = (filter: DateFilter) => {
    const now = new Date();
    switch (filter) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom': {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        // Validate dates
        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
          return { start: null, end: null }; // Return all data if dates invalid
        }
        return { start: startOfDay(from), end: endOfDay(to) };
      }
      case 'all':
      default:
        return { start: null, end: null };
    }
  };

  useEffect(() => {
    // Only auto-fetch for non-custom filters
    // For custom filter, user must click Apply button
    if (dateFilter !== 'custom') {
      fetchSales();
    }
  }, [dateFilter]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(dateFilter);
      let url = '/api/sales?limit=1000';
      
      if (start && end) {
        url += `&startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      const salesData = data.data || data.sales || [];
      setSales(salesData);
      
      // Calculate stats from filtered sales
      const totalRevenue = salesData.reduce((sum: number, s: Sale) => sum + Number(s.total), 0) || 0;
      const totalItems = salesData.reduce((sum: number, s: Sale) => sum + (s.items?.length || 0), 0) || 0;
      
      // Calculate total cost from sale items (costPrice * quantity)
      const totalCost = salesData.reduce((sum: number, s: Sale) => {
        const saleCost = s.items?.reduce((itemSum: number, item: SaleItem) => {
          const costPrice = (item as any).costPrice || 0;
          return itemSum + (Number(costPrice) * item.quantity);
        }, 0) || 0;
        return sum + saleCost;
      }, 0);
      
      const totalProfit = totalRevenue - totalCost;
      
      setStats({
        totalSales: salesData.length || 0,
        totalRevenue,
        totalCost,
        totalProfit,
        totalItems,
        avgSaleValue: salesData.length ? totalRevenue / salesData.length : 0,
      });
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilterChange = (_: any, newFilter: DateFilter) => {
    if (newFilter !== null) {
      setDateFilter(newFilter);
      setShowCustomDates(newFilter === 'custom');
      setPage(0);
      
      // Update date picker to match selected filter
      const today = format(new Date(), 'yyyy-MM-dd');
      if (newFilter === 'today') {
        setFromDate(today);
        setToDate(today);
      } else if (newFilter === 'week') {
        setFromDate(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        setToDate(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      } else if (newFilter === 'month') {
        setFromDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
        setToDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
      }
    }
  };

  // Delete sale handler
  const handleDeleteClick = (sale: Sale) => {
    setSaleToDelete(sale);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!saleToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/sales/${saleToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Sale deleted successfully');
        // Refresh the sales list
        fetchSales();
        setDeleteDialogOpen(false);
        setSaleToDelete(null);
      } else {
        toast.error(data.error || 'Failed to delete sale');
      }
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast.error('Failed to delete sale');
    } finally {
      setDeleting(false);
    }
  };

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setDetailsOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const filteredSales = sales.filter((sale) =>
    sale.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
    sale.customer?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const paginatedSales = filteredSales.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Sales Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          href="/pos"
          sx={{ borderRadius: 2 }}
        >
          New Sale
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{xs:12, sm:6, md:isAdmin ? 2.4 : 3}}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>Total Sales</Typography>
                  <Typography variant="h4" fontWeight="bold">{stats.totalSales}</Typography>
                </Box>
                <ShoppingCart sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{xs:12, sm:6, md:isAdmin ? 2.4 : 3}}>
          <Card sx={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>Total Revenue</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    Rs {stats.totalRevenue.toLocaleString()}
                  </Typography>
                </Box>
                <AttachMoney sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Profit Card - Admin Only */}
        {isAdmin && (
          <Grid size={{xs:12, sm:6, md:2.4}}>
            <Card sx={{ 
              background: stats.totalProfit >= 0 
                ? 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)' 
                : 'linear-gradient(135deg, #cb2d3e 0%, #ef473a 100%)', 
              color: 'white' 
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {stats.totalProfit >= 0 ? 'Profit 💰' : 'Loss 📉'}
                    </Typography>
                    <Typography variant="h4" fontWeight="bold">
                      Rs {Math.abs(stats.totalProfit).toLocaleString()}
                    </Typography>
                  </Box>
                  <ProfitIcon sx={{ fontSize: 48, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
        
        <Grid size={{xs:12, sm:6, md:isAdmin ? 2.4 : 3}}>
          <Card sx={{ background: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>Items Sold</Typography>
                  <Typography variant="h4" fontWeight="bold">{stats.totalItems}</Typography>
                </Box>
                <Receipt sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
                </Grid>
        <Grid size={{xs:12, sm:6, md:isAdmin ? 2.4 : 3}}>
          <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>Avg Sale Value</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    Rs {stats.avgSaleValue.toFixed(0)}
                  </Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Date Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          {/* Quick Date Filters */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterList color="action" />
              <Typography variant="body2" color="text.secondary" fontWeight="medium">
                Filter by:
              </Typography>
            </Box>
            <ToggleButtonGroup
              value={dateFilter}
              exclusive
              onChange={handleDateFilterChange}
              size="small"
              sx={{ 
                '& .MuiToggleButton-root': { 
                  px: 2,
                  borderRadius: '8px !important',
                  mx: 0.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' }
                  }
                }
              }}
            >
              <ToggleButton value="today">
                <Today sx={{ mr: 0.5, fontSize: 18 }} /> Today
              </ToggleButton>
              <ToggleButton value="week">
                <DateRange sx={{ mr: 0.5, fontSize: 18 }} /> This Week
              </ToggleButton>
              <ToggleButton value="month">
                <CalendarMonth sx={{ mr: 0.5, fontSize: 18 }} /> This Month
              </ToggleButton>
              <ToggleButton value="all">
                <AllInclusive sx={{ mr: 0.5, fontSize: 18 }} /> All Time
              </ToggleButton>
              <ToggleButton value="custom">
                <DateRange sx={{ mr: 0.5, fontSize: 18 }} /> Custom
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Custom Date Range */}
          {showCustomDates && (
            <Box sx={{ 
              display: 'flex', 
              gap: 2, 
              alignItems: 'center',
              p: 2,
              bgcolor: 'grey.50',
              borderRadius: 2
            }}>
              <Typography variant="body2" color="text.secondary">From:</Typography>
              <TextField
                type="date"
                size="small"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                sx={{ 
                  width: 160,
                  '& .MuiOutlinedInput-root': { borderRadius: 2 }
                }}
              />
              <Typography variant="body2" color="text.secondary">To:</Typography>
              <TextField
                type="date"
                size="small"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                sx={{ 
                  width: 160,
                  '& .MuiOutlinedInput-root': { borderRadius: 2 }
                }}
              />
              <Button 
                variant="contained" 
                size="small"
                onClick={() => {
                  const from = new Date(fromDate);
                  const to = new Date(toDate);
                  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
                    toast.error('Please enter valid dates');
                    return;
                  }
                  if (from > to) {
                    toast.error('From date cannot be after To date');
                    return;
                  }
                  fetchSales();
                }}
                sx={{ borderRadius: 2 }}
              >
                Apply
              </Button>
            </Box>
          )}

          {/* Search and Export */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search by invoice # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ 
                minWidth: 300,
                '& .MuiOutlinedInput-root': { borderRadius: 2 }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
            <Button variant="outlined" startIcon={<FileDownload />} sx={{ borderRadius: 2 }}>
              Export
            </Button>
            
            {/* Quick Date Picker */}
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                type="date"
                size="small"
                value={fromDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setFromDate(newDate);
                  setToDate(newDate); // Single day selection
                  setDateFilter('custom');
                  // Auto-apply on date selection
                  const date = new Date(newDate);
                  if (!isNaN(date.getTime())) {
                    setTimeout(() => fetchSales(), 100);
                  }
                }}
                sx={{ 
                  width: 150,
                  '& .MuiOutlinedInput-root': { 
                    borderRadius: 2,
                    bgcolor: 'primary.50',
                    '& fieldset': { borderColor: 'primary.main' },
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarMonth fontSize="small" color="primary" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </Box>
        </Stack>
      </Paper>

      {/* Sales Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell><strong>Invoice #</strong></TableCell>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Customer</strong></TableCell>
                <TableCell align="right"><strong>Total</strong></TableCell>
                <TableCell align="right"><strong>Paid</strong></TableCell>
                <TableCell align="right"><strong>Due</strong></TableCell>
                <TableCell align="center"><strong>Status</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">Loading...</TableCell>
                </TableRow>
              ) : paginatedSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">No sales found</TableCell>
                </TableRow>
              ) : (
                paginatedSales.map((sale) => (
                  <TableRow key={sale.id} hover>
                    <TableCell>
                      <Typography fontWeight="medium">{sale.invoiceNo}</Typography>
                    </TableCell>
                    <TableCell>
                      {format(new Date(sale.date), 'dd MMM yyyy HH:mm')}
                    </TableCell>
                    <TableCell>{sale.customer?.name || 'Walk-in'}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="medium">
                        Rs {Number(sale.total).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>
                      Rs {Number(sale.paid).toLocaleString()}
                    </TableCell>
                    <TableCell align="right" sx={{ color: Number(sale.due) > 0 ? 'error.main' : 'inherit' }}>
                      Rs {Number(sale.due).toLocaleString()}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={sale.status}
                        color={getStatusColor(sale.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(sale)}
                        title="View Details"
                        color="primary"
                      >
                        <Visibility />
                      </IconButton>
                      <IconButton size="small" title="Print Invoice">
                        <Print />
                      </IconButton>
                      {isAdmin && (
                        <IconButton 
                          size="small" 
                          title="Delete Sale"
                          color="error"
                          onClick={() => handleDeleteClick(sale)}
                        >
                          <Delete />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredSales.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* Sale Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Invoice: {selectedSale?.invoiceNo}</Typography>
            <Chip
              label={selectedSale?.status}
              color={getStatusColor(selectedSale?.status || '') as any}
              size="small"
            />
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedSale && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{xs:6, sm:6, md:6}}>
                  <Typography variant="body2" color="text.secondary">Customer</Typography>
                  <Typography fontWeight="medium">
                    {selectedSale.customer?.name || 'Walk-in Customer'}
                  </Typography>
                </Grid>
                <Grid size={{xs:6, sm:6, md:6}}>
                  <Typography variant="body2" color="text.secondary">Date</Typography>
                  <Typography fontWeight="medium">
                    {format(new Date(selectedSale.date), 'dd MMM yyyy HH:mm')}
                  </Typography>
                </Grid>
                  <Grid size={{xs:6, sm:6, md:6}}>
                  <Typography variant="body2" color="text.secondary">Cashier</Typography>
                  <Typography fontWeight="medium">
                    {selectedSale.user?.username || 'N/A'}
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                Items
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="center">Qty</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedSale.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product?.name}</TableCell>
                        <TableCell align="center">{item.quantity}</TableCell>
                        <TableCell align="right">Rs {Number(item.unitPrice).toLocaleString()}</TableCell>
                        <TableCell align="right">Rs {Number(item.total).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ textAlign: 'right' }}>
                <Typography>Subtotal: Rs {Number(selectedSale.subtotal).toLocaleString()}</Typography>
                <Typography>Discount: Rs {Number(selectedSale.discount).toLocaleString()}</Typography>
                <Typography>Tax: Rs {Number(selectedSale.tax).toLocaleString()}</Typography>
                <Typography variant="h6" fontWeight="bold" sx={{ mt: 1 }}>
                  Total: Rs {Number(selectedSale.total).toLocaleString()}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography color="success.main">Paid: Rs {Number(selectedSale.paid).toLocaleString()}</Typography>
                {Number(selectedSale.due) > 0 && (
                  <Typography color="error.main">Due: Rs {Number(selectedSale.due).toLocaleString()}</Typography>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
          <Button variant="outlined" startIcon={<Print />}>Print</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, overflow: 'hidden' }
        }}
      >
        {/* Warning Header */}
        <Box sx={{ 
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: 'white',
          p: 3,
          textAlign: 'center'
        }}>
          <Box sx={{ 
            width: 70, 
            height: 70, 
            borderRadius: '50%', 
            bgcolor: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2
          }}>
            <Warning sx={{ fontSize: 40 }} />
          </Box>
          <Typography variant="h5" fontWeight="bold">
            Delete Sale?
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            This action cannot be undone
          </Typography>
        </Box>

        <DialogContent sx={{ p: 3 }}>
          {saleToDelete && (
            <Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                You are about to delete the following sale:
              </Typography>

              <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid size={{xs:6, sm:6, md:6}}>
                      <Typography variant="body2" color="text.secondary">Invoice #</Typography>
                      <Typography variant="h6" fontWeight="bold">{saleToDelete.invoiceNo}</Typography>
                    </Grid>
                    <Grid size={{xs:6, sm:6, md:6}}>
                      <Typography variant="body2" color="text.secondary">Total Amount</Typography>
                      <Typography variant="h6" fontWeight="bold" color="error">
                        Rs {Number(saleToDelete.total).toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid size={{xs:6, sm:6, md:6}}>
                      <Typography variant="body2" color="text.secondary">Customer</Typography>
                      <Typography fontWeight="medium">
                        {saleToDelete.customer?.name || 'Walk-in'}
                      </Typography>
                    </Grid>
                    <Grid size={{xs:6, sm:6, md:6}}>
                      <Typography variant="body2" color="text.secondary">Date</Typography>
                      <Typography fontWeight="medium">
                        {format(new Date(saleToDelete.date), 'dd MMM yyyy HH:mm')}
                      </Typography>
                    </Grid>
                    <Grid size={{xs:12, sm:12, md:12}}>
                      <Typography variant="body2" color="text.secondary">Items</Typography>
                      <Typography fontWeight="medium">
                        {saleToDelete.items?.length || 0} item(s)
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Box sx={{ 
                p: 2, 
                bgcolor: 'warning.50', 
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'warning.200'
              }}>
                <Typography variant="body2" color="warning.dark" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Warning fontSize="small" />
                  <strong>What will happen:</strong>
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 3, mt: 1 }}>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Stock will be restored for all items in this sale
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Customer balance will be adjusted (if credit sale)
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    All payments for this sale will be deleted
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Financial reports will be updated automatically
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
            disabled={deleting}
            sx={{ flex: 1, borderRadius: 2, textTransform: 'none', py: 1.2 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={deleting ? null : <Delete />}
            sx={{ flex: 1, borderRadius: 2, textTransform: 'none', py: 1.2, fontWeight: 'bold' }}
          >
            {deleting ? 'Deleting...' : 'Delete Sale'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

