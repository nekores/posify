'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tabs,
  Tab,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Avatar,
  IconButton,
  Stack,
  InputAdornment,
} from '@mui/material';
import {
  ArrowBack,
  Edit as EditIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  AccountBalanceWallet as WalletIcon,
  Receipt as ReceiptIcon,
  Payments as PaymentsIcon,
  ShoppingCart,
  AttachMoney,
  Print as PrintIcon,
  FilterList,
  Add as AddIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Link from 'next/link';

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
}

interface LedgerEntry {
  id: string;
  date: string;
  saleId: string | null;
  debit: number;
  credit: number;
  balance: number;
  description: string;
  sale?: {
    invoiceNo: string;
  };
}

interface Sale {
  id: string;
  invoiceNo: string;
  date: string;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  due: number;
  status: string;
  isReturn: boolean;
}

interface SaleDetail {
  id: string;
  invoiceNo: string;
  date: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  due: number;
  status: string;
  isReturn: boolean;
  paymentType: string;
  notes: string | null;
  items: {
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
  }[];
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [totalSalesValue, setTotalSalesValue] = useState(0);

  // Collection dialog
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionAmount, setCollectionAmount] = useState('');
  const [collectionNote, setCollectionNote] = useState('');

  // Sale detail dialog
  const [saleDetailOpen, setSaleDetailOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);
  const [loadingSale, setLoadingSale] = useState(false);

  // Date filter
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    fetchCustomerData();
  }, [customerId]);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      // Fetch customer details
      const customerRes = await fetch(`/api/customers/${customerId}`);
      const customerData = await customerRes.json();
      setCustomer(customerData);

      // Fetch ledger (without date filter on initial load)
      const ledgerRes = await fetch(`/api/customers/${customerId}/ledger`);
      const ledgerData = await ledgerRes.json();
      setLedger(ledgerData.data || []);
      // Reset date filters on initial load
      setFromDate('');
      setToDate('');

      // Fetch sales
      const salesRes = await fetch(`/api/customers/${customerId}/sales`);
      const salesData = await salesRes.json();
      setSales(salesData.data || []);
      
      // Calculate total sales value
      const total = (salesData.data || []).reduce(
        (sum: number, s: Sale) => sum + Number(s.total),
        0
      );
      setTotalSalesValue(total);
    } catch (error) {
      console.error('Error fetching customer data:', error);
      toast.error('Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!collectionAmount || Number(collectionAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const res = await fetch(`/api/customers/${customerId}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(collectionAmount),
          note: collectionNote,
        }),
      });

      if (!res.ok) throw new Error('Failed to create collection');

      toast.success('Collection recorded successfully');
      setCollectionOpen(false);
      setCollectionAmount('');
      setCollectionNote('');
      fetchCustomerData();
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error('Failed to record collection');
    }
  };

  const handleViewSaleDetail = async (saleId: string) => {
    setLoadingSale(true);
    setSaleDetailOpen(true);
    try {
      const res = await fetch(`/api/sales/${saleId}`);
      if (!res.ok) throw new Error('Failed to fetch sale');
      const data = await res.json();
      setSelectedSale(data);
    } catch (error) {
      console.error('Error fetching sale:', error);
      toast.error('Failed to load sale details');
      setSaleDetailOpen(false);
    } finally {
      setLoadingSale(false);
    }
  };

  const handleApplyFilter = async () => {
    try {
      let url = `/api/customers/${customerId}/ledger`;
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (params.toString()) url += `?${params.toString()}`;
      
      const ledgerRes = await fetch(url);
      const ledgerData = await ledgerRes.json();
      setLedger(ledgerData.data || []);
      toast.success('Filter applied');
    } catch (error) {
      console.error('Error filtering ledger:', error);
      toast.error('Failed to filter ledger');
    }
  };

  // Calculate running balance for ledger
  const ledgerWithRunningBalance = ledger.reduce((acc: any[], entry, index) => {
    const prevBalance = index > 0 ? acc[index - 1].runningBalance : Number(customer?.openingBalance || 0);
    const runningBalance = prevBalance + Number(entry.debit) - Number(entry.credit);
    return [...acc, { ...entry, runningBalance }];
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!customer) {
    return (
      <Box sx={{ textAlign: 'center', py: 5 }}>
        <Typography variant="h6">Customer not found</Typography>
        <Button component={Link} href="/customers" sx={{ mt: 2 }}>
          Back to Customers
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton component={Link} href="/customers">
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" fontWeight="bold">
            {customer.name}
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            sx={{ borderRadius: 2 }}
          >
            Update
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<PaymentsIcon />}
            onClick={() => setCollectionOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Cash Collection
          </Button>
          <Button
            variant="outlined"
            component={Link}
            href="/customers"
            sx={{ borderRadius: 2 }}
          >
            Back to Customers
          </Button>
        </Stack>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ 
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', 
          color: 'white',
          borderRadius: 3,
          flex: '1 1 200px',
          minWidth: 200
        }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <AttachMoney sx={{ fontSize: 48, opacity: 0.8, mb: 1 }} />
            <Typography variant="body1" sx={{ opacity: 0.9 }}>TOTAL BALANCE</Typography>
            <Typography variant="h2" fontWeight="bold">
              {Number(customer.balance).toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ 
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
          color: 'white',
          borderRadius: 3,
          flex: '1 1 200px',
          minWidth: 200
        }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <ShoppingCart sx={{ fontSize: 48, opacity: 0.8, mb: 1 }} />
            <Typography variant="body1" sx={{ opacity: 0.9 }}>TOTAL WORTH OF SALES</Typography>
            <Typography variant="h2" fontWeight="bold">
              {totalSalesValue.toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Customer Information Card */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
           Customer Information
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          <Box sx={{ minWidth: 150 }}>
            <Typography variant="body2" color="text.secondary">NAME</Typography>
            <Typography fontWeight="bold">{customer.name}</Typography>
          </Box>
          <Box sx={{ minWidth: 150 }}>
            <Typography variant="body2" color="text.secondary">BUSINESS NAME</Typography>
            <Typography fontWeight="medium">{customer.businessName || '-'}</Typography>
          </Box>
          <Box sx={{ minWidth: 120 }}>
            <Typography variant="body2" color="text.secondary">PHONE NO</Typography>
            <Typography fontWeight="medium">{customer.phone || '-'}</Typography>
          </Box>
          <Box sx={{ minWidth: 120 }}>
            <Typography variant="body2" color="text.secondary">MOBILE NO</Typography>
            <Typography fontWeight="medium">{customer.mobile || '-'}</Typography>
          </Box>
          <Box sx={{ minWidth: 120 }}>
            <Typography variant="body2" color="text.secondary">CUSTOMER TYPE</Typography>
            <Chip label={customer.customerType?.name || 'Walk In'} size="small" color="primary" />
          </Box>
          <Box sx={{ minWidth: 120 }}>
            <Typography variant="body2" color="text.secondary">TOWN NAME</Typography>
            <Typography fontWeight="medium">{customer.city || '-'}</Typography>
          </Box>
          <Box sx={{ minWidth: 200, flex: 1 }}>
            <Typography variant="body2" color="text.secondary">ADDRESS</Typography>
            <Typography fontWeight="medium">{customer.address || '-'}</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Tabs 
          value={tabValue} 
          onChange={(_, v) => setTabValue(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#f5f5f5' }}
        >
          <Tab label="📋 Customer Ledger" />
          <Tab label="🛒 Recent Sales" />
        </Tabs>

        {/* Ledger Tab */}
        {tabValue === 0 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
              <TextField
                type="date"
                size="small"
                label="From Date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 150 }}
              />
              <TextField
                type="date"
                size="small"
                label="To Date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 150 }}
              />
              <Button 
                variant="contained" 
                startIcon={<FilterList />} 
                onClick={handleApplyFilter}
                sx={{ borderRadius: 2 }}
              >
                Apply
              </Button>
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>DATE</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>BILL NO</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>COMMENTS</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">DEBIT</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">CREDIT</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">BALANCE</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ledgerWithRunningBalance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                        No ledger entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {ledgerWithRunningBalance.map((entry, index) => (
                        <TableRow key={entry.id} hover>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{format(new Date(entry.date), 'yyyy-MM-dd')}</TableCell>
                          <TableCell>
                            {entry.saleId && entry.sale?.invoiceNo ? (
                              <Typography
                                component="span"
                                sx={{ 
                                  color: 'primary.main', 
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  '&:hover': { color: 'primary.dark' }
                                }}
                                onClick={() => handleViewSaleDetail(entry.saleId!)}
                              >
                                {entry.sale.invoiceNo}
                              </Typography>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{entry.description}</TableCell>
                          <TableCell align="right">
                            {Number(entry.debit) > 0 ? (
                              <Typography color="error.main" fontWeight="medium">
                                {Number(entry.debit).toLocaleString()}
                              </Typography>
                            ) : '-'}
                          </TableCell>
                          <TableCell align="right">
                            {Number(entry.credit) > 0 ? (
                              <Typography color="success.main" fontWeight="medium">
                                {Number(entry.credit).toLocaleString()}
                              </Typography>
                            ) : '-'}
                          </TableCell>
                          <TableCell align="right">
                            <Typography 
                              fontWeight="bold" 
                              color={entry.runningBalance > 0 ? 'error.main' : 'success.main'}
                            >
                              {entry.runningBalance.toLocaleString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                        <TableCell colSpan={4} align="right">
                          <Typography fontWeight="bold">Total:</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="error.main">
                            {ledger.reduce((sum, e) => sum + Number(e.debit), 0).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="success.main">
                            {ledger.reduce((sum, e) => sum + Number(e.credit), 0).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {ledgerWithRunningBalance.length > 0 && (
                            <Typography 
                              fontWeight="bold" 
                              color={ledgerWithRunningBalance[ledgerWithRunningBalance.length - 1].runningBalance > 0 ? 'error.main' : 'success.main'}
                            >
                              {ledgerWithRunningBalance[ledgerWithRunningBalance.length - 1].runningBalance.toLocaleString()}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Recent Sales Tab */}
        {tabValue === 1 && (
          <Box sx={{ p: 3 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>DATE</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>BILL NO</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">NET TOTAL</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">PAID</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">REMAINING</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">DISCOUNT</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">GRAND TOTAL</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>RETURN</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">ACTIONS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 5 }}>
                        No sales found
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {sales.map((sale, index) => (
                        <TableRow key={sale.id} hover>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{format(new Date(sale.date), 'yyyy-MM-dd')}</TableCell>
                          <TableCell>
                            <Typography
                              component="span"
                              sx={{ 
                                color: 'primary.main', 
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                '&:hover': { color: 'primary.dark' }
                              }}
                              onClick={() => handleViewSaleDetail(sale.id)}
                            >
                              {sale.invoiceNo}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{Number(sale.subtotal).toLocaleString()}</TableCell>
                          <TableCell align="right">
                            <Typography color="success.main">{Number(sale.paid).toLocaleString()}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography color={Number(sale.due) > 0 ? 'error.main' : 'inherit'}>
                              {Number(sale.due).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{Number(sale.discount).toLocaleString()}</TableCell>
                          <TableCell align="right">
                            <Typography fontWeight="bold">{Number(sale.total).toLocaleString()}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={sale.isReturn ? 'Yes' : 'No'} 
                              size="small" 
                              color={sale.isReturn ? 'warning' : 'default'}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<PrintIcon />}
                              sx={{ borderRadius: 1 }}
                            >
                              Invoice
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                        <TableCell colSpan={3} align="right">
                          <Typography fontWeight="bold">Total:</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold">
                            {sales.reduce((sum, s) => sum + Number(s.subtotal), 0).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="success.main">
                            {sales.reduce((sum, s) => sum + Number(s.paid), 0).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="error.main">
                            {sales.reduce((sum, s) => sum + Number(s.due), 0).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold">
                            {sales.reduce((sum, s) => sum + Number(s.discount), 0).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold">
                            {sales.reduce((sum, s) => sum + Number(s.total), 0).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>

      {/* Collection Dialog */}
      <Dialog 
        open={collectionOpen} 
        onClose={() => setCollectionOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PaymentsIcon />
            Record Cash Collection
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Recording payment from: <strong>{customer.name}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Current Balance: <strong style={{ color: '#ef4444' }}>Rs {Number(customer.balance).toLocaleString()}</strong>
          </Typography>

          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={collectionAmount}
            onChange={(e) => setCollectionAmount(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
            }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Note (Optional)"
            value={collectionNote}
            onChange={(e) => setCollectionNote(e.target.value)}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCollectionOpen(false)} variant="outlined" sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateCollection} 
            variant="contained" 
            color="success"
            sx={{ borderRadius: 2 }}
          >
            Record Collection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sale Detail Dialog */}
      <Dialog 
        open={saleDetailOpen} 
        onClose={() => {
          setSaleDetailOpen(false);
          setSelectedSale(null);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: selectedSale?.isReturn ? 'warning.main' : 'primary.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptIcon />
            {selectedSale?.isReturn ? 'Return' : 'Sale'} Details - {selectedSale?.invoiceNo || ''}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {loadingSale ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <Typography>Loading...</Typography>
            </Box>
          ) : selectedSale ? (
            <Box>
              {/* Sale Info */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                <Box sx={{ minWidth: 120 }}>
                  <Typography variant="caption" color="text.secondary">Invoice No</Typography>
                  <Typography fontWeight="bold">{selectedSale.invoiceNo}</Typography>
                </Box>
                <Box sx={{ minWidth: 120 }}>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography fontWeight="bold">{format(new Date(selectedSale.date), 'dd MMM yyyy')}</Typography>
                </Box>
                <Box sx={{ minWidth: 100 }}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box>
                    <Chip 
                      label={selectedSale.status} 
                      size="small" 
                      color={selectedSale.status === 'completed' ? 'success' : selectedSale.status === 'pending' ? 'warning' : 'default'}
                    />
                  </Box>
                </Box>
                <Box sx={{ minWidth: 100 }}>
                  <Typography variant="caption" color="text.secondary">Payment Type</Typography>
                  <Typography fontWeight="bold" sx={{ textTransform: 'capitalize' }}>{selectedSale.paymentType || 'N/A'}</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Items Table */}
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>Items</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell><strong>#</strong></TableCell>
                      <TableCell><strong>Product</strong></TableCell>
                      <TableCell><strong>SKU</strong></TableCell>
                      <TableCell align="right"><strong>Qty</strong></TableCell>
                      <TableCell align="right"><strong>Price</strong></TableCell>
                      <TableCell align="right"><strong>Discount</strong></TableCell>
                      <TableCell align="right"><strong>Total</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedSale.items?.map((item, index) => (
                      <TableRow key={item.id} hover>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{item.product?.name || 'Unknown'}</TableCell>
                        <TableCell>{item.product?.sku || '-'}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">Rs {Number(item.unitPrice).toLocaleString()}</TableCell>
                        <TableCell align="right">{Number(item.discount) > 0 ? `Rs ${Number(item.discount).toLocaleString()}` : '-'}</TableCell>
                        <TableCell align="right">Rs {Number(item.total).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Summary */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Box sx={{ width: 250 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                    <Typography>Rs {Number(selectedSale.subtotal).toLocaleString()}</Typography>
                  </Box>
                  {Number(selectedSale.discount) > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">Discount:</Typography>
                      <Typography color="error.main">-Rs {Number(selectedSale.discount).toLocaleString()}</Typography>
                    </Box>
                  )}
                  {Number(selectedSale.tax) > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">Tax:</Typography>
                      <Typography>Rs {Number(selectedSale.tax).toLocaleString()}</Typography>
                    </Box>
                  )}
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography fontWeight="bold">Total:</Typography>
                    <Typography fontWeight="bold">Rs {Number(selectedSale.total).toLocaleString()}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">Paid:</Typography>
                    <Typography color="success.main">Rs {Number(selectedSale.paid).toLocaleString()}</Typography>
                  </Box>
                  {Number(selectedSale.due) > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Due:</Typography>
                      <Typography color="error.main" fontWeight="bold">Rs {Number(selectedSale.due).toLocaleString()}</Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              {selectedSale.notes && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">Notes</Typography>
                  <Typography>{selectedSale.notes}</Typography>
                </Box>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => {
              setSaleDetailOpen(false);
              setSelectedSale(null);
            }} 
            variant="outlined" 
            sx={{ borderRadius: 2 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

