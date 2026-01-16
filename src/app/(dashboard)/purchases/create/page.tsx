'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
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
} from '@mui/material';
import {
  Delete,
  Add,
  ArrowBack,
  Save,
  Cancel,
  AttachMoney,
  AccountBalance,
  CreditCard,
} from '@mui/icons-material';
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
  taxRate: number;
  stock?: number;
}

interface PurchaseItem {
  product: Product | null;
  unitsInPack: number;
  packQty: number;
  totalUnits: number;
  unitCost: number;
  packCost: number;
  freightIn: number;
  tax: number;
  total: number;
  unitSalePrice: number;
  packSalePrice: number;
}

export default function CreatePurchasePage() {
  const { currencySymbol } = useAppStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showUnitDetails, setShowUnitDetails] = useState(false);

  // Form state
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [loadingInvoice, setLoadingInvoice] = useState(true);
  const [comments, setComments] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [discount, setDiscount] = useState(0);

  // Payment state
  const [paymentType, setPaymentType] = useState<'cash' | 'bank' | 'credit'>('cash');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [cashPaid, setCashPaid] = useState(0);

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
      const res = await fetch('/api/purchases/next-invoice');
      const data = await res.json();
      if (data.invoiceNo) {
        setInvoiceNo(data.invoiceNo);
      }
    } catch (error) {
      console.error('Error fetching invoice number:', error);
      // Generate a fallback invoice number
      const timestamp = Date.now().toString().slice(-8);
      setInvoiceNo(`PUR-${timestamp}`);
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
      const response = await fetch('/api/products?limit=1000');
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
      // Update quantity and recalculate tax
      const newItems = [...items];
      newItems[existingIndex].packQty += 1;
      newItems[existingIndex].totalUnits = newItems[existingIndex].packQty * newItems[existingIndex].unitsInPack;
      const itemSubtotal = newItems[existingIndex].totalUnits * newItems[existingIndex].unitCost + newItems[existingIndex].freightIn;
      const taxRate = Number(product.taxRate) || 0;
      newItems[existingIndex].tax = (itemSubtotal * taxRate) / 100;
      newItems[existingIndex].total = itemSubtotal + newItems[existingIndex].tax;
      setItems(newItems);
    } else {
      // Add new item
      const packSize = product.packSize || 1;
      const unitCost = Number(product.costPrice) || 0;
      const totalUnits = packSize;
      const itemSubtotal = unitCost * totalUnits;
      const taxRate = Number(product.taxRate) || 0;
      const itemTax = (itemSubtotal * taxRate) / 100;
      
      setItems([
        ...items,
        {
          product,
          unitsInPack: packSize,
          packQty: 1,
          totalUnits: packSize,
          unitCost: unitCost,
          packCost: unitCost * packSize,
          freightIn: 0,
          tax: itemTax,
          total: itemSubtotal + itemTax,
          unitSalePrice: Number(product.salePrice) || 0,
          packSalePrice: (Number(product.salePrice) || 0) * packSize,
        },
      ]);
    }
    setProductSearch('');
  };

  const handleItemChange = (index: number, field: string, value: number) => {
    const newItems = [...items];
    const item = newItems[index];

    switch (field) {
      case 'unitsInPack':
        item.unitsInPack = value;
        item.totalUnits = item.packQty * value;
        item.packCost = item.unitCost * value;
        // Recalculate tax and total
        const itemSubtotal4 = item.totalUnits * item.unitCost + item.freightIn;
        const taxRate4 = item.product?.taxRate || 0;
        item.tax = (itemSubtotal4 * taxRate4) / 100;
        item.total = itemSubtotal4 + item.tax;
        item.packSalePrice = item.unitSalePrice * value;
        break;
      case 'packQty':
        item.packQty = value;
        item.totalUnits = value * item.unitsInPack;
        // Recalculate tax and total
        const itemSubtotal3 = item.totalUnits * item.unitCost + item.freightIn;
        const taxRate3 = item.product?.taxRate || 0;
        item.tax = (itemSubtotal3 * taxRate3) / 100;
        item.total = itemSubtotal3 + item.tax;
        break;
      case 'unitCost':
        item.unitCost = value;
        item.packCost = value * item.unitsInPack;
        // Recalculate tax and total
        const itemSubtotal1 = item.totalUnits * value + item.freightIn;
        const taxRate1 = item.product?.taxRate || 0;
        item.tax = (itemSubtotal1 * taxRate1) / 100;
        item.total = itemSubtotal1 + item.tax;
        break;
      case 'packCost':
        item.packCost = value;
        item.unitCost = item.unitsInPack > 0 ? value / item.unitsInPack : 0;
        // Recalculate tax and total
        const itemSubtotal2 = item.totalUnits * item.unitCost + item.freightIn;
        const taxRate2 = item.product?.taxRate || 0;
        item.tax = (itemSubtotal2 * taxRate2) / 100;
        item.total = itemSubtotal2 + item.tax;
        break;
      case 'freightIn':
        item.freightIn = value;
        // Recalculate tax and total
        const itemSubtotal = item.totalUnits * item.unitCost + value;
        const taxRate = item.product?.taxRate || 0;
        item.tax = (itemSubtotal * taxRate) / 100;
        item.total = itemSubtotal + item.tax;
        break;
      case 'unitSalePrice':
        item.unitSalePrice = value;
        item.packSalePrice = value * item.unitsInPack;
        break;
      case 'packSalePrice':
        item.packSalePrice = value;
        item.unitSalePrice = item.unitsInPack > 0 ? value / item.unitsInPack : 0;
        break;
    }

    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const netTotal = items.reduce((sum, item) => {
    // Net total is subtotal (before tax)
    const itemSubtotal = item.totalUnits * item.unitCost + item.freightIn;
    return sum + itemSubtotal;
  }, 0);
  const totalTax = items.reduce((sum, item) => sum + item.tax, 0);
  const grandTotal = netTotal - discount + totalTax;
  const balance = paymentType === 'credit' ? grandTotal : grandTotal - cashPaid;

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error('Please add at least one product');
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
          invoiceNo: invoiceNo, // Send the pre-generated invoice number
          date: purchaseDate,
          notes: comments,
            items: items.map((item) => ({
            productId: item.product?.id,
            quantity: item.totalUnits,
            unitPrice: item.unitCost,
            discount: 0,
            tax: item.tax,
            freightIn: item.freightIn,
            total: item.total,
            salePrice: item.unitSalePrice, // Update product sale price
          })),
          discount,
          tax: totalTax,
          paid: paymentType === 'credit' ? 0 : cashPaid,
          paymentType,
          paymentDate,
        }),
      });

      if (response.ok) {
        toast.success('Purchase created successfully!');
        router.push('/purchases');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create purchase');
      }
    } catch (error) {
      console.error('Error creating purchase:', error);
      toast.error('Failed to create purchase');
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
          <Typography variant="h4" fontWeight="bold">
            Create Purchase
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            color="success"
            startIcon={<Save />}
            onClick={handleSubmit}
            disabled={loading || items.length === 0}
            sx={{ borderRadius: 2 }}
          >
            {loading ? 'Saving...' : 'Submit Purchase'}
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

      {/* Details Section */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
          — Details
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              type="date"
              label="Date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Autocomplete
              options={suppliers}
              getOptionLabel={(option) => option.name}
              value={supplier}
              onChange={(_, value) => setSupplier(value)}
              renderInput={(params) => (
                <TextField {...params} label="Vendor" placeholder="Select vendor..." />
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
              sx={{
                '& .MuiAutocomplete-listbox': {
                  '& li': {
                    minHeight: 48,
                  }
                }
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="Invoice No"
              value={loadingInvoice ? 'Generating...' : invoiceNo}
              InputProps={{
                readOnly: true,
                sx: { bgcolor: '#f5f5f5', fontWeight: 'bold' },
              }}
              helperText="Auto-generated unique number"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="Comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Comments"
              multiline
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Purchase Invoice Details */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
          — Purchase Invoice Details
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
                label="Search Product"
                placeholder="Type name, code or SKU"
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
              />
            }
            label="Show Unit Details"
          />
        </Box>

        {/* Items Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#6366f1' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Product</TableCell>
                {showUnitDetails && (
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Units in Pack</TableCell>
                )}
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Pack Qty</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Total Units</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Unit Cost</TableCell>
                {showUnitDetails && (
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Pack Cost</TableCell>
                )}
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Freight In</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Tax</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">U-Sale Price</TableCell>
                {showUnitDetails && (
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">P-Sale Price</TableCell>
                )}
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showUnitDetails ? 13 : 10} align="center" sx={{ py: 3, color: 'error.main' }}>
                    No items to display.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => (
                  <TableRow key={index} hover>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{item.product?.name}</TableCell>
                    {showUnitDetails && (
                      <TableCell align="center">
                        <TextField
                          size="small"
                          type="number"
                          value={item.unitsInPack}
                          onChange={(e) => handleItemChange(index, 'unitsInPack', Number(e.target.value))}
                          sx={{ width: 70 }}
                        />
                      </TableCell>
                    )}
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={item.packQty}
                        onChange={(e) => handleItemChange(index, 'packQty', Number(e.target.value))}
                        sx={{ width: 70 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography fontWeight="medium">{item.totalUnits}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={item.unitCost}
                        onChange={(e) => handleItemChange(index, 'unitCost', Number(e.target.value))}
                        sx={{ width: 90 }}
                      />
                    </TableCell>
                    {showUnitDetails && (
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          value={item.packCost}
                          onChange={(e) => handleItemChange(index, 'packCost', Number(e.target.value))}
                          sx={{ width: 90 }}
                        />
                      </TableCell>
                    )}
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={item.freightIn}
                        onChange={(e) => handleItemChange(index, 'freightIn', Number(e.target.value))}
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography color="primary" fontWeight="medium">
                        {item.tax.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold">{item.total.toLocaleString()}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={item.unitSalePrice}
                        onChange={(e) => handleItemChange(index, 'unitSalePrice', Number(e.target.value))}
                        sx={{ width: 90 }}
                      />
                    </TableCell>
                    {showUnitDetails && (
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          value={item.packSalePrice}
                          onChange={(e) => handleItemChange(index, 'packSalePrice', Number(e.target.value))}
                          sx={{ width: 90 }}
                        />
                      </TableCell>
                    )}
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
          <Paper variant="outlined" sx={{ p: 2, minWidth: 300 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Typography>Net Total:</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography fontWeight="bold" align="right">{netTotal.toLocaleString()}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography>Tax:</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography fontWeight="bold" align="right" color="primary">
                  {totalTax.toFixed(2)}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography>Discount:</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  size="small"
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  sx={{ width: '100%' }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Divider />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="h6" fontWeight="bold">Grand Total</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="h5" fontWeight="bold" align="right" color="primary.main">
                  {grandTotal.toLocaleString()}/=
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      </Paper>

      {/* Payment Details */}
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
          — Payment Details
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Payment Type</Typography>
            <ToggleButtonGroup
              value={paymentType}
              exclusive
              onChange={(_, value) => value && setPaymentType(value)}
              fullWidth
            >
              <ToggleButton value="cash" sx={{ flex: 1 }}>
                <AttachMoney sx={{ mr: 1 }} /> Cash
              </ToggleButton>
              <ToggleButton value="bank" sx={{ flex: 1 }} disabled>
                <AccountBalance sx={{ mr: 1 }} /> Bank
              </ToggleButton>
              <ToggleButton value="credit" sx={{ flex: 1 }}>
                <CreditCard sx={{ mr: 1 }} /> Credit
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {paymentType === 'cash' && '💵 Payment from Cash in Hand ⬇️'}
              {paymentType === 'bank' && '🏦 Bank payment (Coming soon)'}
              {paymentType === 'credit' && '📋 Payable to vendor (on credit)'}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              type="date"
              label="Payment Date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              disabled={paymentType === 'credit'}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth
              type="number"
              label={paymentType === 'credit' ? 'Paid (Credit)' : 'Cash Paid'}
              value={paymentType === 'credit' ? 0 : cashPaid}
              onChange={(e) => setCashPaid(Number(e.target.value))}
              disabled={paymentType === 'credit'}
              InputProps={{
                startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>,
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Card 
              sx={{ 
                bgcolor: balance > 0 ? 'error.light' : 'success.light',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: balance > 0 ? 'pointer' : 'default',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': balance > 0 ? {
                  transform: 'scale(1.02)',
                  boxShadow: 3,
                } : {},
              }}
              onClick={() => {
                if (balance > 0 && paymentType !== 'credit') {
                  setCashPaid(grandTotal);
                  toast.success('Amount filled! Click to pay full amount.');
                }
              }}
              title={balance > 0 ? 'Click to pay full amount' : ''}
            >
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="body2">Balance</Typography>
                <Typography variant="h5" fontWeight="bold">
                  Rs {balance.toLocaleString()}
                </Typography>
                {balance > 0 && paymentType !== 'credit' && (
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    👆 Click to pay full
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          {paymentType === 'cash' && cashPaid > 0 && (
            <Grid size={{ xs: 12, md: 2 }}>
              <Card sx={{ bgcolor: 'info.light', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="info.dark">Cash in Hand</Typography>
                  <Typography variant="h6" fontWeight="bold" color="error.main">
                    -Rs {cashPaid.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Will be deducted
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Paper>
    </Box>
  );
}

