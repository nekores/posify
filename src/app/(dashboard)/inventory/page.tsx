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
  Grid,
  Card,
  CardContent,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Autocomplete,
} from '@mui/material';
import {
  Search,
  Add,
  Inventory2,
  Warning,
  TrendingUp,
  TrendingDown,
  History,
  Close,
  AddCircle,
  RemoveCircle,
  ShoppingCart,
  LocalShipping,
  SwapHoriz,
  Settings,
  Delete,
  Undo,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';

interface InventoryItem {
  id: string;
  productId: string;
  quantity: number;
  costPrice: number;
  type: string;
  notes: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    minStock: number;
    salePrice: number;
    category: {
      name: string;
    } | null;
    unit: {
      shortName: string;
    } | null;
  };
}

interface StockAdjustment {
  productId: string;
  quantity: number;
  type: 'add' | 'subtract';
  notes: string;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [adjustment, setAdjustment] = useState<StockAdjustment>({
    productId: '',
    quantity: 0,
    type: 'add',
    notes: '',
  });
  const [selectedProductInfo, setSelectedProductInfo] = useState<{
    name: string;
    latestPurchasePrice: number | null;
    currentCostPrice: number;
    currentSalePrice: number;
  } | null>(null);
  
  // History modal state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<{
    id: string;
    name: string;
    history: InventoryItem[];
  } | null>(null);
  
  // Adjustment history state
  const [adjustmentHistory, setAdjustmentHistory] = useState<InventoryItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adjPage, setAdjPage] = useState(0);
  const [adjRowsPerPage, setAdjRowsPerPage] = useState(10);

  useEffect(() => {
    fetchInventory();
    fetchProducts();
  }, []);

  // Extract adjustments from inventory when it changes
  useEffect(() => {
    const adjustments = inventory
      .filter(item => item.type === 'adjustment')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setAdjustmentHistory(adjustments);
  }, [inventory]);

  const fetchInventory = async () => {
    try {
      const response = await fetch('/api/inventory');
      const data = await response.json();
      setInventory(data.inventory || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products?limit=500');
      const data = await response.json();
      // API returns data in 'data' field, not 'products'
      setProducts(data.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleDeleteAdjustment = async (adjustmentId: string) => {
    if (!confirm('Are you sure you want to delete this adjustment? This will revert the stock change.')) {
      return;
    }
    
    setDeletingId(adjustmentId);
    try {
      const response = await fetch(`/api/inventory/${adjustmentId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast.success('Adjustment deleted and stock reverted');
        fetchInventory();
        fetchProducts();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete adjustment');
      }
    } catch (error) {
      console.error('Error deleting adjustment:', error);
      toast.error('Failed to delete adjustment');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAdjustStock = async () => {
    try {
      const response = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustment),
      });

      if (response.ok) {
        setAdjustmentOpen(false);
        setAdjustment({ productId: '', quantity: 0, type: 'add', notes: '' });
        setSelectedProductInfo(null);
        fetchInventory();
      }
    } catch (error) {
      console.error('Error adjusting stock:', error);
    }
  };

  const handleProductSelect = async (productId: string) => {
    setAdjustment({ ...adjustment, productId });
    
    if (!productId) {
      setSelectedProductInfo(null);
      return;
    }

    // Find product from local state
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Fetch latest purchase price from API
    try {
      const response = await fetch(`/api/products/${productId}/latest-price`);
      const data = await response.json();
      
      setSelectedProductInfo({
        name: product.name,
        latestPurchasePrice: data.latestPurchasePrice,
        currentCostPrice: Number(product.costPrice),
        currentSalePrice: Number(product.salePrice),
      });
    } catch (error) {
      // Fallback to product info if API fails
      setSelectedProductInfo({
        name: product.name,
        latestPurchasePrice: null,
        currentCostPrice: Number(product.costPrice),
        currentSalePrice: Number(product.salePrice),
      });
    }
  };

  // Function to view history for a product
  const handleViewHistory = (productId: string, productName: string, history: InventoryItem[]) => {
    setHistoryProduct({
      id: productId,
      name: productName,
      history: history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    });
    setHistoryOpen(true);
  };

  // Get icon and color for inventory type
  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'opening':
        return { icon: <Inventory2 fontSize="small" />, color: 'info', label: 'Opening Stock' };
      case 'purchase':
        return { icon: <LocalShipping fontSize="small" />, color: 'success', label: 'Purchase' };
      case 'purchase_return':
        return { icon: <SwapHoriz fontSize="small" />, color: 'warning', label: 'Purchase Return' };
      case 'sale':
        return { icon: <ShoppingCart fontSize="small" />, color: 'error', label: 'Sale' };
      case 'sale_return':
        return { icon: <SwapHoriz fontSize="small" />, color: 'info', label: 'Sale Return' };
      case 'adjustment':
        return { icon: <Settings fontSize="small" />, color: 'default', label: 'Adjustment' };
      default:
        return { icon: <Inventory2 fontSize="small" />, color: 'default', label: type };
    }
  };

  // Group inventory by product
  const groupedInventory = inventory.reduce((acc, item) => {
    const productId = item.productId;
    if (!acc[productId]) {
      acc[productId] = {
        product: item.product,
        totalQuantity: 0,
        costValue: 0,
        history: [],
      };
    }
    acc[productId].totalQuantity += item.quantity;
    acc[productId].costValue += item.quantity * Number(item.costPrice);
    acc[productId].history.push(item);
    return acc;
  }, {} as Record<string, { product: any; totalQuantity: number; costValue: number; history: InventoryItem[] }>);

  const inventoryList = Object.values(groupedInventory);

  const filteredInventory = inventoryList.filter((item) =>
    item.product.name.toLowerCase().includes(search.toLowerCase()) ||
    item.product.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const paginatedInventory = filteredInventory.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const lowStockItems = inventoryList.filter(
    (item) => item.totalQuantity <= item.product.minStock
  );
  const totalStockValue = inventoryList.reduce((sum, item) => sum + item.costValue, 0);
  const totalItems = inventoryList.reduce((sum, item) => sum + item.totalQuantity, 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Inventory Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setAdjustmentOpen(true)}
          sx={{ borderRadius: 2 }}
        >
          Stock Adjustment
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>Total Products</Typography>
                  <Typography variant="h4" fontWeight="bold">{inventoryList.length}</Typography>
                </Box>
                <Inventory2 sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>Total Items in Stock</Typography>
                  <Typography variant="h4" fontWeight="bold">{totalItems}</Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>Stock Value</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    Rs {totalStockValue.toLocaleString()}
                  </Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ background: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>Low Stock Items</Typography>
                  <Typography variant="h4" fontWeight="bold">{lowStockItems.length}</Typography>
                </Box>
                <Warning sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography fontWeight="bold">Low Stock Alert!</Typography>
          <Typography variant="body2">
            {lowStockItems.length} products are running low on stock:{' '}
            {lowStockItems.slice(0, 3).map((item) => item.product.name).join(', ')}
            {lowStockItems.length > 3 && ` and ${lowStockItems.length - 3} more...`}
          </Typography>
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="All Products" />
          <Tab label={`Low Stock (${lowStockItems.length})`} />
          <Tab label="Adjustment History" icon={<History sx={{ fontSize: 18 }} />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 0 & 1: Product Inventory */}
      {tabValue !== 2 && (
        <>
          {/* Search */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Paper>

          {/* Inventory Table */}
          <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell><strong>Product</strong></TableCell>
                <TableCell><strong>SKU</strong></TableCell>
                <TableCell><strong>Category</strong></TableCell>
                <TableCell align="center"><strong>In Stock</strong></TableCell>
                <TableCell align="center"><strong>Min Stock</strong></TableCell>
                <TableCell align="right"><strong>Cost Value</strong></TableCell>
                <TableCell align="right"><strong>Sale Value</strong></TableCell>
                <TableCell align="center"><strong>Status</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">Loading...</TableCell>
                </TableRow>
              ) : paginatedInventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">No inventory found</TableCell>
                </TableRow>
              ) : (
                (tabValue === 1 ? lowStockItems : paginatedInventory).map((item) => (
                  <TableRow key={item.product.id} hover>
                    <TableCell>
                      <Typography fontWeight="medium">{item.product.name}</Typography>
                    </TableCell>
                    <TableCell>{item.product.sku || '-'}</TableCell>
                    <TableCell>{item.product.category?.name || '-'}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={item.totalQuantity}
                        color={item.totalQuantity <= item.product.minStock ? 'error' : 'success'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">{item.product.minStock}</TableCell>
                    <TableCell align="right">
                      Rs {item.costValue.toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      Rs {(item.totalQuantity * Number(item.product.salePrice)).toLocaleString()}
                    </TableCell>
                    <TableCell align="center">
                      {item.totalQuantity <= 0 ? (
                        <Chip label="Out of Stock" color="error" size="small" />
                      ) : item.totalQuantity <= item.product.minStock ? (
                        <Chip label="Low Stock" color="warning" size="small" />
                      ) : (
                        <Chip label="In Stock" color="success" size="small" />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton 
                        size="small" 
                        color="primary"
                        onClick={() => handleViewHistory(item.product.id, item.product.name, item.history)}
                        title="View History"
                      >
                        <History />
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
          count={tabValue === 1 ? lowStockItems.length : filteredInventory.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
          </Paper>
        </>
      )}

      {/* Tab 2: Adjustment History */}
      {tabValue === 2 && (
        <Paper>
          <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
            <Typography variant="h6" fontWeight="bold">
              Stock Adjustment History
            </Typography>
            <Typography variant="body2" color="text.secondary">
              View and manage all manual stock adjustments. You can delete adjustments to revert stock changes.
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><strong>Date & Time</strong></TableCell>
                  <TableCell><strong>Product</strong></TableCell>
                  <TableCell align="center"><strong>Type</strong></TableCell>
                  <TableCell align="center"><strong>Quantity</strong></TableCell>
                  <TableCell align="right"><strong>Cost Price</strong></TableCell>
                  <TableCell><strong>Notes / Reason</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {adjustmentHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Box sx={{ py: 4 }}>
                        <Settings sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                        <Typography color="text.secondary">No stock adjustments found</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  adjustmentHistory
                    .slice(adjPage * adjRowsPerPage, adjPage * adjRowsPerPage + adjRowsPerPage)
                    .map((adj) => (
                    <TableRow key={adj.id} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(adj.createdAt).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(adj.createdAt).toLocaleTimeString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="medium">{adj.product.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          SKU: {adj.product.sku || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={adj.quantity > 0 ? <AddCircle fontSize="small" /> : <RemoveCircle fontSize="small" />}
                          label={adj.quantity > 0 ? 'Added' : 'Subtracted'}
                          size="small"
                          color={adj.quantity > 0 ? 'success' : 'error'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography 
                          fontWeight="bold" 
                          color={adj.quantity > 0 ? 'success.main' : 'error.main'}
                          fontSize={18}
                        >
                          {adj.quantity > 0 ? '+' : ''}{adj.quantity}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        Rs {Number(adj.costPrice).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200 }}>
                          {adj.notes || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteAdjustment(adj.id)}
                          disabled={deletingId === adj.id}
                          title="Delete adjustment and revert stock"
                        >
                          {deletingId === adj.id ? (
                            <Typography variant="caption">...</Typography>
                          ) : (
                            <Undo />
                          )}
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
            count={adjustmentHistory.length}
            page={adjPage}
            onPageChange={(_, newPage) => setAdjPage(newPage)}
            rowsPerPage={adjRowsPerPage}
            onRowsPerPageChange={(e) => {
              setAdjRowsPerPage(parseInt(e.target.value, 10));
              setAdjPage(0);
            }}
          />
          {adjustmentHistory.length > 0 && (
            <Box sx={{ p: 2, borderTop: '1px solid #eee', bgcolor: '#f9f9f9' }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">Total Adjustments</Typography>
                  <Typography variant="h6" fontWeight="bold">{adjustmentHistory.length}</Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">Stock Added</Typography>
                  <Typography variant="h6" fontWeight="bold" color="success.main">
                    +{adjustmentHistory.filter(a => a.quantity > 0).reduce((sum, a) => sum + a.quantity, 0)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">Stock Subtracted</Typography>
                  <Typography variant="h6" fontWeight="bold" color="error.main">
                    {adjustmentHistory.filter(a => a.quantity < 0).reduce((sum, a) => sum + a.quantity, 0)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">Net Change</Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {adjustmentHistory.reduce((sum, a) => sum + a.quantity, 0)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </Paper>
      )}

      {/* Stock Adjustment Dialog */}
      <Dialog 
        open={adjustmentOpen} 
        onClose={() => {
          setAdjustmentOpen(false);
          setSelectedProductInfo(null);
          setAdjustment({ productId: '', quantity: 0, type: 'add', notes: '' });
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h5" fontWeight="bold">Stock Adjustment</Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {/* Product Autocomplete - Full Width with search */}
            <Autocomplete
              fullWidth
              options={products}
              getOptionLabel={(option) => option.name || ''}
              value={products.find(p => p.id === adjustment.productId) || null}
              onChange={(_, newValue) => {
                if (newValue) {
                  handleProductSelect(newValue.id);
                } else {
                  setAdjustment({ ...adjustment, productId: '' });
                  setSelectedProductInfo(null);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search Product *"
                  placeholder="Type to search products..."
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id}>
                  <Box sx={{ width: '100%' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography fontWeight="medium">{option.name}</Typography>
                      <Chip 
                        label={`Stock: ${option.stock ?? 0}`} 
                        size="small"
                        color={option.stock > 0 ? 'success' : 'error'}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      SKU: {option.sku || 'N/A'} | Cost: Rs {Number(option.costPrice).toLocaleString()} | Sale: Rs {Number(option.salePrice).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              )}
              filterOptions={(options, { inputValue }) => {
                const searchLower = inputValue.toLowerCase();
                return options.filter(option => 
                  option.name?.toLowerCase().includes(searchLower) ||
                  option.sku?.toLowerCase().includes(searchLower) ||
                  option.barcode?.toLowerCase().includes(searchLower)
                );
              }}
              sx={{ mb: 2 }}
              ListboxProps={{
                sx: { maxHeight: 350 }
              }}
            />

            {/* Price & Stock Info - Shows when product is selected */}
            {selectedProductInfo && (
              <Alert 
                severity="info" 
                sx={{ mb: 3 }}
                icon={false}
              >
                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Current Stock
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color={
                      (products.find(p => p.id === adjustment.productId)?.stock ?? 0) > 0 
                        ? 'success.main' 
                        : 'error.main'
                    }>
                      {products.find(p => p.id === adjustment.productId)?.stock ?? 0} units
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Cost Price (from Latest Purchase)
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary.main">
                      Rs {(selectedProductInfo.latestPurchasePrice ?? selectedProductInfo.currentCostPrice).toLocaleString()}
                    </Typography>
                    {!selectedProductInfo.latestPurchasePrice && (
                      <Typography variant="caption" color="warning.main">
                        No purchases found, using product default
                      </Typography>
                    )}
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Current Sale Price
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="success.main">
                      Rs {selectedProductInfo.currentSalePrice.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </Alert>
            )}

            {/* Type and Quantity in a row */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Type *</InputLabel>
                  <Select
                    value={adjustment.type}
                    label="Type *"
                    onChange={(e) => setAdjustment({ ...adjustment, type: e.target.value as 'add' | 'subtract' })}
                    sx={{ minHeight: 56 }}
                  >
                    <MenuItem value="add" sx={{ py: 1.5 }}>
                      <Typography color="success.main" fontWeight="medium">+ Add Stock</Typography>
                    </MenuItem>
                    <MenuItem value="subtract" sx={{ py: 1.5 }}>
                      <Typography color="error.main" fontWeight="medium">− Subtract Stock</Typography>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Quantity *"
                  type="number"
                  value={adjustment.quantity}
                  onChange={(e) => setAdjustment({ ...adjustment, quantity: Number(e.target.value) })}
                  InputProps={{ sx: { minHeight: 56 } }}
                  error={
                    adjustment.type === 'subtract' && 
                    adjustment.quantity > (products.find(p => p.id === adjustment.productId)?.stock ?? 0)
                  }
                  helperText={
                    adjustment.type === 'subtract' && 
                    adjustment.quantity > (products.find(p => p.id === adjustment.productId)?.stock ?? 0)
                      ? `Cannot subtract more than current stock (${products.find(p => p.id === adjustment.productId)?.stock ?? 0})`
                      : ''
                  }
                />
              </Grid>
            </Grid>
            
            {/* Warning for subtract with validation */}
            {adjustment.type === 'subtract' && adjustment.productId && adjustment.quantity > 0 && (
              <Alert 
                severity={adjustment.quantity > (products.find(p => p.id === adjustment.productId)?.stock ?? 0) ? 'error' : 'warning'} 
                sx={{ mb: 2 }}
              >
                {adjustment.quantity > (products.find(p => p.id === adjustment.productId)?.stock ?? 0)
                  ? `Cannot subtract ${adjustment.quantity} units. Only ${products.find(p => p.id === adjustment.productId)?.stock ?? 0} units available.`
                  : `This will reduce stock by ${adjustment.quantity} units. New stock will be: ${(products.find(p => p.id === adjustment.productId)?.stock ?? 0) - adjustment.quantity}`
                }
              </Alert>
            )}

            {/* Notes - Full Width */}
            <TextField
              fullWidth
              label="Notes / Reason"
              value={adjustment.notes}
              onChange={(e) => setAdjustment({ ...adjustment, notes: e.target.value })}
              multiline
              rows={3}
              placeholder="e.g., Opening stock, Damaged items, Stock count adjustment..."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => {
              setAdjustmentOpen(false);
              setSelectedProductInfo(null);
              setAdjustment({ productId: '', quantity: 0, type: 'add', notes: '' });
            }} 
            size="large"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAdjustStock}
            disabled={
              !adjustment.productId || 
              adjustment.quantity <= 0 ||
              (adjustment.type === 'subtract' && adjustment.quantity > (products.find(p => p.id === adjustment.productId)?.stock ?? 0))
            }
            size="large"
            color={adjustment.type === 'add' ? 'success' : 'error'}
          >
            {adjustment.type === 'add' ? '+ Add Stock' : '− Subtract Stock'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Inventory History Dialog */}
      <Dialog 
        open={historyOpen} 
        onClose={() => {
          setHistoryOpen(false);
          setHistoryProduct(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" fontWeight="bold">Stock Movement History</Typography>
            {historyProduct && (
              <Typography variant="body2" color="text.secondary">
                {historyProduct.name}
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => {
            setHistoryOpen(false);
            setHistoryProduct(null);
          }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {historyProduct && historyProduct.history.length === 0 ? (
            <Alert severity="info">No stock movements found for this product.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><strong>Date</strong></TableCell>
                  <TableCell><strong>Type</strong></TableCell>
                  <TableCell align="center"><strong>Quantity</strong></TableCell>
                  <TableCell align="right"><strong>Cost Price</strong></TableCell>
                  <TableCell><strong>Notes</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyProduct?.history.map((entry) => {
                  const typeInfo = getTypeInfo(entry.type);
                  return (
                    <TableRow key={entry.id} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(entry.createdAt).toLocaleTimeString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={typeInfo.icon}
                          label={typeInfo.label}
                          size="small"
                          color={typeInfo.color as any}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography 
                          fontWeight="bold"
                          color={entry.quantity > 0 ? 'success.main' : 'error.main'}
                        >
                          {entry.quantity > 0 ? '+' : ''}{entry.quantity}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        Rs {Number(entry.costPrice).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200 }}>
                          {entry.notes || '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          
          {/* Summary */}
          {historyProduct && historyProduct.history.length > 0 && (
            <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">Total In</Typography>
                  <Typography variant="h6" color="success.main" fontWeight="bold">
                    +{historyProduct.history.filter(h => h.quantity > 0).reduce((sum, h) => sum + h.quantity, 0)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">Total Out</Typography>
                  <Typography variant="h6" color="error.main" fontWeight="bold">
                    {historyProduct.history.filter(h => h.quantity < 0).reduce((sum, h) => sum + h.quantity, 0)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">Net Stock</Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {historyProduct.history.reduce((sum, h) => sum + h.quantity, 0)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">Total Transactions</Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {historyProduct.history.length}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => {
            setHistoryOpen(false);
            setHistoryProduct(null);
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

