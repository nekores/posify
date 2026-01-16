'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  ToggleButtonGroup,
  ToggleButton,
  Stack,
  Card,
  CardContent,
  Alert,
  Chip,
} from '@mui/material';
import {
  Delete,
  Add,
  ArrowBack,
  Save,
  Cancel,
  AttachMoney,
  AccountBalance,
  AssignmentReturn,
  Warning,
} from '@mui/icons-material';
import { Grid } from '@mui/material';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useAppStore } from '@/store/useStore';

interface Supplier {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
  salePrice: number;
  packSize: number;
  stock?: number;
}

interface ReturnItem {
  product: Product | null;
  unitsInPack: number;
  packQty: number;
  totalUnits: number;
  unitCost: number;
  packCost: number;
  total: number;
  reason: string;
}

export default function ReturnPurchasePage() {
  const { currencySymbol } = useAppStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showUnitDetails, setShowUnitDetails] = useState(false);

  // Form state
  const [returnDate, setReturnDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [loadingInvoice, setLoadingInvoice] = useState(true);
  const [comments, setComments] = useState('');
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [discount, setDiscount] = useState(0);

  // Payment state - for returns, supplier will give us money/credit
  const [paymentType, setPaymentType] = useState<'cash' | 'bank' | 'credit'>('cash');
  const [refundReceived, setRefundReceived] = useState(0);

  // Product search
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    fetchNextInvoiceNo();
  }, []);

  const fetchNextInvoiceNo = async () => {
    try {
      setLoadingInvoice(true);
      const res = await fetch('/api/purchases/next-invoice?type=return');
      const data = await res.json();
      if (data.invoiceNo) {
        setInvoiceNo(`RET-${data.invoiceNo}`);
      }
    } catch (error) {
      console.error('Error fetching invoice number:', error);
      const timestamp = Date.now().toString().slice(-8);
      setInvoiceNo(`RET-${timestamp}`);
    } finally {
      setLoadingInvoice(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers?limit=500');
      const data = await response.json();
      setSuppliers(data.data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products?limit=1000&includeZeroStock=true');
      const data = await response.json();
      setProducts(data.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleAddProduct = (product: Product | null) => {
    if (!product) return;

    // Check if product already exists
    const existingIndex = items.findIndex((item) => item.product?.id === product.id);
    if (existingIndex >= 0) {
      // Update quantity
      const newItems = [...items];
      newItems[existingIndex].packQty += 1;
      newItems[existingIndex].totalUnits = newItems[existingIndex].packQty * newItems[existingIndex].unitsInPack;
      newItems[existingIndex].total = newItems[existingIndex].totalUnits * newItems[existingIndex].unitCost;
      setItems(newItems);
    } else {
      // Add new item
      const packSize = product.packSize || 1;
      setItems([
        ...items,
        {
          product,
          unitsInPack: packSize,
          packQty: 1,
          totalUnits: packSize,
          unitCost: Number(product.costPrice) || 0,
          packCost: (Number(product.costPrice) || 0) * packSize,
          total: (Number(product.costPrice) || 0) * packSize,
          reason: '',
        },
      ]);
    }
    setProductSearch('');
  };

  const handleItemChange = (index: number, field: string, value: number | string) => {
    const newItems = [...items];
    const item = newItems[index];

    switch (field) {
      case 'unitsInPack':
        item.unitsInPack = Number(value);
        item.totalUnits = item.packQty * item.unitsInPack;
        item.packCost = item.unitCost * item.unitsInPack;
        item.total = item.totalUnits * item.unitCost;
        break;
      case 'packQty':
        item.packQty = Number(value);
        item.totalUnits = item.packQty * item.unitsInPack;
        item.total = item.totalUnits * item.unitCost;
        break;
      case 'unitCost':
        item.unitCost = Number(value);
        item.packCost = item.unitCost * item.unitsInPack;
        item.total = item.totalUnits * item.unitCost;
        break;
      case 'packCost':
        item.packCost = Number(value);
        item.unitCost = item.unitsInPack > 0 ? item.packCost / item.unitsInPack : 0;
        item.total = item.totalUnits * item.unitCost;
        break;
      case 'reason':
        item.reason = String(value);
        break;
    }

    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const netTotal = items.reduce((sum, item) => sum + item.total, 0);
  const grandTotal = netTotal - discount;
  const balanceToReceive = grandTotal - refundReceived;

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error('Please add at least one product to return');
      return;
    }

    if (!supplier) {
      toast.error('Please select a vendor');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          invoiceNo,
          date: returnDate,
          notes: comments,
          isReturn: true, // This marks it as a return
          items: items.map((item) => ({
            productId: item.product?.id,
            quantity: item.totalUnits,
            unitPrice: item.unitCost,
            discount: 0,
            total: item.total,
            reason: item.reason,
          })),
          discount,
          tax: 0,
          paid: paymentType === 'credit' ? 0 : refundReceived,
          paymentType,
        }),
      });

      if (response.ok) {
        toast.success('Purchase return created successfully! Stock and vendor balance updated.');
        router.push('/purchases');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create purchase return');
      }
    } catch (error) {
      console.error('Error creating purchase return:', error);
      toast.error('Failed to create purchase return');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton component={Link} href="/purchases">
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" fontWeight="bold" color="warning.main">
            🔄 Return Purchase to Vendor
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            color="warning"
            startIcon={<AssignmentReturn />}
            onClick={handleSubmit}
            disabled={loading || items.length === 0}
            sx={{ borderRadius: 2 }}
          >
            {loading ? 'Processing...' : 'Submit Return'}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<Cancel />}
            component={Link}
            href="/purchases"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
        </Stack>
      </Box>

      {/* Info Alert */}
      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography fontWeight="bold">Purchase Return</Typography>
        <Typography variant="body2">
          Returning items to vendor will: <strong>Decrease stock</strong>, <strong>Reduce vendor balance</strong> (credit to you).
        </Typography>
      </Alert>

      {/* Details Section */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, border: '2px solid', borderColor: 'warning.main' }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'warning.main' }}>
          — Return Details
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{xs:12, md:3}}>
            <TextField
              fullWidth
              type="date"
              label="Return Date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{xs:12, md:3}}>
            <Autocomplete
              options={suppliers}
              getOptionLabel={(option) => option.name}
              value={supplier}
              onChange={(_, value) => setSupplier(value)}
              renderInput={(params) => (
                <TextField {...params} label="Vendor *" placeholder="Select vendor..." />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ py: 1.5 }}>
                  <Box>
                    <Typography fontWeight="medium">{option.name}</Typography>
                    {option.phone && (
                      <Typography variant="caption" color="text.secondary">
                        📞 {option.phone}
                      </Typography>
                    )}
                    {Number(option.balance) > 0 && (
                      <Typography variant="caption" color="error.main" sx={{ ml: 1 }}>
                        | Balance: Rs {Number(option.balance).toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
              ListboxProps={{
                sx: { maxHeight: 300 }
              }}
            />
          </Grid>
          <Grid size={{xs:12, md:3}}>
            <TextField
              fullWidth
              label="Return Invoice No"
              value={loadingInvoice ? 'Generating...' : invoiceNo}
              InputProps={{
                readOnly: true,
                sx: { bgcolor: 'warning.lighter', fontWeight: 'bold' },
              }}
              helperText="Auto-generated return invoice"
            />
          </Grid>
          <Grid size={{xs:12, md:3}}>
            <TextField
              fullWidth
              label="Return Reason / Comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Why are you returning these items?"
              multiline
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Return Items */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'warning.main' }}>
          — Items to Return
        </Typography>

        {/* Product Search */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
          <Autocomplete
            options={products}
            getOptionLabel={(option) => `${option.name} (${option.sku})`}
            inputValue={productSearch}
            onInputChange={(_, value) => setProductSearch(value)}
            onChange={(_, value) => handleAddProduct(value)}
            sx={{ flex: 1 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search Product to Return"
                placeholder="Type name, code or SKU"
                color="warning"
              />
            )}
            renderOption={(props, option) => (
              <li {...props}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span>{option.name}</span>
                  <Typography variant="body2" color="text.secondary">
                    Cost: Rs {Number(option.costPrice).toLocaleString()} | Stock: {option.stock || 0}
                  </Typography>
                </Box>
              </li>
            )}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={showUnitDetails}
                onChange={(e) => setShowUnitDetails(e.target.checked)}
                color="warning"
              />
            }
            label="Show Unit Details"
          />
        </Box>

        {/* Items Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f59e0b' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Product</TableCell>
                {showUnitDetails && (
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Units/Pack</TableCell>
                )}
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Pack Qty</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Total Units</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Unit Cost</TableCell>
                {showUnitDetails && (
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Pack Cost</TableCell>
                )}
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Reason</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Remove</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showUnitDetails ? 10 : 8} align="center" sx={{ py: 3, color: 'warning.main' }}>
                    No items to return. Search and add products above.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => (
                  <TableRow key={index} hover sx={{ bgcolor: 'warning.lighter' }}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Box>
                        <Typography fontWeight="medium">{item.product?.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Current Stock: {item.product?.stock || 0}
                        </Typography>
                      </Box>
                    </TableCell>
                    {showUnitDetails && (
                      <TableCell align="center">
                        <TextField
                          size="small"
                          type="number"
                          value={item.unitsInPack}
                          onChange={(e) => handleItemChange(index, 'unitsInPack', e.target.value)}
                          sx={{ width: 70 }}
                          color="warning"
                        />
                      </TableCell>
                    )}
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={item.packQty}
                        onChange={(e) => handleItemChange(index, 'packQty', e.target.value)}
                        sx={{ width: 70 }}
                        color="warning"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={`${item.totalUnits} units`} 
                        color="warning" 
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={item.unitCost}
                        onChange={(e) => handleItemChange(index, 'unitCost', e.target.value)}
                        sx={{ width: 90 }}
                        color="warning"
                      />
                    </TableCell>
                    {showUnitDetails && (
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          value={item.packCost}
                          onChange={(e) => handleItemChange(index, 'packCost', e.target.value)}
                          sx={{ width: 90 }}
                          color="warning"
                        />
                      </TableCell>
                    )}
                    <TableCell align="right">
                      <Typography fontWeight="bold" color="warning.main">
                        {item.total.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={item.reason}
                        onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                        placeholder="Defective, wrong item..."
                        sx={{ width: 150 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton color="error" onClick={() => handleRemoveItem(index)}>
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Totals */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, minWidth: 300, bgcolor: 'warning.lighter' }}>
            <Grid container spacing={2}>
              <Grid size={{xs:6, sm:6, md:6}}>
                <Typography>Net Return Total:</Typography>
              </Grid>
              <Grid size={{xs:6, sm:6, md:6}}>
                <Typography fontWeight="bold" align="right">{netTotal.toLocaleString()}</Typography>
              </Grid>
              <Grid size={{xs:6, sm:6, md:6}}>
                <Typography>Discount (if any):</Typography>
              </Grid>
              <Grid size={{xs:6, sm:6, md:6}}>
                <TextField
                  size="small"
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  sx={{ width: '100%' }}
                  color="warning"
                />
              </Grid>
              <Grid size={{xs:12, sm:12, md:12}}>
                <Divider />
              </Grid>
              <Grid size={{xs:6, sm:6, md:6}}>
                <Typography variant="h6" fontWeight="bold">Total Credit</Typography>
              </Grid>
              <Grid size={{xs:6, sm:6, md:6}}>
                <Typography variant="h5" fontWeight="bold" align="right" color="warning.main">
                  {grandTotal.toLocaleString()}/=
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      </Paper>

      {/* Refund/Credit Details */}
      <Paper sx={{ p: 3, borderRadius: 2, border: '2px solid', borderColor: 'warning.main' }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'warning.main' }}>
          — Refund / Credit Details
        </Typography>
        <Grid container spacing={3}>
              <Grid size={{xs:12, md:4}}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>How will vendor settle this?</Typography>
            <ToggleButtonGroup
              value={paymentType}
              exclusive
              onChange={(_, value) => value && setPaymentType(value)}
              fullWidth
              color="warning"
            >
              <ToggleButton value="cash" sx={{ flex: 1 }}>
                <AttachMoney sx={{ mr: 1 }} /> Cash Refund
              </ToggleButton>
              <ToggleButton value="bank" sx={{ flex: 1 }} disabled>
                <AccountBalance sx={{ mr: 1 }} /> Bank Refund
              </ToggleButton>
              <ToggleButton value="credit" sx={{ flex: 1 }}>
                <Warning sx={{ mr: 1 }} /> Credit Note
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {paymentType === 'cash' && '💵 Vendor refunds cash → Cash in Hand ⬆️'}
              {paymentType === 'bank' && '🏦 Bank refund (Coming soon)'}
              {paymentType === 'credit' && '📋 Credit note against future purchases'}
            </Typography>
          </Grid>
          <Grid size={{xs:12, md:3}}>
            <TextField
              fullWidth
              type="number"
              label={paymentType === 'credit' ? 'Credit Amount' : 'Refund Received'}
              value={paymentType === 'credit' ? grandTotal : refundReceived}
              onChange={(e) => setRefundReceived(Number(e.target.value))}
              disabled={paymentType === 'credit'}
              InputProps={{
                startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>,
              }}
              color="warning"
            />
          </Grid>
          <Grid size={{xs:12, md:2}}>
            <Card 
              sx={{ 
                bgcolor: paymentType === 'credit' || balanceToReceive <= 0 ? 'success.light' : 'warning.light',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: balanceToReceive > 0 && paymentType !== 'credit' ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (balanceToReceive > 0 && paymentType !== 'credit') {
                  setRefundReceived(grandTotal);
                }
              }}
            >
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="body2">
                  {paymentType === 'credit' ? 'Credit Applied' : 'Pending Refund'}
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  Rs {paymentType === 'credit' ? grandTotal.toLocaleString() : balanceToReceive.toLocaleString()}
                </Typography>
                {balanceToReceive > 0 && paymentType !== 'credit' && (
                  <Typography variant="caption">Click to receive full</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{xs:12, md:3}}>
            <Alert severity="info" sx={{ height: '100%' }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Effects:</strong>
              </Typography>
              <Typography variant="body2">
                • Vendor balance: <strong>-Rs {grandTotal.toLocaleString()}</strong>
              </Typography>
              {paymentType === 'cash' && (
                <Typography variant="body2" color="success.main">
                  • Cash in Hand: <strong>+Rs {refundReceived.toLocaleString()}</strong>
                </Typography>
              )}
              {paymentType === 'credit' && (
                <Typography variant="body2" color="warning.main">
                  • Credit for future purchases
                </Typography>
              )}
            </Alert>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

