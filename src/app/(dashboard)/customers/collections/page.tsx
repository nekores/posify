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
  Autocomplete,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Payments as PaymentsIcon,
  ArrowBack,
  FilterList,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  balance: number;
}

interface Collection {
  id: string;
  date: string;
  amount: number;
  customerId: string;
  customer: {
    id: string;
    name: string;
    balance: number;
  };
  description: string;
  transactionNo: string;
  balanceAfter: number;
}

export default function CashCollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);

  // Create collection dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCollections();
    fetchCustomers();
  }, [page, rowsPerPage]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/collections?page=${page + 1}&limit=${rowsPerPage}&_t=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      setCollections(data.data || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Error fetching collections:', error);
      toast.error('Failed to fetch collections');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`/api/customers?limit=1000&_t=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      setCustomers(data.data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleCreateCollection = async () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          note,
        }),
      });

      if (!res.ok) throw new Error('Failed to create collection');

      toast.success('Collection recorded successfully');
      setDialogOpen(false);
      setSelectedCustomer(null);
      setAmount('');
      setNote('');
      // Refresh both collections and customers
      await fetchCollections();
      await fetchCustomers();
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error('Failed to record collection');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (collection: Collection) => {
    setCollectionToDelete(collection);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!collectionToDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/collections/${collectionToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete collection');
      }

      toast.success(data.message || 'Collection deleted');
      if (data.note) {
        toast(data.note, { duration: 5000, icon: 'ℹ️' });
      }
      // Immediately remove from local state for instant UI update
      setCollections(prev => prev.filter(c => c.id !== collectionToDelete.id));
      setTotal(prev => prev - 1);
      // Close dialog
      setDeleteDialogOpen(false);
      setCollectionToDelete(null);
      // Then refresh from server
      await fetchCollections();
      await fetchCustomers();
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete collection');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton component={Link} href="/customers">
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" fontWeight="bold">
            Cash Collections
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<FilterList />}
            sx={{ borderRadius: 2 }}
          >
            All Collections
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Create Collection
          </Button>
        </Stack>
      </Box>

      {/* Quick Customer Search */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Autocomplete
            options={customers}
            getOptionLabel={(option) => `${option.name} (Balance: Rs ${Number(option.balance).toLocaleString()})`}
            value={selectedCustomer}
            onChange={(_, newValue) => {
              setSelectedCustomer(newValue);
              if (newValue) setDialogOpen(true);
            }}
            renderInput={(params) => (
              <TextField 
                {...params} 
                label="Select Customer" 
                placeholder="Search customer..."
                sx={{ minWidth: 400 }}
              />
            )}
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            onClick={() => selectedCustomer && setDialogOpen(true)}
            disabled={!selectedCustomer}
            sx={{ borderRadius: 2, height: 56 }}
          >
            Search Customer
          </Button>
          <Button
            variant="outlined"
            color="success"
            onClick={() => setDialogOpen(true)}
            sx={{ borderRadius: 2, height: 56 }}
          >
            Create Collection
          </Button>
          <Button
            variant="outlined"
            component={Link}
            href="/customers/collections"
            sx={{ borderRadius: 2, height: 56 }}
          >
            All Collections
          </Button>
        </Box>
      </Paper>

      {/* Collections Table */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            💰 Cash Collections
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Showing {collections.length} of {total} items
          </Typography>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f9fafb' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Amount</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Last Payment</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Transaction #</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Balance After</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : collections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    No collections found
                  </TableCell>
                </TableRow>
              ) : (
                collections.map((collection, index) => (
                  <TableRow key={collection.id} hover>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>
                      <Link 
                        href={`/customers/${collection.customerId}`}
                        style={{ color: '#6366f1', textDecoration: 'none' }}
                      >
                        {collection.customer.name} 🔗
                      </Link>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold" color="success.main">
                        Rs {Number(collection.amount).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>{format(new Date(collection.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{collection.transactionNo}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={Number(collection.balanceAfter).toLocaleString()}
                        size="small"
                        color={Number(collection.balanceAfter) > 0 ? 'error' : 'success'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        component={Link}
                        href={`/customers/${collection.customerId}`}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(collection)}
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

      {/* Create Collection Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PaymentsIcon />
            Create Cash Collection
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Autocomplete
            options={customers}
            getOptionLabel={(option) => `${option.name} (Balance: Rs ${Number(option.balance).toLocaleString()})`}
            value={selectedCustomer}
            onChange={(_, newValue) => setSelectedCustomer(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Customer *"
                placeholder="Search customer..."
                fullWidth
                sx={{ mb: 2 }}
              />
            )}
          />

          {selectedCustomer && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">Customer Balance</Typography>
              <Typography variant="h5" fontWeight="bold" color={Number(selectedCustomer.balance) > 0 ? 'error.main' : 'success.main'}>
                Rs {Number(selectedCustomer.balance).toLocaleString()}
              </Typography>
            </Paper>
          )}

          <TextField
            fullWidth
            label="Amount *"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
            }}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Note (Optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setDialogOpen(false)} 
            variant="outlined" 
            sx={{ borderRadius: 2 }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateCollection}
            variant="contained"
            color="success"
            sx={{ borderRadius: 2 }}
            disabled={submitting || !selectedCustomer || !amount}
          >
            {submitting ? 'Recording...' : 'Record Collection'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteIcon />
            Delete Collection
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          {collectionToDelete && (
            <>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Are you sure you want to delete this collection?
              </Typography>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#fef2f2', borderRadius: 2, borderColor: '#fecaca' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Customer</Typography>
                  <Typography fontWeight="bold">{collectionToDelete.customer.name}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Amount</Typography>
                  <Typography fontWeight="bold" color="success.main">
                    Rs {Number(collectionToDelete.amount).toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Date</Typography>
                  <Typography>{format(new Date(collectionToDelete.date), 'MMM dd, yyyy')}</Typography>
                </Box>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fff7ed', borderRadius: 2, borderColor: '#fed7aa' }}>
                <Typography variant="body2" color="warning.dark">
                  ⚠️ This action will:
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  • Add <strong>Rs {Number(collectionToDelete.amount).toLocaleString()}</strong> back to customer's balance
                </Typography>
                <Typography variant="body2">
                  • Decrease <strong>Cash in Hand</strong> by the same amount
                </Typography>
              </Paper>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)} 
            variant="outlined" 
            sx={{ borderRadius: 2 }}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            sx={{ borderRadius: 2 }}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Collection'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

