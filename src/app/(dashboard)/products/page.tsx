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
  MenuItem,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import Tooltip from '@mui/material/Tooltip';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useFormatCurrency } from '@/lib/currency';
import { useAppStore } from '@/store/useStore';

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  costPrice: z.coerce.number().min(0, 'Cost price must be positive'),
  salePrice: z.coerce.number().min(0, 'Sale price must be positive'),
  minStock: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100),
});

interface CategoryOption {
  id: string;
  name: string;
}

interface BrandOption {
  id: string;
  name: string;
}

type ProductForm = z.infer<typeof productSchema>;

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  taxRate: number;
  category: { name: string } | null;
}

export default function ProductsPage() {
  const formatCurrency = useFormatCurrency();
  const { currencySymbol } = useAppStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [duplicates, setDuplicates] = useState<{
    skuDuplicates: Record<string, string[]>;
    barcodeDuplicates: Record<string, string[]>;
  }>({ skuDuplicates: {}, barcodeDuplicates: {} });
  const [nextBarcode, setNextBarcode] = useState<string>('');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
  });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/products?search=${search}&page=${page + 1}&limit=${rowsPerPage}`
      );
      const data = await res.json();
      const fetchedProducts = data.data || [];
      setProducts(fetchedProducts);
      setTotal(data.total || 0);
      
      // Detect duplicates
      detectDuplicates(fetchedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const detectDuplicates = (productList: Product[]) => {
    const skuMap: Record<string, string[]> = {};
    const barcodeMap: Record<string, string[]> = {};

    productList.forEach((product) => {
      // Check SKU duplicates
      if (product.sku) {
        if (!skuMap[product.sku]) {
          skuMap[product.sku] = [];
        }
        skuMap[product.sku].push(product.name);
      }

      // Check barcode duplicates
      if (product.barcode) {
        if (!barcodeMap[product.barcode]) {
          barcodeMap[product.barcode] = [];
        }
        barcodeMap[product.barcode].push(product.name);
      }
    });

    // Filter to only keep duplicates (more than 1 product with same SKU/barcode)
    const skuDuplicates: Record<string, string[]> = {};
    const barcodeDuplicates: Record<string, string[]> = {};

    Object.entries(skuMap).forEach(([sku, names]) => {
      if (names.length > 1) {
        skuDuplicates[sku] = names;
      }
    });

    Object.entries(barcodeMap).forEach(([barcode, names]) => {
      if (names.length > 1) {
        barcodeDuplicates[barcode] = names;
      }
    });

    setDuplicates({ skuDuplicates, barcodeDuplicates });
  };

  const hasDuplicate = (product: Product) => {
    const hasDupSku = product.sku && duplicates.skuDuplicates[product.sku];
    const hasDupBarcode = product.barcode && duplicates.barcodeDuplicates[product.barcode];
    return hasDupSku || hasDupBarcode;
  };

  const getDuplicateMessage = (product: Product) => {
    const messages: string[] = [];
    if (product.sku && duplicates.skuDuplicates[product.sku]) {
      const otherProducts = duplicates.skuDuplicates[product.sku].filter(n => n !== product.name);
      messages.push(`Duplicate SKU "${product.sku}" also used by: ${otherProducts.join(', ')}`);
    }
    if (product.barcode && duplicates.barcodeDuplicates[product.barcode]) {
      const otherProducts = duplicates.barcodeDuplicates[product.barcode].filter(n => n !== product.name);
      messages.push(`Duplicate Barcode "${product.barcode}" also used by: ${otherProducts.join(', ')}`);
    }
    return messages.join('\n');
  };

  useEffect(() => {
    fetchProducts();
  }, [search, page, rowsPerPage]);

  useEffect(() => {
    fetchCategories();
    fetchBrands();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/brands');
      const data = await res.json();
      setBrands(data.data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  const fetchNextBarcode = async () => {
    try {
      const res = await fetch('/api/products/next-barcode');
      const data = await res.json();
      setNextBarcode(data.nextBarcode || '');
      return data.nextBarcode || '';
    } catch (error) {
      console.error('Error fetching next barcode:', error);
      return '';
    }
  };

  const handleOpenDialog = async (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      reset({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || '',
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        minStock: product.minStock,
        taxRate: Number(product.taxRate) || 0,
      });
    } else {
      // Fetch next barcode for new product
      const barcode = await fetchNextBarcode();
      setEditingProduct(null);
      reset({
        name: '',
        sku: '',
        barcode: barcode,
        costPrice: 0,
        salePrice: 0,
        minStock: 0,
        taxRate: 0,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProduct(null);
    reset();
  };

  const onSubmit = async (data: ProductForm) => {
    try {
      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        // Show specific error message from API
        toast.error(result.error || 'Failed to save product');
        return;
      }

      toast.success(
        editingProduct ? 'Product updated successfully' : 'Product created successfully'
      );
      handleCloseDialog();
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const result = await res.json();
      
      if (!res.ok) {
        toast.error(result.error || 'Failed to delete product');
        return;
      }

      toast.success('Product deleted successfully');
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Products
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Product
        </Button>
      </Box>

      {/* Duplicate Warning Alert */}
      {(Object.keys(duplicates.skuDuplicates).length > 0 || Object.keys(duplicates.barcodeDuplicates).length > 0) && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: '#fff3e0', border: '1px solid #ff9800' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <WarningIcon color="warning" />
            <Typography fontWeight="bold" color="warning.dark">
              Duplicate SKU/Barcode Detected!
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {Object.keys(duplicates.skuDuplicates).length > 0 && (
              <span>
                <strong>Duplicate SKUs:</strong> {Object.keys(duplicates.skuDuplicates).join(', ')}
                <br />
              </span>
            )}
            {Object.keys(duplicates.barcodeDuplicates).length > 0 && (
              <span>
                <strong>Duplicate Barcodes:</strong> {Object.keys(duplicates.barcodeDuplicates).join(', ')}
              </span>
            )}
          </Typography>
        </Paper>
      )}

      <Card>
        <CardContent>
          <TextField
            fullWidth
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 3 }}
          />

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Cost</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="right">Stock</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography fontWeight="medium">{product.name}</Typography>
                          {hasDuplicate(product) && (
                            <Tooltip title={getDuplicateMessage(product)} arrow>
                              <WarningIcon color="warning" fontSize="small" />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {product.sku}
                          {product.sku && duplicates.skuDuplicates[product.sku] && (
                            <Chip label="Dup" size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>{product.category?.name || '-'}</TableCell>
                      <TableCell align="right">{formatCurrency(product.costPrice)}</TableCell>
                      <TableCell align="right">{formatCurrency(product.salePrice)}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={product.stock}
                          size="small"
                          color={
                            product.stock <= 0
                              ? 'error'
                              : product.stock <= product.minStock
                              ? 'warning'
                              : 'success'
                          }
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(product)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(product.id)}
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
          />
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editingProduct ? 'Edit Product' : 'Add Product'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={12}>
                <TextField
                  {...register('name')}
                  label="Product Name"
                  fullWidth
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  {...register('sku')}
                  label="SKU"
                  fullWidth
                  error={!!errors.sku}
                  helperText={errors.sku?.message}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  {...register('barcode')}
                  label="Barcode"
                  fullWidth
                  helperText={!editingProduct ? "Auto-generated. You can change it if needed." : ""}
                />
              </Grid>

              {/* Category and Brand */}
              <Grid size={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Grouping
                </Typography>
              </Grid>
              <Grid size={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    {...register('categoryId')}
                    label="Category"
                    defaultValue={editingProduct?.category?.name ? categories.find(c => c.name === editingProduct?.category?.name)?.id : ''}
                  >
                    <MenuItem value="">None</MenuItem>
                    {categories.map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={6}>
                <FormControl fullWidth>
                  <InputLabel>Brand</InputLabel>
                  <Select
                    {...register('brandId')}
                    label="Brand"
                    defaultValue=""
                  >
                    <MenuItem value="">None</MenuItem>
                    {brands.map((brand) => (
                      <MenuItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Pricing & Stock
                </Typography>
              </Grid>
              <Grid size={6}>
                <TextField
                  {...register('costPrice')}
                  label="Cost Price"
                  type="number"
                  fullWidth
                  error={!!errors.costPrice}
                  helperText={errors.costPrice?.message}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  {...register('salePrice')}
                  label="Sale Price"
                  type="number"
                  fullWidth
                  error={!!errors.salePrice}
                  helperText={errors.salePrice?.message}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  {...register('minStock')}
                  label="Min Stock"
                  type="number"
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  {...register('taxRate')}
                  label="Tax Rate (%)"
                  type="number"
                  fullWidth
                  defaultValue={0}
                  inputProps={{
                    step: '0.01',
                    min: 0,
                    max: 100,
                  }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  helperText="Default: 0% (e.g., 2.5 for 2.5%)"
                  error={!!errors.taxRate}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {editingProduct ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

