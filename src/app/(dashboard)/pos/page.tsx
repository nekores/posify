'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Autocomplete,
  Divider,
  Badge,
  ToggleButtonGroup,
  ToggleButton,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Menu,
  MenuItem,
  ListItemIcon,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Payment as PaymentIcon,
  Print as PrintIcon,
  Clear as ClearIcon,
  ShoppingCart as CartIcon,
  Undo as ReturnIcon,
  Pause as HoldIcon,
  PlayArrow as ResumeIcon,
  Edit as EditIcon,
  LocalAtm as CashIcon,
  AccountBalance as BankIcon,
  Sell as SellIcon,
} from '@mui/icons-material';
import { usePOSStore } from '@/store/useStore';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  salePrice: number;
  costPrice: number;
  stock: number;
  taxRate: number;
  category: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  balance: number;
  isWalkIn?: boolean; // System flag for walk-in customer
  customerType?: {
    id: string;
    name: string;
    discount: number;
  };
}

export default function POSPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  
  // New state for enhanced features
  const [saleMode, setSaleMode] = useState<'new' | 'return'>('new');
  const [isCashSale, setIsCashSale] = useState(true);
  const [isWalkInCustomer, setIsWalkInCustomer] = useState(true); // Track if Walk In customer
  const [customerOldBalance, setCustomerOldBalance] = useState(0); // Customer's previous balance
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [heldSalesDialogOpen, setHeldSalesDialogOpen] = useState(false);
  const [holdNote, setHoldNote] = useState('');
  const [collection, setCollection] = useState(0); // For credit customers paying old balance
  const [sellMenuAnchor, setSellMenuAnchor] = useState<null | HTMLElement>(null); // For sell button menu
  const [cashReceived, setCashReceived] = useState<number>(0); // For calculating change
  
  // Helper to check if customer is Walk In (uses flag first, then falls back to name)
  const checkIsWalkIn = (customer: Customer | null) => {
    if (!customer) return true; // No customer = Walk-in behavior
    if (customer.isWalkIn !== undefined) return customer.isWalkIn; // Use flag if available
    // Fallback to name detection for backwards compatibility
    const lowerName = customer.name.toLowerCase().trim();
    return lowerName.includes('walk in') || 
           lowerName.includes('walkin') || 
           lowerName.includes('walk-in');
  };

  // Reset to Walk-in Customer for next sale
  const resetToWalkIn = () => {
    storeResetToWalkIn();
    setCollection(0);
    setSaleMode('new');
    setIsCashSale(true);
    setIsWalkInCustomer(true);
    setCustomerOldBalance(0);
    setCashReceived(0);
  };

  const {
    cart,
    customerId,
    customerName,
    discount,
    amountPaid,
    paymentType,
    heldSales,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    resetToWalkIn: storeResetToWalkIn,
    setCustomer,
    setDiscount,
    setPayment,
    holdSale: storeHoldSale,
    resumeSale: storeResumeSale,
    deleteHeldSale: storeDeleteHeldSale,
    getSubtotal,
    getTotal,
    getDue,
  } = usePOSStore();
  
  // Reset cart on page load (but preserve held sales)
  useEffect(() => {
    storeResetToWalkIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch products from database
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products?limit=200');
        const data = await res.json();
        if (data.data) {
          setProducts(data.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku || '',
            barcode: p.barcode || '',
            salePrice: p.salePrice || 0,
            costPrice: p.costPrice || 0,
            stock: p.stock || 0,
            taxRate: Number(p.taxRate) || 0,
            category: p.category?.name || 'Uncategorized',
          })));
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        toast.error('Failed to load products');
      }
    };

    const fetchCustomers = async () => {
      try {
        const res = await fetch('/api/customers?limit=500');
        const data = await res.json();
        if (data.data) {
          setCustomers(data.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone || '',
            balance: c.balance || 0,
            customerType: c.customerType ? {
              id: c.customerType.id,
              name: c.customerType.name,
              discount: Number(c.customerType.discount) || 0,
            } : undefined,
          })));
        }
      } catch (error) {
        console.error('Error fetching customers:', error);
      }
    };

    fetchProducts();
    fetchCustomers();
  }, []);

  // Filter products based on search and stock availability
  // Only show products with stock > 0 (hide out of stock products)
  const filteredProducts = products.filter(
    (p) =>
      p.stock > 0 && // Only show products with available stock
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.includes(searchTerm))
  );

  const handleAddToCart = useCallback((product: Product) => {
    // ✅ CLIENT-SIDE STOCK VALIDATION
    // Check if product is already in cart
    const existingItem = cart.find(item => item.productId === product.id);
    const currentCartQty = existingItem ? existingItem.quantity : 0;
    
    if (saleMode !== 'return' && product.stock <= currentCartQty) {
      toast.error(`Out of stock! "${product.name}" has only ${product.stock} available.`);
      return;
    }
    
    // Calculate tax for this item (for 1 quantity)
    const itemSubtotal = product.salePrice;
    const itemTax = (itemSubtotal * (product.taxRate || 0)) / 100;
    
    // If item exists, update quantity and recalculate tax
    if (existingItem) {
      const newQty = existingItem.quantity + 1;
      const newItemSubtotal = product.salePrice * newQty;
      const newItemTax = (newItemSubtotal * (product.taxRate || 0)) / 100;
      updateCartItem(existingItem.id, { quantity: newQty, tax: newItemTax });
    } else {
      addToCart({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: product.salePrice,
        costPrice: product.costPrice,
        discount: 0,
        tax: itemTax,
        maxStock: product.stock, // Store max stock for quantity validation
      });
    }
    toast.success(`${product.name} added to cart`);
  }, [addToCart, cart, saleMode, updateCartItem]);

  const handleQuantityChange = (id: string, delta: number) => {
    const item = cart.find((i) => i.id === id);
    if (item) {
      const newQty = item.quantity + delta;
      if (newQty > 0) {
        // ✅ CLIENT-SIDE STOCK VALIDATION for quantity increase
        if (saleMode !== 'return' && delta > 0 && item.maxStock !== undefined && newQty > item.maxStock) {
          toast.error(`Cannot add more. Only ${item.maxStock} available for "${item.name}".`);
          return;
        }
        // Recalculate tax when quantity changes
        const product = products.find(p => p.id === item.productId);
        const itemSubtotal = item.unitPrice * newQty;
        const itemTax = product ? (itemSubtotal * (product.taxRate || 0)) / 100 : item.tax;
        updateCartItem(id, { quantity: newQty, tax: itemTax });
      }
    }
  };

  // Handle price change - cannot be below cost price
  const handlePriceChange = (id: string, newPrice: number) => {
    const item = cart.find((i) => i.id === id);
    if (item) {
      // Ensure price is not below cost price
      const minPrice = item.costPrice || 0;
      const validPrice = Math.max(newPrice, minPrice);
      
      if (newPrice < minPrice) {
        toast.error(`Price cannot be below cost (Rs. ${minPrice})`);
      }
      
      // Recalculate tax when price changes
      const product = products.find(p => p.id === item.productId);
      const itemSubtotal = validPrice * item.quantity;
      const itemTax = product ? (itemSubtotal * (product.taxRate || 0)) / 100 : item.tax;
      
      updateCartItem(id, { unitPrice: validPrice, tax: itemTax });
    }
  };

  // Hold current sale
  const handleHoldSale = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    // Use store's hold function - pass current isCashSale and cashReceived
    storeHoldSale(holdNote, isCashSale, cashReceived);
    setHoldNote('');
    setHoldDialogOpen(false);
    setCollection(0);
    setSaleMode('new');
    setIsCashSale(true);
    setIsWalkInCustomer(true);
    setCustomerOldBalance(0);
    setCashReceived(0);
    toast.success('Sale held successfully');
  };

  // Resume a held sale
  const handleResumeSale = (saleId: string) => {
    if (cart.length > 0) {
      if (!confirm('Current cart has items. Resume will replace them. Continue?')) {
        return;
      }
    }

    // Use store's resume function - returns the held sale with all data
    const heldSale = storeResumeSale(saleId);
    
    if (heldSale) {
      // Check if customer is walk-in
      const isWalkIn = !heldSale.customerId || 
        heldSale.customerName.toLowerCase().includes('walk');
      setIsWalkInCustomer(isWalkIn);
      
      // Restore isCashSale and cashReceived from held sale
      setIsCashSale(heldSale.isCashSale ?? true);
      setCashReceived(heldSale.cashReceived ?? 0);
      
      // Restore customer old balance
      if (heldSale.customerId && !isWalkIn) {
        const customer = customers.find(c => c.id === heldSale.customerId);
        setCustomerOldBalance(customer ? Number(customer.balance) || 0 : 0);
      } else {
        setCustomerOldBalance(0);
      }
    }

    setHeldSalesDialogOpen(false);
    toast.success('Sale resumed');
  };

  // Delete a held sale
  const handleDeleteHeldSale = (id: string) => {
    storeDeleteHeldSale(id);
    toast.success('Held sale deleted');
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    try {
      // Calculate how much of the payment goes to current sale vs old balance
      const currentBill = getTotal();
      
      // For RETURNS: Always from Cash in Hand - check balance first
      if (saleMode === 'return') {
        const cashRes = await fetch('/api/accounts/cash-in-hand');
        if (cashRes.ok) {
          const cashData = await cashRes.json();
          const cashInHand = cashData.balance || 0;
          
          if (cashInHand < currentBill) {
            toast.error(
              `Insufficient Cash in Hand!\n\nRequired: Rs. ${currentBill.toLocaleString()}\nAvailable: Rs. ${cashInHand.toLocaleString()}\n\nCannot process return.`,
              { duration: 5000 }
            );
            return;
          }
        }
      }
      
      let paidToSale = 0;
      let paidToOldBalance = 0;
      
      if (saleMode === 'return') {
        // Returns: Always from cash, refund full amount
        paidToSale = currentBill;
      } else if (isCashSale) {
        // Cash sale
        const actualCashReceived = cashReceived > 0 ? cashReceived : currentBill;
        paidToSale = currentBill;
        
        // For customers with old balance: excess goes to collection
        if (!isWalkInCustomer && customerOldBalance > 0) {
          const excessAfterBill = actualCashReceived - currentBill;
          if (excessAfterBill > 0) {
            paidToOldBalance = Math.min(excessAfterBill, customerOldBalance);
          }
        }
      } else {
        // Credit sale - no payment, full amount goes to balance
        paidToSale = 0;
        paidToOldBalance = 0;
      }
      
      const saleData = {
        items: cart,
        customerId,
        discount,
        total: currentBill,
        paid: paidToSale,
        // Returns are ALWAYS from cash
        paymentType: saleMode === 'return' ? 'cash' : (isCashSale ? 'cash' : paymentType),
        isReturn: saleMode === 'return',
        isCashSale: saleMode === 'return' ? true : isCashSale,
        collection: paidToOldBalance, // Amount collected towards old balance
      };

      // Call API to save sale
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || errorData.error || 'Failed to save sale');
      }

      const successMsg = saleMode === 'return' 
        ? 'Return processed successfully!' 
        : isCashSale 
          ? 'Sale completed successfully!'
          : `Credit sale completed! Rs. ${currentBill.toLocaleString()} added to ${customerName}'s balance`;
      
      toast.success(successMsg);
      resetToWalkIn(); // Reset to Walk-in Customer for next sale
      setPaymentDialogOpen(false);
    } catch (error: any) {
      console.error('Sale error:', error);
      toast.error(error.message || 'Failed to complete sale');
      console.error(error);
    }
  };

  const subtotal = getSubtotal();
  const totalTax = usePOSStore((state) => {
    return state.cart.reduce((sum, item) => sum + item.tax, 0);
  });
  const total = getTotal();
  const due = getDue();
  
  // Grand total: For NEW sales, include old balance (for non-walk-in customers)
  // For RETURNS, only show return amount (don't add previous balance)
  const grandTotal = saleMode === 'return' 
    ? total 
    : total + (isWalkInCustomer ? 0 : customerOldBalance);

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', overflow: 'hidden' }}>
      <Grid container spacing={2} sx={{ height: '100%' }}>
        {/* Products Section */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 120px)' }}>
            <CardContent sx={{ pb: 1 }}>
              <TextField
                fullWidth
                placeholder="Search products by name, SKU, or barcode... (Press Enter to add)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredProducts.length > 0) {
                    e.preventDefault();
                    handleAddToCart(filteredProducts[0]);
                    setSearchTerm(''); // Clear search after adding
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchTerm('')}>
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                autoFocus
              />
            </CardContent>

            {/* Products Grid */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2, pt: 0 }}>
              {filteredProducts.length === 0 ? (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  height: '100%',
                  color: 'text.secondary',
                  py: 5
                }}>
                  <CartIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                  <Typography variant="h6">
                    {searchTerm ? 'No products found' : 'No products in stock'}
                  </Typography>
                  <Typography variant="body2">
                    {searchTerm ? 'Try a different search term' : 'All products are currently out of stock'}
                  </Typography>
                </Box>
              ) : (
              <Grid container spacing={1.5}>
                {filteredProducts.map((product, index) => {
                  const isFirstItem = index === 0 && searchTerm.length > 0;
                  return (
                    <Grid size={{ xs: 6, sm: 4, lg: 3 }} key={product.id}>
                      <Card
                        sx={{
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          border: isFirstItem ? '2px solid' : '1px solid transparent',
                          borderColor: isFirstItem ? 'success.main' : 'transparent',
                          bgcolor: isFirstItem ? 'success.50' : 'background.paper',
                          boxShadow: isFirstItem ? 4 : 1,
                          position: 'relative',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 4,
                          },
                        }}
                        onClick={() => handleAddToCart(product)}
                      >
                        {/* First Item Badge */}
                        {isFirstItem && (
                          <Chip
                            label="↵ Enter"
                            size="small"
                            color="success"
                            sx={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              fontSize: '0.65rem',
                              height: 20,
                              fontWeight: 'bold',
                            }}
                          />
                        )}
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Typography variant="body2" fontWeight="bold" noWrap>
                            {product.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {product.sku}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                            <Typography variant="subtitle1" color="primary" fontWeight="bold">
                              Rs. {product.salePrice.toLocaleString()}
                            </Typography>
                            <Chip
                              label={product.stock}
                              size="small"
                              color={product.stock > 10 ? 'success' : product.stock > 5 ? 'warning' : 'error'}
                              sx={{ 
                                fontWeight: 'bold',
                                minWidth: 40,
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Cart Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 120px)' }}>
            {/* Sale Mode Toggle */}
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Grid container spacing={1} alignItems="center">
                <Grid size={6}>
                  {isWalkInCustomer ? (
                    // Walk In: Only show NEW button (no returns)
                    <Button
                      fullWidth
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={<EditIcon />}
                      sx={{ height: 40 }}
                    >
                      NEW SALE
                    </Button>
                  ) : (
                    // Regular customer: Show toggle
                    <ToggleButtonGroup
                      value={saleMode}
                      exclusive
                      onChange={(_, value) => value && setSaleMode(value)}
                      size="small"
                      fullWidth
                    >
                      <ToggleButton value="new" sx={{ 
                        '&.Mui-selected': { bgcolor: 'success.main', color: 'white' },
                        '&.Mui-selected:hover': { bgcolor: 'success.dark' }
                      }}>
                        <EditIcon sx={{ mr: 0.5, fontSize: 18 }} /> NEW
                      </ToggleButton>
                      <ToggleButton value="return" sx={{ 
                        '&.Mui-selected': { bgcolor: 'warning.main', color: 'white' },
                        '&.Mui-selected:hover': { bgcolor: 'warning.dark' }
                      }}>
                        <ReturnIcon sx={{ mr: 0.5, fontSize: 18 }} /> RETURN
                      </ToggleButton>
                    </ToggleButtonGroup>
                  )}
                </Grid>
                <Grid size={3}>
                  <FormControlLabel
                    control={
                      <Checkbox 
                        checked={saleMode === 'return' ? true : isCashSale} 
                        onChange={(e) => !isWalkInCustomer && saleMode !== 'return' && setIsCashSale(e.target.checked)}
                        size="small"
                        disabled={isWalkInCustomer || saleMode === 'return'}
                      />
                    }
                    label={
                      <Typography variant="body2" color={(isWalkInCustomer || saleMode === 'return') ? 'text.secondary' : 'inherit'}>
                        Cash {isWalkInCustomer && '✓'} {saleMode === 'return' && '(Refund from Cash)'}
                      </Typography>
                    }
                  />
                </Grid>
                <Grid size={3}>
                  <Badge badgeContent={heldSales.length} color="warning">
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={() => setHeldSalesDialogOpen(true)}
                      startIcon={<HoldIcon />}
                    >
                      Held
                    </Button>
                  </Badge>
                </Grid>
              </Grid>
            </Box>

            {/* Customer Selection */}
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PersonIcon />}
                onClick={() => setCustomerDialogOpen(true)}
                color={saleMode === 'return' ? 'warning' : 'primary'}
                sx={{
                  justifyContent: 'space-between',
                  pr: 2,
                }}
                endIcon={
                  !isWalkInCustomer && customerOldBalance > 0 ? (
                    <Chip 
                      label={`Due: Rs. ${customerOldBalance.toLocaleString()}`} 
                      size="small" 
                      color="warning"
                      sx={{ fontWeight: 'bold' }}
                    />
                  ) : null
                }
              >
                {customerName}
              </Button>
            </Box>

            {/* Cart Items - Scrollable */}
            <TableContainer sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell align="center">Qty</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="center" width={50}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                        <CartIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                        <Typography color="text.secondary">
                          Cart is empty
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    cart.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {item.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Rs. {item.unitPrice}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconButton
                              size="small"
                              onClick={() => handleQuantityChange(item.id, -1)}
                            >
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                            <Typography sx={{ mx: 1, minWidth: 24, textAlign: 'center' }}>
                              {item.quantity}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => handleQuantityChange(item.id, 1)}
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            size="small"
                            value={item.unitPrice}
                            onChange={(e) => handlePriceChange(item.id, Number(e.target.value))}
                            onBlur={(e) => {
                              // Ensure minimum price on blur
                              const minPrice = item.costPrice || 0;
                              if (Number(e.target.value) < minPrice) {
                                handlePriceChange(item.id, minPrice);
                              }
                            }}
                            inputProps={{ 
                              min: item.costPrice || 0,
                              style: { textAlign: 'right', width: 70, padding: '4px 8px' }
                            }}
                            sx={{ 
                              '& .MuiOutlinedInput-root': { 
                                borderRadius: 1,
                                bgcolor: item.unitPrice > (item.costPrice || 0) ? 'success.50' : 'grey.100'
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {item.total.toFixed(2)}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeFromCart(item.id)}
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

            {/* Cart Summary - Fixed at bottom */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', flexShrink: 0, bgcolor: 'background.paper' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Subtotal</Typography>
                <Typography>Rs. {subtotal.toFixed(2)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Discount</Typography>
                <Typography color="error">- Rs. {discount.toFixed(2)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Tax</Typography>
                <Typography color="primary">Rs. {totalTax.toFixed(2)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Current Bill</Typography>
                <Typography fontWeight="medium">Rs. {total.toFixed(2)}</Typography>
              </Box>
              {!isWalkInCustomer && customerOldBalance > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, bgcolor: saleMode === 'return' ? 'grey.200' : 'warning.light', mx: -2, px: 2, py: 0.5 }}>
                  <Typography color={saleMode === 'return' ? 'text.secondary' : 'warning.dark'} fontWeight="medium">
                    Previous Balance {saleMode === 'return' && '(info only)'}
                  </Typography>
                  <Typography color={saleMode === 'return' ? 'text.secondary' : 'warning.dark'} fontWeight="bold">
                    Rs. {customerOldBalance.toLocaleString()}
                  </Typography>
                </Box>
              )}
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  {saleMode === 'return' ? 'Refund Amount' : (!isWalkInCustomer && customerOldBalance > 0 ? 'Grand Total' : 'Total')}
                </Typography>
                <Typography variant="h6" fontWeight="bold" color={saleMode === 'return' ? 'warning.main' : 'primary'}>
                  Rs. {grandTotal.toFixed(2)}
                </Typography>
              </Box>

              {/* Cash Received & Change - Only for cash sales (not returns, not credit) */}
              {isCashSale && saleMode !== 'return' && cart.length > 0 && (
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 2, border: '1px dashed', borderColor: 'grey.300' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90 }}>
                      Cash Received:
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={cashReceived || ''}
                      onChange={(e) => setCashReceived(Number(e.target.value) || 0)}
                      placeholder={grandTotal.toFixed(2)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
                      }}
                      sx={{ 
                        flex: 1,
                        '& .MuiOutlinedInput-root': { bgcolor: 'white' }
                      }}
                    />
                  </Box>
                  {/* Quick amount buttons */}
                  <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                    {[grandTotal, 500, 1000, 2000, 5000].map((amount) => (
                      <Chip
                        key={amount}
                        label={amount === grandTotal ? 'Exact' : `Rs. ${amount.toFixed(2)}`}
                        size="small"
                        variant={cashReceived === amount ? 'filled' : 'outlined'}
                        color={amount === grandTotal ? 'success' : 'default'}
                        onClick={() => setCashReceived(amount)}
                        sx={{ 
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          '&:hover': { bgcolor: 'primary.light', color: 'white' }
                        }}
                      />
                    ))}
                  </Box>
                  {cashReceived > 0 && (() => {
                    // For customers with previous balance: excess goes to collection, no change
                    // For walk-in: excess is change to return
                    const hasOldBalance = !isWalkInCustomer && customerOldBalance > 0;
                    const excessAfterBill = cashReceived - total; // After paying current bill
                    
                    if (hasOldBalance) {
                      // Customer has old balance
                      if (cashReceived < total) {
                        // Not enough to cover even current bill
                        return (
                          <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'error.light' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography fontWeight="bold" color="error.dark">Short for Bill:</Typography>
                              <Typography variant="h6" fontWeight="bold" color="error.dark">
                                Rs. {(total - cashReceived).toFixed(2)}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      } else {
                        // Covers bill, excess goes to old balance
                        const collectionAmount = Math.min(excessAfterBill, customerOldBalance);
                        const remainingBalance = customerOldBalance - collectionAmount;
                        return (
                          <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'info.light' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="body2" color="info.dark">Pays Bill:</Typography>
                              <Typography variant="body2" fontWeight="bold" color="info.dark">
                                Rs. {total.toFixed(2)}
                              </Typography>
                            </Box>
                            {collectionAmount > 0 && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2" color="success.dark">→ Collection:</Typography>
                                <Typography variant="body2" fontWeight="bold" color="success.dark">
                                  Rs. {collectionAmount.toLocaleString()}
                                </Typography>
                              </Box>
                            )}
                            <Divider sx={{ my: 0.5 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography fontWeight="bold" color="warning.dark">New Balance:</Typography>
                              <Typography variant="h6" fontWeight="bold" color="warning.dark">
                                Rs. {remainingBalance.toLocaleString()}
                              </Typography>
                            </Box>
                            {excessAfterBill > customerOldBalance && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, bgcolor: 'success.main', mx: -1, px: 1, py: 0.5, borderRadius: 1 }}>
                                <Typography fontWeight="bold" color="white">Change:</Typography>
                                <Typography variant="h6" fontWeight="bold" color="white">
                                  Rs. {(excessAfterBill - customerOldBalance).toLocaleString()}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        );
                      }
                    } else {
                      // Walk-in customer: simple change calculation
                      return (
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          p: 1,
                          borderRadius: 1,
                          bgcolor: cashReceived >= total ? 'success.light' : 'error.light',
                        }}>
                          <Typography 
                            fontWeight="bold" 
                            color={cashReceived >= total ? 'success.dark' : 'error.dark'}
                          >
                            {cashReceived >= total ? 'Change:' : 'Short:'}
                          </Typography>
                          <Typography 
                            variant="h6" 
                            fontWeight="bold" 
                            color={cashReceived >= total ? 'success.dark' : 'error.dark'}
                          >
                            Rs. {Math.abs(cashReceived - total).toFixed(2)}
                          </Typography>
                        </Box>
                      );
                    }
                  })()}
                </Box>
              )}

              {/* Action Buttons */}
              <Grid container spacing={1}>
                <Grid size={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    onClick={resetToWalkIn}
                    disabled={cart.length === 0}
                    size="small"
                  >
                    Clear
                  </Button>
                </Grid>
                <Grid size={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    color="warning"
                    startIcon={<HoldIcon />}
                    onClick={() => setHoldDialogOpen(true)}
                    disabled={cart.length === 0}
                    size="small"
                  >
                    Hold
                  </Button>
                </Grid>
                <Grid size={4}>
                  <Button
                    fullWidth
                    variant="contained"
                    color={saleMode === 'return' ? 'warning' : 'success'}
                    startIcon={<SellIcon />}
                    onClick={(e) => {
                      if (saleMode === 'return') {
                        // Return: Process directly
                        handleCompleteSale();
                      } else if (isCashSale) {
                        // Cash checkbox is checked: Show Cash/Bank menu
                        setSellMenuAnchor(e.currentTarget);
                      } else {
                        // Credit sale (Cash unchecked): Process directly as credit
                        // No payment received - full amount goes to customer balance
                        setPayment('credit', 0);
                        handleCompleteSale();
                      }
                    }}
                    disabled={cart.length === 0}
                    size="small"
                  >
                    {saleMode === 'return' ? 'Return' : (isCashSale ? 'Sale Now' : 'Credit Sale')}
                  </Button>
                  
                  {/* Sell Menu - Cash or Bank (only when Cash checkbox is checked) */}
                  <Menu
                    anchorEl={sellMenuAnchor}
                    open={Boolean(sellMenuAnchor)}
                    onClose={() => setSellMenuAnchor(null)}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                    transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                  >
                    <MenuItem 
                      onClick={() => {
                        setSellMenuAnchor(null);
                        setPayment('cash', grandTotal);
                        handleCompleteSale();
                      }}
                      sx={{ py: 1.5, px: 3 }}
                    >
                      <ListItemIcon>
                        <CashIcon color="success" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Cash" 
                        secondary="Cash in Hand"
                        primaryTypographyProps={{ fontWeight: 'medium' }}
                      />
                    </MenuItem>
                    <MenuItem 
                      onClick={() => {
                        setSellMenuAnchor(null);
                        setPayment('bank', grandTotal);
                        handleCompleteSale();
                      }}
                      sx={{ py: 1.5, px: 3 }}
                    >
                      <ListItemIcon>
                        <BankIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Bank" 
                        secondary="Bank Transfer"
                        primaryTypographyProps={{ fontWeight: 'medium' }}
                      />
                    </MenuItem>
                  </Menu>
                </Grid>
              </Grid>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Payment Dialog - Modern Design */}
      <Dialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, overflow: 'hidden' }
        }}
      >
        {/* Header with Total */}
        <Box sx={{ 
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          p: 3,
          textAlign: 'center'
        }}>
          <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
            {!isWalkInCustomer && customerOldBalance > 0 ? 'Grand Total (incl. balance)' : 'Amount to Pay'}
          </Typography>
          <Typography variant="h3" fontWeight="bold">
            Rs. {grandTotal.toFixed(2)}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
            {cart.length} item{cart.length !== 1 ? 's' : ''} • {customerName}
          </Typography>
          {!isWalkInCustomer && customerOldBalance > 0 && (
            <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">Current Bill:</Typography>
                <Typography variant="body2" fontWeight="bold">Rs. {total.toFixed(2)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Previous Balance:</Typography>
                <Typography variant="body2" fontWeight="bold">Rs. {customerOldBalance.toLocaleString()}</Typography>
              </Box>
            </Box>
          )}
        </Box>

        <DialogContent sx={{ p: 3 }}>
          {/* Payment Method */}
          <Typography variant="body2" color="text.secondary" fontWeight="medium" sx={{ mb: 1.5 }}>
            Payment Method
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
            {[
              { value: 'cash', label: '💵 Cash' },
              { value: 'card', label: '💳 Card' },
              { value: 'bank', label: '🏦 Bank' }
            ].map((type) => (
              <Button
                key={type.value}
                variant={paymentType === type.value ? 'contained' : 'outlined'}
                onClick={() => setPayment(type.value, amountPaid)}
                sx={{ 
                  flex: 1, 
                  borderRadius: 2,
                  py: 1.5,
                  textTransform: 'none',
                  fontWeight: paymentType === type.value ? 'bold' : 'normal'
                }}
              >
                {type.label}
              </Button>
            ))}
          </Box>

          {/* Amount Input */}
          <Typography variant="body2" color="text.secondary" fontWeight="medium" sx={{ mb: 1.5 }}>
            Amount Received
          </Typography>
          <TextField
            fullWidth
            type="number"
            value={amountPaid || ''}
            onChange={(e) => setPayment(paymentType, Number(e.target.value))}
            placeholder="0"
            InputProps={{
              startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
              sx: { fontSize: '1.25rem', fontWeight: 'bold' }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2
              }
            }}
          />

          {/* Quick Amount Buttons */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
            {[grandTotal, Math.ceil(grandTotal / 100) * 100, Math.ceil(grandTotal / 500) * 500, Math.ceil(grandTotal / 1000) * 1000].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).map((amount) => (
              <Chip
                key={amount}
                label={`Rs. ${amount.toFixed(2)}`}
                onClick={() => setPayment(paymentType, amount)}
                variant={amountPaid === amount ? 'filled' : 'outlined'}
                color={amountPaid === amount ? 'primary' : 'default'}
                sx={{ borderRadius: 1.5, cursor: 'pointer' }}
              />
            ))}
          </Box>

          {/* Change/Due Display */}
          {amountPaid > 0 && (
            <Box sx={{ 
              mt: 3, 
              p: 2, 
              borderRadius: 2,
              bgcolor: amountPaid >= grandTotal ? 'success.50' : 'warning.50',
              border: '1px solid',
              borderColor: amountPaid >= grandTotal ? 'success.200' : 'warning.200',
              textAlign: 'center'
            }}>
              <Typography variant="body2" color={amountPaid >= grandTotal ? 'success.main' : 'warning.main'}>
                {amountPaid >= grandTotal ? '🎉 Change to Return' : '⚠️ Balance (Credit)'}
              </Typography>
              <Typography variant="h4" fontWeight="bold" color={amountPaid >= grandTotal ? 'success.main' : 'warning.main'}>
                Rs. {Math.abs(grandTotal - amountPaid).toFixed(2)}
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          <Button 
            onClick={() => setPaymentDialogOpen(false)}
            variant="outlined"
            sx={{ flex: 1, borderRadius: 2, textTransform: 'none', py: 1.2 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleCompleteSale}
            startIcon={<PrintIcon />}
            disabled={!amountPaid || amountPaid <= 0}
            sx={{ flex: 2, borderRadius: 2, textTransform: 'none', py: 1.2, fontWeight: 'bold' }}
          >
            Complete Sale
          </Button>
        </DialogActions>
      </Dialog>

      {/* Customer Selection Dialog */}
      <Dialog
        open={customerDialogOpen}
        onClose={() => setCustomerDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Select Customer</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={customers}
            getOptionLabel={(option) => `${option.name}${option.customerType ? ` [${option.customerType.name}]` : ''}${option.balance ? ` (Bal: Rs.${Number(option.balance).toLocaleString()})` : ''}`}
            renderInput={(params) => (
              <TextField {...params} label="Search Customer" margin="normal" />
            )}
            renderOption={(props, option) => (
              <li {...props}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Box>
                    <Typography fontWeight="medium">{option.name}</Typography>
                    {option.customerType && (
                      <Typography variant="caption" color="success.main">
                        {option.customerType.name} - {option.customerType.discount}% off
                      </Typography>
                    )}
                  </Box>
                  {option.balance > 0 && (
                    <Chip label={`Bal: Rs.${Number(option.balance).toLocaleString()}`} size="small" color="error" />
                  )}
                </Box>
              </li>
            )}
            onChange={(_, value) => {
              if (value) {
                setCustomer(value.id, value.name);
                
                // Check if Walk In customer (using flag or name fallback)
                const isWalkIn = checkIsWalkIn(value);
                setIsWalkInCustomer(isWalkIn);
                
                if (isWalkIn) {
                  // Walk In: Always cash, no returns, no credit
                  setIsCashSale(true);
                  setSaleMode('new');
                  setCollection(0);
                  setCustomerOldBalance(0);
                  toast.success('Walk In customer selected - Cash sale only');
                } else {
                  // Set customer's old balance
                  const oldBalance = Number(value.balance) || 0;
                  setCustomerOldBalance(oldBalance);
                  
                  // Show balance info
                  if (oldBalance > 0) {
                    toast.success(`Customer has Rs ${oldBalance.toLocaleString()} previous balance`);
                  }
                  
                  // Auto-apply discount based on customer type
                  if (value.customerType?.discount && value.customerType.discount > 0) {
                    const subtotal = getSubtotal();
                    const discountAmount = Math.round(subtotal * value.customerType.discount / 100);
                    setDiscount(discountAmount);
                    toast.success(`${value.customerType.name} discount (${value.customerType.discount}%) applied!`);
                  }
                }
                setCustomerDialogOpen(false);
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomerDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Hold Sale Dialog - Modern Design */}
      <Dialog
        open={holdDialogOpen}
        onClose={() => setHoldDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, overflow: 'hidden' }
        }}
      >
        {/* Header */}
        <Box sx={{ 
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: 'white',
          p: 2.5,
          textAlign: 'center'
        }}>
          <Box sx={{ 
            width: 60, 
            height: 60, 
            borderRadius: '50%', 
            bgcolor: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 1.5
          }}>
            <HoldIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="h6" fontWeight="bold">
            Hold This Sale?
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
            You can resume it anytime
          </Typography>
        </Box>

        <DialogContent sx={{ p: 3 }}>
          {/* Sale Summary Card */}
          <Card variant="outlined" sx={{ borderRadius: 2, mb: 2.5 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Customer</Typography>
                <Typography variant="body2" fontWeight="bold">{customerName}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Items</Typography>
                <Typography variant="body2" fontWeight="bold">{cart.length}</Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body1" fontWeight="bold">Total</Typography>
                <Typography variant="body1" fontWeight="bold" color="primary.main">
                  Rs. {getTotal().toLocaleString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Note Input */}
          <TextField
            fullWidth
            label="Add a note (optional)"
            value={holdNote}
            onChange={(e) => setHoldNote(e.target.value)}
            placeholder="e.g., Customer will return in 30 mins"
            multiline
            rows={2}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2
              }
            }}
          />
        </DialogContent>

        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          <Button 
            onClick={() => setHoldDialogOpen(false)}
            variant="outlined"
            sx={{ flex: 1, borderRadius: 2, textTransform: 'none', py: 1 }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="warning"
            onClick={handleHoldSale}
            startIcon={<HoldIcon />}
            sx={{ flex: 1, borderRadius: 2, textTransform: 'none', py: 1, fontWeight: 'bold' }}
          >
            Hold Sale
          </Button>
        </DialogActions>
      </Dialog>

      {/* Held Sales List Dialog - Modern Design */}
      <Dialog
        open={heldSalesDialogOpen}
        onClose={() => setHeldSalesDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, overflow: 'hidden' }
        }}
      >
        {/* Header */}
        <Box sx={{ 
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: 'white',
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <Box sx={{ 
            bgcolor: 'rgba(255,255,255,0.2)', 
            borderRadius: 2, 
            p: 1,
            display: 'flex'
          }}>
            <HoldIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Held Sales
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {heldSales.length} sale{heldSales.length !== 1 ? 's' : ''} on hold
            </Typography>
          </Box>
        </Box>

        <DialogContent sx={{ p: 0 }}>
          {heldSales.length === 0 ? (
            <Box sx={{ 
              py: 8, 
              textAlign: 'center',
              background: 'linear-gradient(180deg, #fafafa 0%, #fff 100%)'
            }}>
              <Box sx={{ 
                width: 80, 
                height: 80, 
                borderRadius: '50%', 
                bgcolor: '#f5f5f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2
              }}>
                <HoldIcon sx={{ fontSize: 40, color: '#bdbdbd' }} />
              </Box>
              <Typography variant="h6" color="text.secondary" fontWeight="medium">
                No held sales
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                Hold a sale to see it here
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {heldSales.map((sale) => {
                const saleTotal = sale.items.reduce((sum, i) => sum + i.total, 0);
                return (
                  <Card 
                    key={sale.id} 
                    variant="outlined"
                    sx={{ 
                      borderRadius: 2,
                      transition: 'all 0.2s',
                      '&:hover': { 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        borderColor: 'primary.main'
                      }
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      {/* Top Row: Customer & Time */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: '50%', 
                            bgcolor: 'primary.light',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <PersonIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                          </Box>
                          <Box>
                            <Typography fontWeight="bold" variant="body1">
                              {sale.customerName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip 
                          label={new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          size="small"
                          variant="outlined"
                          sx={{ borderRadius: 1 }}
                        />
                      </Box>

                      {/* Items Preview */}
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          mb: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.5
                        }}
                      >
                        {sale.items.map(i => i.name).join(' • ')}
                      </Typography>

                      {/* Note if exists */}
                      {sale.note && (
                        <Box sx={{ 
                          bgcolor: 'warning.50', 
                          borderRadius: 1, 
                          p: 1, 
                          mb: 1.5,
                          borderLeft: '3px solid',
                          borderColor: 'warning.main'
                        }}>
                          <Typography variant="caption" color="warning.dark" fontWeight="medium">
                            📝 {sale.note}
                          </Typography>
                        </Box>
                      )}

                      {/* Bottom Row: Total & Actions */}
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        pt: 1.5,
                        borderTop: '1px dashed',
                        borderColor: 'divider'
                      }}>
                        <Typography variant="h6" color="primary.main" fontWeight="bold">
                          Rs. {saleTotal.toLocaleString()}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            variant="contained"
                            size="small"
                            color="success"
                            onClick={() => handleResumeSale(sale.id)}
                            startIcon={<ResumeIcon />}
                            sx={{ 
                              borderRadius: 2,
                              textTransform: 'none',
                              fontWeight: 'bold',
                              px: 2
                            }}
                          >
                            Resume
                          </Button>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteHeldSale(sale.id)}
                            sx={{ 
                              color: 'error.main',
                              bgcolor: 'error.50',
                              '&:hover': { bgcolor: 'error.100' }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={() => setHeldSalesDialogOpen(false)}
            variant="outlined"
            sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

