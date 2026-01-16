'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Autocomplete,
  InputAdornment,
  Card,
  CardContent,
  Alert,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
} from '@mui/material';
import {
  ArrowBack,
  Payment,
  AccountBalance,
  AttachMoney,
  LocalShipping,
  Receipt,
} from '@mui/icons-material';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Grid } from '@mui/material';
import { useAppStore } from '@/store/useStore';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
}

interface Purchase {
  id: string;
  invoiceNo: string;
  date: string;
  total: number;
  paid: number;
  due: number;
  isReturn: boolean;
}

export default function PaySupplierPage() {
  const { currencySymbol } = useAppStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedSupplierId = searchParams.get('supplierId');

  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierPurchases, setSupplierPurchases] = useState<Purchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);

  // Payment form
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (preSelectedSupplierId && suppliers.length > 0) {
      const supplier = suppliers.find(s => s.id === preSelectedSupplierId);
      if (supplier) {
        setSelectedSupplier(supplier);
        setPaymentAmount(Number(supplier.balance));
      }
    }
  }, [preSelectedSupplierId, suppliers]);

  useEffect(() => {
    if (selectedSupplier) {
      fetchSupplierPurchases(selectedSupplier.id);
    } else {
      setSupplierPurchases([]);
    }
  }, [selectedSupplier]);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers?limit=500');
      const data = await response.json();
      // Filter suppliers with balance > 0
      const suppliersWithBalance = (data.data || []).filter(
        (s: Supplier) => Number(s.balance) > 0
      );
      setSuppliers(suppliersWithBalance);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchSupplierPurchases = async (supplierId: string) => {
    try {
      setLoadingPurchases(true);
      const response = await fetch(`/api/suppliers/${supplierId}/purchases?unpaidOnly=true`);
      const data = await response.json();
      setSupplierPurchases(data.data || []);
    } catch (error) {
      console.error('Error fetching supplier purchases:', error);
    } finally {
      setLoadingPurchases(false);
    }
  };

  const handleSupplierSelect = (supplier: Supplier | null) => {
    setSelectedSupplier(supplier);
    if (supplier) {
      setPaymentAmount(Number(supplier.balance));
    } else {
      setPaymentAmount(0);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSupplier) {
      toast.error('Please select a vendor');
      return;
    }

    if (paymentAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (paymentAmount > Number(selectedSupplier.balance)) {
      toast.error('Payment amount cannot exceed the outstanding balance');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/suppliers/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplier.id,
          amount: paymentAmount,
          paymentType: 'cash', // Currently only cash
          reference,
          notes,
          date: paymentDate,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Payment of Rs ${paymentAmount.toLocaleString()} recorded successfully!`);
        router.push('/suppliers');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const balanceAfterPayment = selectedSupplier 
    ? Number(selectedSupplier.balance) - paymentAmount 
    : 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton component={Link} href="/suppliers">
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" fontWeight="bold">
           Pay Vendor
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column - Payment Form */}
        <Grid size={{xs:12, md:12}}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Payment color="warning" /> Payment Details
            </Typography>

            <Grid container spacing={3}>
              {/* Vendor Selection */}
              <Grid size={{xs:12, sm:12, md:12}}>
                <Autocomplete
                  options={suppliers}
                  getOptionLabel={(option) => `${option.name} - Balance: Rs ${Number(option.balance).toLocaleString()}`}
                  value={selectedSupplier}
                  onChange={(_, value) => handleSupplierSelect(value)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Vendor *"
                      placeholder="Search vendor with balance..."
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <Box>
                          <Typography fontWeight="medium">{option.name}</Typography>
                          {option.phone && (
                            <Typography variant="caption" color="text.secondary">
                              📞 {option.phone}
                            </Typography>
                          )}
                        </Box>
                        <Chip
                          label={`Rs ${Number(option.balance).toLocaleString()}`}
                          color="error"
                          size="small"
                        />
                      </Box>
                    </Box>
                  )}
                />
              </Grid>

              {/* Payment Date */}
              <Grid size={{xs:12, sm:6, md:6}}>
                <TextField
                  fullWidth
                  type="date"
                  label="Payment Date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Payment Amount */}
                <Grid size={{xs:12, sm:6, md:6}}>
                <TextField
                  fullWidth
                  type="number"
                  label="Payment Amount *"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>,
                  }}
                  helperText={selectedSupplier ? `Max: Rs ${Number(selectedSupplier.balance).toLocaleString()}` : ''}
                />
              </Grid>

              {/* Reference */}
              <Grid size={{xs:12, sm:6, md:6}}>
                <TextField
                  fullWidth
                  label="Reference / Cheque No"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Optional reference"
                />
              </Grid>

              {/* Notes */}
              <Grid size={{xs:12, sm:6, md:6}}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </Grid>
            </Grid>

            {/* Payment Summary */}
            {selectedSupplier && (
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid size={{xs:4, sm:4, md:4}}>
                    <Card sx={{ bgcolor: 'error.light', color: 'error.contrastText' }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2">Current Balance</Typography>
                        <Typography variant="h6" fontWeight="bold">
                          Rs {Number(selectedSupplier.balance).toLocaleString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid size={{xs:4, sm:4, md:4}}>
                    <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2">Payment</Typography>
                        <Typography variant="h6" fontWeight="bold">
                          - Rs {paymentAmount.toLocaleString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid size={{xs:4, sm:4, md:4}}>
                    <Card sx={{ bgcolor: balanceAfterPayment <= 0 ? 'success.light' : 'info.light' }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2">After Payment</Typography>
                        <Typography variant="h6" fontWeight="bold">
                          Rs {balanceAfterPayment.toLocaleString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Effect Alert */}
            {paymentAmount > 0 && (
              <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  <strong>Effects of this payment:</strong>
                </Typography>
                <Typography variant="body2">
                  • Supplier Balance: <strong>-Rs {paymentAmount.toLocaleString()}</strong>
                </Typography>
                <Typography variant="body2">
                  • Cash in Hand: <strong>-Rs {paymentAmount.toLocaleString()}</strong>
                </Typography>
              </Alert>
            )}

            {/* Submit Button */}
            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                color="warning"
                size="large"
                startIcon={<Payment />}
                onClick={handleSubmit}
                disabled={loading || !selectedSupplier || paymentAmount <= 0}
                sx={{ flex: 1 }}
              >
                {loading ? 'Processing...' : `Pay Rs ${paymentAmount.toLocaleString()}`}
              </Button>
              <Button
                variant="outlined"
                component={Link}
                href="/suppliers"
              >
                Cancel
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Right Column - Supplier Info & Pending Invoices */}
        <Grid size={{xs:12, md:5}}>
          {/* Supplier Info Card */}
          {selectedSupplier && (
            <Card sx={{ mb: 3, bgcolor: 'primary.light', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <LocalShipping sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      {selectedSupplier.name}
                    </Typography>
                    {selectedSupplier.phone && (
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        📞 {selectedSupplier.phone}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Outstanding Balance:</Typography>
                  <Typography variant="h5" fontWeight="bold">
                    Rs {Number(selectedSupplier.balance).toLocaleString()}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Pending Invoices */}
          {selectedSupplier && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Receipt color="action" /> Pending Invoices
              </Typography>
              
              {loadingPurchases ? (
                <Typography color="text.secondary">Loading...</Typography>
              ) : supplierPurchases.length === 0 ? (
                <Alert severity="info">No pending invoices found</Alert>
              ) : (
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Due</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {supplierPurchases.map((purchase) => (
                        <TableRow key={purchase.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {purchase.invoiceNo}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {format(new Date(purchase.date), 'dd/MM/yyyy')}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="error.main" fontWeight="bold">
                              Rs {Number(purchase.due).toLocaleString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          )}

          {/* Quick Pay Buttons */}
          {selectedSupplier && Number(selectedSupplier.balance) > 0 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Quick Amount:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setPaymentAmount(Number(selectedSupplier.balance))}
                >
                  Full: Rs {Number(selectedSupplier.balance).toLocaleString()}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setPaymentAmount(Math.round(Number(selectedSupplier.balance) / 2))}
                >
                  Half: Rs {Math.round(Number(selectedSupplier.balance) / 2).toLocaleString()}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setPaymentAmount(10000)}
                >
                  Rs 10,000
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setPaymentAmount(50000)}
                >
                  Rs 50,000
                </Button>
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

