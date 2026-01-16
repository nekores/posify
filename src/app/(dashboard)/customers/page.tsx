'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  InputAdornment,
  TablePagination,
  Tabs,
  Tab,
  Divider,
  Avatar,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  AccountBalanceWallet as WalletIcon,
  Receipt as ReceiptIcon,
  Payments as PaymentsIcon,
  History as HistoryIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  AttachMoney,
  ShoppingCart,
  Warning as WarningIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Link from 'next/link';
import { useAppStore } from '@/store/useStore';

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  businessName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  cnic: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  creditLimit: z.coerce.number().min(0),
  openingBalance: z.coerce.number(),
  customerTypeId: z.string().optional(),
});

type CustomerForm = z.infer<typeof customerSchema>;

interface Customer {
  id: string;
  name: string;
  businessName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  cnic: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  balance: number;
  creditLimit: number;
  openingBalance: number;
  createdAt: string;
  customerType?: {
    id: string;
    name: string;
  };
  _count?: {
    sales: number;
    ledger: number;
  };
  lastSale?: string;
  lastPayment?: string;
  totalSales?: number;
}

export default function CustomersPage() {
  const { currencySymbol } = useAppStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalReceivable: 0,
    activeCustomers: 0,
  });
  
  // Delete dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/customers?search=${search}&page=${page + 1}&limit=${rowsPerPage}`
      );
      const data = await res.json();
      setCustomers(data.data || []);
      setTotal(data.total || 0);

      // Calculate stats
      const allCustomers = data.data || [];
      const totalReceivable = allCustomers.reduce(
        (sum: number, c: Customer) => sum + Number(c.balance || 0),
        0
      );
      setStats({
        totalCustomers: data.total || 0,
        totalReceivable,
        activeCustomers: allCustomers.filter((c: Customer) => Number(c.balance) > 0).length,
      });
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search, page, rowsPerPage]);

  const handleOpenDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      reset({
        name: customer.name,
        businessName: customer.businessName || '',
        email: customer.email || '',
        phone: customer.phone || '',
        mobile: customer.mobile || '',
        cnic: customer.cnic || '',
        address: customer.address || '',
        city: customer.city || '',
        region: customer.region || '',
        creditLimit: customer.creditLimit,
        openingBalance: customer.openingBalance || 0,
      });
    } else {
      setEditingCustomer(null);
      reset({
        name: '',
        businessName: '',
        email: '',
        phone: '',
        mobile: '',
        cnic: '',
        address: '',
        city: '',
        region: '',
        creditLimit: 0,
        openingBalance: 0,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCustomer(null);
    reset();
  };

  const onSubmit = async (data: CustomerForm) => {
    try {
      const url = editingCustomer
        ? `/api/customers/${editingCustomer.id}`
        : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to save customer');

      toast.success(
        editingCustomer ? 'Customer updated successfully' : 'Customer created successfully'
      );
      handleCloseDialog();
      fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error('Failed to save customer');
    }
  };

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/customers/${customerToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        // Show the detailed error message from the API
        setDeleteError(data.error || 'Failed to delete customer');
        return;
      }

      toast.success(data.message || 'Customer deleted successfully');
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      setDeleteError('An unexpected error occurred. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
    setCustomerToDelete(null);
    setDeleteError(null);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Customer Management
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            color="secondary"
            component={Link}
            href="/customers/types"
            sx={{ borderRadius: 2 }}
          >
            Customer Types
          </Button>
          <Button
            variant="outlined"
            startIcon={<PaymentsIcon />}
            component={Link}
            href="/customers/collections"
            sx={{ borderRadius: 2 }}
          >
            Cash Collections
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{ borderRadius: 2 }}
          >
            Add Customer
          </Button>
        </Stack>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
            color: 'white',
            borderRadius: 3 
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Customers</Typography>
                  <Typography variant="h3" fontWeight="bold">{stats.totalCustomers}</Typography>
                </Box>
                <PersonIcon sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', 
            color: 'white',
            borderRadius: 3 
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Receivable</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    Rs {stats.totalReceivable.toLocaleString()}
                  </Typography>
                </Box>
                <AttachMoney sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
            color: 'white',
            borderRadius: 3 
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>With Balance</Typography>
                  <Typography variant="h3" fontWeight="bold">{stats.activeCustomers}</Typography>
                </Box>
                <WalletIcon sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ minWidth: 300, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button variant="outlined" startIcon={<FilterIcon />} sx={{ borderRadius: 2 }}>
            Filter
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} sx={{ borderRadius: 2 }}>
            Export
          </Button>
        </Box>
      </Paper>

      {/* Customer Table */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#1a1a2e' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Contact</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>City</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Opening</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Balance</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    No customers found
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer, index) => (
                  <TableRow key={customer.id} hover>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
                          {customer.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography fontWeight="medium">{customer.name}</Typography>
                          {customer.businessName && (
                            <Typography variant="caption" color="text.secondary">
                              {customer.businessName}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{customer.phone || '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {customer.email || ''}
                      </Typography>
                    </TableCell>
                    <TableCell>{customer.city || '-'}</TableCell>
                    <TableCell align="right">
                      Rs {Number(customer.openingBalance || 0).toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`Rs ${Number(customer.balance).toLocaleString()}`}
                        size="small"
                        color={Number(customer.balance) > 0 ? 'error' : 'success'}
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={customer.customerType?.name || 'Walk In'} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton 
                        size="small" 
                        color="primary"
                        component={Link}
                        href={`/customers/${customer.id}`}
                        title="View Details"
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="secondary"
                        onClick={() => handleOpenDialog(customer)}
                        title="Edit"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleDeleteClick(customer)}
                        title="Delete"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon />
              {editingCustomer ? 'Update Customer' : 'Create Customer'}
            </Box>
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            {/* Basic Info */}
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon color="primary" /> Basic Info
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  {...register('name')}
                  label="Customer Name *"
                  fullWidth
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  {...register('businessName')}
                  label="Business Name"
                  fullWidth
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Contact Info */}
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PhoneIcon color="primary" /> Contact & Address
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  {...register('phone')}
                  label="Phone No"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  {...register('mobile')}
                  label="Mobile No"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  {...register('email')}
                  label="Email"
                  type="email"
                  fullWidth
                  error={!!errors.email}
                  helperText={errors.email?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  {...register('cnic')}
                  label="CNIC"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  {...register('region')}
                  label="Region"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  {...register('city')}
                  label="Town/City"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  {...register('address')}
                  label="Address"
                  fullWidth
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Payment Info */}
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PaymentsIcon color="primary" /> Payments
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  {...register('openingBalance')}
                  label="Opening Balance"
                  type="number"
                  fullWidth
                  InputProps={{
                    startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  {...register('creditLimit')}
                  label="Credit Limit"
                  type="number"
                  fullWidth
                  InputProps={{
                    startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>,
                  }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleCloseDialog} variant="outlined" sx={{ borderRadius: 2 }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" sx={{ borderRadius: 2 }}>
              {editingCustomer ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteDialogClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ 
          bgcolor: deleteError ? 'error.main' : 'warning.main', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1 
        }}>
          {deleteError ? <ErrorIcon /> : <WarningIcon />}
          {deleteError ? 'Cannot Delete Customer' : 'Delete Customer?'}
        </DialogTitle>
        <DialogContent sx={{ mt: 2, pt: 2 }}>
          {deleteError ? (
            <Box>
              <Box sx={{ 
                p: 2, 
                bgcolor: 'error.light', 
                borderRadius: 2, 
                mb: 2,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1
              }}>
                <ErrorIcon color="error" sx={{ mt: 0.5 }} />
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold" color="error.dark">
                    Deletion Not Allowed
                  </Typography>
                  <Typography color="error.dark">
                    {deleteError}
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body2" color="text.secondary">
                <strong>What can you do instead?</strong>
              </Typography>
              <Box component="ul" sx={{ mt: 1, pl: 2, color: 'text.secondary' }}>
                {deleteError.includes('balance') && (
                  <li>Collect the outstanding balance first, then try deleting</li>
                )}
                {deleteError.includes('sale') && (
                  <li>This customer has transaction history and cannot be removed</li>
                )}
                <li>You can deactivate this customer instead of deleting</li>
              </Box>
            </Box>
          ) : (
            <Box>
              <Typography>
                Are you sure you want to delete customer <strong>"{customerToDelete?.name}"</strong>?
              </Typography>
              
              {customerToDelete && (
                <Box sx={{ 
                  mt: 2, 
                  p: 2, 
                  bgcolor: 'grey.100', 
                  borderRadius: 2 
                }}>
                  <Grid container spacing={1}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2" color="text.secondary">Balance:</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2" fontWeight="bold">
                        Rs {Number(customerToDelete.balance || 0).toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2" color="text.secondary">Total Sales:</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {customerToDelete._count?.sales || 0} sales
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                ⚠️ This action cannot be undone.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={handleDeleteDialogClose} 
            variant="outlined" 
            sx={{ borderRadius: 2 }}
          >
            {deleteError ? 'Close' : 'Cancel'}
          </Button>
          {!deleteError && (
            <Button 
              onClick={handleDeleteConfirm} 
              variant="contained" 
              color="error" 
              sx={{ borderRadius: 2 }}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Customer'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
