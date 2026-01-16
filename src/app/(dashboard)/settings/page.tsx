'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Snackbar,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Store,
  Receipt,
  Backup,
  Restore,
  Security,
  Print,
  Language,
  ColorLens,
  Save,
  CloudUpload,
  CloudDownload,
  Delete,
  Check,
  Download,
  Category,
  LocalOffer,
  Add,
  Edit,
  ExpandMore,
  ExpandLess,
  Folder,
  FolderOpen,
  Inventory,
  People as PeopleIcon,
} from '@mui/icons-material';
import { Grid } from '@mui/material';
import toast from 'react-hot-toast';
import { IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Collapse, TablePagination } from '@mui/material';
import { useAppStore } from '@/store/useStore';
import { getCurrencySymbol } from '@/lib/currency';

interface Settings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  taxEnabled: boolean;
  receiptHeader: string;
  receiptFooter: string;
  lowStockThreshold: number;
  dateFormat: string;
  timeFormat: string;
  language: string;
  theme: string;
  printReceipt: boolean;
  soundEnabled: boolean;
}

interface Backup {
  id: string;
  filename: string;
  type: 'data' | 'full';
  size: number;
  createdAt: string;
}

interface CategoryItem {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  _count: { products: number };
}

interface CategoryStats {
  totalProducts: number;
  uncategorizedProducts: number;
}

interface BrandItem {
  id: string;
  name: string;
  description: string | null;
  _count: { products: number };
}

export default function SettingsPage() {
  const { themeMode, setThemeMode } = useAppStore();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [backups, setBackups] = useState<Backup[]>([]);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);

  // Categories & Brands state
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [brandsPage, setBrandsPage] = useState(0);
  const [brandsRowsPerPage, setBrandsRowsPerPage] = useState(10);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [editingBrand, setEditingBrand] = useState<BrandItem | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', parentId: '' });
  const [brandForm, setBrandForm] = useState({ name: '', description: '' });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryStats, setCategoryStats] = useState<CategoryStats>({ totalProducts: 0, uncategorizedProducts: 0 });

  const [settings, setSettings] = useState<Settings>({
    storeName: '',
    storeAddress: '',
    storePhone: '',
    storeEmail: '',
    currency: 'PKR',
    currencySymbol: 'Rs',
    taxRate: 0,
    taxEnabled: false,
    receiptHeader: '',
    receiptFooter: '',
    lowStockThreshold: 10,
    dateFormat: 'dd/MM/yyyy',
    timeFormat: '12h',
    language: 'en',
    theme: 'light',
    printReceipt: true,
    soundEnabled: true,
  });

  useEffect(() => {
    fetchSettings();
    fetchBackups();
    fetchCategories();
    fetchBrands();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      if (data.settings) {
        // Ensure currencySymbol is set based on currency if not present
        const currency = data.settings.currency || 'PKR';
        const currencySymbol = data.settings.currencySymbol || getCurrencySymbol(currency);
        setSettings({ ...settings, ...data.settings, currency, currencySymbol });
        
        // Also update the app store
        const { setSettings: setStoreSettings } = useAppStore.getState();
        setStoreSettings({ currency, currencySymbol });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchBackups = async () => {
    try {
      const response = await fetch('/api/backups');
      const data = await response.json();
      setBackups(data.backups || []);
    } catch (error) {
      console.error('Error fetching backups:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      setCategories(data.data || []);
      
      // Fetch stats for uncategorized products
      const statsResponse = await fetch('/api/categories/stats');
      const statsData = await statsResponse.json();
      setCategoryStats(statsData);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await fetch('/api/brands');
      const data = await response.json();
      setBrands(data.data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  const handleSaveCategory = async () => {
    try {
      const url = editingCategory ? `/api/categories/${editingCategory.id}` : '/api/categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm),
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Failed to save category');
        return;
      }

      toast.success(editingCategory ? 'Category updated' : 'Category created');
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', parentId: '' });
      fetchCategories();
    } catch (error) {
      toast.error('Failed to save category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || 'Failed to delete category');
        return;
      }

      toast.success('Category deleted');
      fetchCategories();
    } catch (error) {
      toast.error('Failed to delete category');
    }
  };

  const handleSaveBrand = async () => {
    try {
      const url = editingBrand ? `/api/brands/${editingBrand.id}` : '/api/brands';
      const method = editingBrand ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandForm),
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Failed to save brand');
        return;
      }

      toast.success(editingBrand ? 'Brand updated' : 'Brand created');
      setBrandDialogOpen(false);
      setEditingBrand(null);
      setBrandForm({ name: '', description: '' });
      fetchBrands();
    } catch (error) {
      toast.error('Failed to save brand');
    }
  };

  const handleDeleteBrand = async (id: string) => {
    if (!confirm('Are you sure you want to delete this brand?')) return;

    try {
      const res = await fetch(`/api/brands/${id}`, { method: 'DELETE' });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || 'Failed to delete brand');
        return;
      }

      toast.success('Brand deleted');
      fetchBrands();
    } catch (error) {
      toast.error('Failed to delete brand');
    }
  };

  const openCategoryDialog = (category?: CategoryItem) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || '',
        parentId: category.parentId || '',
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', parentId: '' });
    }
    setCategoryDialogOpen(true);
  };

  const toggleCategoryExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Organize categories into hierarchy
  // Parent categories: no parentId OR parentId doesn't match any existing category OR self-reference
  const getParentCategories = () => {
    const allIds = new Set(categories.map(c => c.id));
    return categories.filter(c => 
      !c.parentId || // no parent
      !allIds.has(c.parentId) || // parent doesn't exist  
      c.parentId === c.id // self-reference (treat as top-level)
    );
  };
  
  // Get children for a specific parent (exclude self-references)
  const getChildCategories = (parentId: string) => 
    categories.filter(c => c.parentId === parentId && c.id !== parentId);
  
  // Check if a category has valid children (exclude self-references)
  const hasValidChildren = (categoryId: string) => {
    return categories.some(c => c.parentId === categoryId && c.id !== categoryId);
  };
  
  const getTotalProducts = (categoryId: string): number => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return 0;
    
    const directProducts = category._count.products;
    const children = getChildCategories(categoryId);
    const childProducts = children.reduce((sum, child) => sum + getTotalProducts(child.id), 0);
    
    return directProducts + childProducts;
  };

  const openBrandDialog = (brand?: BrandItem) => {
    if (brand) {
      setEditingBrand(brand);
      setBrandForm({
        name: brand.name,
        description: brand.description || '',
      });
    } else {
      setEditingBrand(null);
      setBrandForm({ name: '', description: '' });
    }
    setBrandDialogOpen(true);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        // Update the app store with new currency settings
        const { setSettings: setStoreSettings, syncCurrencyFromSettings } = useAppStore.getState();
        setStoreSettings({ 
          currency: settings.currency, 
          currencySymbol: settings.currencySymbol 
        });
        setSnackbar({ open: true, message: 'Settings saved successfully!', severity: 'success' });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save settings', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBackup = async (type: 'data' | 'full') => {
    setLoading(true);
    try {
      const response = await fetch('/api/backups', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const result = await response.json();
      
      if (response.ok) {
        const typeLabel = type === 'full' ? 'Full SQL' : 'Data';
        setSnackbar({ open: true, message: `${typeLabel} backup created successfully!`, severity: 'success' });
        fetchBackups();
        setBackupDialogOpen(false);
      } else {
        throw new Error(result.error || 'Failed to create backup');
      }
    } catch (error: any) {
      setSnackbar({ open: true, message: error.message || 'Failed to create backup', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/backups/${selectedBackup.id}/restore`, { method: 'POST' });
      if (response.ok) {
        setSnackbar({ open: true, message: 'Database restored successfully!', severity: 'success' });
        setRestoreDialogOpen(false);
      } else {
        throw new Error('Failed to restore');
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to restore backup', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (backup: Backup) => {
    if (!confirm('Are you sure you want to delete this backup?')) return;

    try {
      const response = await fetch(`/api/backups/${backup.id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchBackups();
        setSnackbar({ open: true, message: 'Backup deleted', severity: 'success' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete backup', severity: 'error' });
    }
  };

  const handleDownloadBackup = async (backup: Backup) => {
    try {
      const response = await fetch(`/api/backups/${backup.id}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSnackbar({ open: true, message: 'Backup downloaded successfully', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to download backup', severity: 'error' });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Settings
        </Typography>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSaveSettings}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="Store Info" icon={<Store />} iconPosition="start" />
          <Tab label="POS Settings" icon={<Receipt />} iconPosition="start" />
          <Tab label="Categories" icon={<Category />} iconPosition="start" />
          <Tab label="Brands" icon={<LocalOffer />} iconPosition="start" />
          <Tab label="User Management" icon={<PeopleIcon />} iconPosition="start" />
          <Tab label="System" icon={<SettingsIcon />} iconPosition="start" />
          <Tab label="Backup & Restore" icon={<Backup />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Store Info Tab */}
      {tabValue === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
            Store Information
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{xs:12, md:6}}>
              <TextField
                fullWidth
                label="Store Name"
                value={settings.storeName}
                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
              />
            </Grid>
            <Grid size={{xs:12, md:6}}>
              <TextField
                fullWidth
                label="Phone"
                value={settings.storePhone}
                onChange={(e) => setSettings({ ...settings, storePhone: e.target.value })}
              />
              </Grid>
            <Grid size={{xs:12, md:6}}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={settings.storeEmail}
                onChange={(e) => setSettings({ ...settings, storeEmail: e.target.value })}
              />
            </Grid>
            <Grid size={{xs:12, md:6}}>
              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select
                  value={settings.currency}
                  label="Currency"
                  onChange={(e) => {
                    const newCurrency = e.target.value;
                    const newSymbol = getCurrencySymbol(newCurrency);
                    setSettings({ ...settings, currency: newCurrency, currencySymbol: newSymbol });
                  }}
                >
                  <MenuItem value="PKR">Pakistani Rupee (Rs)</MenuItem>
                  <MenuItem value="USD">US Dollar ($)</MenuItem>
                  <MenuItem value="EUR">Euro (€)</MenuItem>
                  <MenuItem value="GBP">British Pound (£)</MenuItem>
                  <MenuItem value="INR">Indian Rupee (₹)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{xs:12, md:12}}>
              <TextField
                fullWidth
                label="Address"
                value={settings.storeAddress}
                onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* POS Settings Tab */}
      {tabValue === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
            POS & Receipt Settings
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{xs:12, md:6}}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.taxEnabled}
                    onChange={(e) => setSettings({ ...settings, taxEnabled: e.target.checked })}
                  />
                }
                label="Enable Tax"
              />
            </Grid>
            <Grid size={{xs:12, md:6}}>
              <TextField
                fullWidth
                label="Tax Rate (%)"
                type="number"
                value={settings.taxRate}
                onChange={(e) => setSettings({ ...settings, taxRate: Number(e.target.value) })}
                disabled={!settings.taxEnabled}
              />
            </Grid>
            <Grid size={{xs:12, md:6}}>
              <TextField
                fullWidth
                label="Low Stock Threshold"
                type="number"
                value={settings.lowStockThreshold}
                onChange={(e) => setSettings({ ...settings, lowStockThreshold: Number(e.target.value) })}
                helperText="Alert when stock falls below this level"
              />
            </Grid>
            <Grid size={{xs:12, md:6}}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.printReceipt}
                    onChange={(e) => setSettings({ ...settings, printReceipt: e.target.checked })}
                  />
                }
                label="Auto Print Receipt"
              />
            </Grid>
            <Grid size={{xs:12, md:12}}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                Receipt Customization
              </Typography>
            </Grid>
            <Grid size={{xs:12, md:12}}>
              <TextField
                fullWidth
                label="Receipt Header"
                value={settings.receiptHeader}
                onChange={(e) => setSettings({ ...settings, receiptHeader: e.target.value })}
                multiline
                rows={2}
                placeholder="Text to appear at the top of receipts"
              />
            </Grid>
            <Grid size={{xs:12, md:12}}>
              <TextField
                fullWidth
                label="Receipt Footer"
                value={settings.receiptFooter}
                onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                multiline
                rows={2}
                placeholder="Text to appear at the bottom of receipts (e.g., Thank you message)"
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Categories Tab */}
      {tabValue === 2 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Product Categories
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {categories.length} categories • {categoryStats.totalProducts} total products
                {categoryStats.uncategorizedProducts > 0 && (
                  <Typography component="span" color="warning.main" fontWeight="medium">
                    {' '}• {categoryStats.uncategorizedProducts} uncategorized
                  </Typography>
                )}
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => openCategoryDialog()}
            >
              Add Category
            </Button>
          </Box>

          {categories.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Category sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary">No categories found</Typography>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => openCategoryDialog()}
                sx={{ mt: 2 }}
              >
                Add First Category
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Uncategorized Products */}
              {categoryStats.uncategorizedProducts > 0 && (
                <Card 
                  variant="outlined" 
                  sx={{ 
                    overflow: 'visible',
                    borderColor: 'warning.main',
                    borderStyle: 'dashed',
                    bgcolor: '#fff8e1',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      p: 2,
                    }}
                  >
                    <Box sx={{ width: 32 }} />
                    <Box sx={{ mr: 2 }}>
                      <Category sx={{ color: '#ff9800', fontSize: 28 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight="bold" fontSize={16} color="warning.dark">
                        Uncategorized
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Products without a category assigned
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      icon={<Inventory sx={{ fontSize: 14 }} />}
                      label={`${categoryStats.uncategorizedProducts} products`}
                      color="warning"
                      variant="filled"
                    />
                  </Box>
                </Card>
              )}

              {/* Recursive Category Renderer */}
              {(() => {
                // Recursive function to render a category and its children at any depth
                const renderCategory = (category: CategoryItem, depth: number = 0): React.ReactNode => {
                  const children = getChildCategories(category.id);
                  const hasChildren = hasValidChildren(category.id);
                  const isExpanded = expandedCategories.has(category.id);
                  const totalProducts = getTotalProducts(category.id);
                  
                  // Colors for different depth levels
                  const depthColors = ['#ffc107', '#2196f3', '#9c27b0', '#ff5722', '#4caf50'];
                  const folderColor = depthColors[depth % depthColors.length];
                  const bgColor = depth === 0 ? (hasChildren ? '#f8f9fa' : 'white') : 'transparent';
                  
                  return (
                    <Box key={category.id}>
                      {depth === 0 ? (
                        // Top-level: render as Card
                        <Card variant="outlined" sx={{ overflow: 'visible' }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              p: 2,
                              bgcolor: bgColor,
                              cursor: hasChildren ? 'pointer' : 'default',
                              '&:hover': hasChildren ? { bgcolor: '#f0f1f2' } : {},
                            }}
                            onClick={() => hasChildren && toggleCategoryExpand(category.id)}
                          >
                            {/* Expand Icon */}
                            <Box sx={{ width: 32, display: 'flex', justifyContent: 'center' }}>
                              {hasChildren ? (
                                isExpanded ? <ExpandLess color="action" /> : <ExpandMore color="action" />
                              ) : (
                                <Box sx={{ width: 24 }} />
                              )}
                            </Box>

                            {/* Folder Icon */}
                            <Box sx={{ mr: 2 }}>
                              {hasChildren ? (
                                isExpanded ? (
                                  <FolderOpen sx={{ color: folderColor, fontSize: 28 }} />
                                ) : (
                                  <Folder sx={{ color: folderColor, fontSize: 28 }} />
                                )
                              ) : (
                                <Category sx={{ color: '#4caf50', fontSize: 24 }} />
                              )}
                            </Box>

                            {/* Category Name & Description */}
                            <Box sx={{ flex: 1 }}>
                              <Typography fontWeight="bold" fontSize={16}>
                                {category.name}
                              </Typography>
                              {category.description && (
                                <Typography variant="caption" color="text.secondary">
                                  {category.description}
                                </Typography>
                              )}
                            </Box>

                            {/* Stats */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mr: 2 }}>
                              {hasChildren && (
                                <Chip
                                  size="small"
                                  label={`${children.length} sub`}
                                  color="default"
                                  variant="outlined"
                                />
                              )}
                              <Chip
                                size="small"
                                icon={<Inventory sx={{ fontSize: 14 }} />}
                                label={`${totalProducts} products`}
                                color={totalProducts > 0 ? 'success' : 'default'}
                                variant={totalProducts > 0 ? 'filled' : 'outlined'}
                              />
                            </Box>

                            {/* Actions */}
                            <Box onClick={(e) => e.stopPropagation()}>
                              <IconButton size="small" onClick={() => openCategoryDialog(category)}>
                                <Edit fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteCategory(category.id)}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>

                          {/* Children */}
                          {hasChildren && (
                            <Collapse in={isExpanded}>
                              <Divider />
                              <Box sx={{ pl: 4, pr: 2, py: 1, bgcolor: '#fafafa' }}>
                                {children.map((child) => renderCategory(child, depth + 1))}
                              </Box>
                            </Collapse>
                          )}
                        </Card>
                      ) : (
                        // Nested levels: render as expandable row
                        <Box sx={{ pl: depth * 2 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              py: 1.5,
                              cursor: hasChildren ? 'pointer' : 'default',
                              borderRadius: 1,
                              '&:hover': { bgcolor: '#f5f5f5' },
                            }}
                            onClick={() => hasChildren && toggleCategoryExpand(category.id)}
                          >
                            {/* Connector Line */}
                            <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', mr: 1 }}>
                              <Box
                                sx={{
                                  width: 2,
                                  height: 24,
                                  bgcolor: folderColor,
                                  borderRadius: 1,
                                  opacity: 0.5,
                                }}
                              />
                            </Box>

                            {/* Expand or Icon */}
                            {hasChildren ? (
                              <Box sx={{ mr: 1 }}>
                                {isExpanded ? (
                                  <FolderOpen sx={{ color: folderColor, fontSize: 20 }} />
                                ) : (
                                  <Folder sx={{ color: folderColor, fontSize: 20 }} />
                                )}
                              </Box>
                            ) : (
                              <Category sx={{ color: folderColor, fontSize: 20, mr: 1 }} />
                            )}

                            {/* Name */}
                            <Box sx={{ flex: 1 }}>
                              <Typography fontWeight="medium">{category.name}</Typography>
                              {category.description && (
                                <Typography variant="caption" color="text.secondary">
                                  {category.description}
                                </Typography>
                              )}
                            </Box>

                            {/* Sub count for nested with children */}
                            {hasChildren && (
                              <Chip
                                size="small"
                                label={`${children.length} sub`}
                                color="default"
                                variant="outlined"
                                sx={{ mr: 1 }}
                              />
                            )}

                            {/* Product Count */}
                            <Chip
                              size="small"
                              icon={<Inventory sx={{ fontSize: 14 }} />}
                              label={`${totalProducts}`}
                              color={totalProducts > 0 ? 'primary' : 'default'}
                              variant="outlined"
                              sx={{ mr: 1 }}
                            />

                            {/* Actions */}
                            <Box onClick={(e) => e.stopPropagation()}>
                              <IconButton size="small" onClick={() => openCategoryDialog(category)}>
                                <Edit fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteCategory(category.id)}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>

                          {/* Nested Children (recursive) */}
                          {hasChildren && (
                            <Collapse in={isExpanded}>
                              <Box sx={{ pl: 2 }}>
                                {children.map((child) => renderCategory(child, depth + 1))}
                              </Box>
                            </Collapse>
                          )}
                        </Box>
                      )}
                    </Box>
                  );
                };

                return getParentCategories().map((cat) => renderCategory(cat, 0));
              })()}
            </Box>
          )}
        </Paper>
      )}

      {/* Brands Tab */}
      {tabValue === 3 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" fontWeight="bold">
              Product Brands
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => openBrandDialog()}
            >
              Add Brand
            </Button>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell align="center"><strong>Products</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {brands.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">No brands found</TableCell>
                  </TableRow>
                ) : (
                  brands
                    .slice(brandsPage * brandsRowsPerPage, brandsPage * brandsRowsPerPage + brandsRowsPerPage)
                    .map((brand) => (
                    <TableRow key={brand.id} hover>
                      <TableCell>
                        <Typography fontWeight="medium">{brand.name}</Typography>
                      </TableCell>
                      <TableCell>{brand.description || '-'}</TableCell>
                      <TableCell align="center">
                        <Chip label={brand._count.products} size="small" color="primary" />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => openBrandDialog(brand)}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteBrand(brand.id)}
                        >
                          <Delete fontSize="small" />
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
            count={brands.length}
            page={brandsPage}
            onPageChange={(_, newPage) => setBrandsPage(newPage)}
            rowsPerPage={brandsRowsPerPage}
            onRowsPerPageChange={(e) => {
              setBrandsRowsPerPage(parseInt(e.target.value, 10));
              setBrandsPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </Paper>
      )}

      {/* System Settings Tab */}
      {tabValue === 4 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
            System Preferences
          </Typography>
          <Grid container spacing={3}>
              <Grid size={{xs:12, md:6}}>
              <FormControl fullWidth>
                <InputLabel>Language</InputLabel>
                <Select
                  value={settings.language}
                  label="Language"
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="ur">Urdu</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{xs:12, md:6}}>
              <FormControl fullWidth>
                <InputLabel>Theme</InputLabel>
                <Select
                  value={themeMode}
                  label="Theme"
                  onChange={(e) => setThemeMode(e.target.value as 'light' | 'dark' | 'system')}
                >
                  <MenuItem value="light">Light</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                  <MenuItem value="system">System Default</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Backup & Restore Tab */}
      {tabValue === 5 && (
        <Box>
          <Grid container spacing={3}>
            {/* Data Backup */}
            <Grid size={{xs:12, md:4}}>
              <Paper sx={{ p: 3, height: '100%', border: '2px solid', borderColor: 'primary.main' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box sx={{ p: 1.5, bgcolor: 'primary.50', borderRadius: 2 }}>
                    <CloudUpload color="primary" sx={{ fontSize: 32 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">Data Backup</Typography>
                    <Typography variant="caption" color="text.secondary">
                      .JSON format
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Export all data (products, customers, sales, etc.) to a JSON file. Fast & portable.
                </Typography>
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    ✓ All business data<br/>
                    ✓ Fast export<br/>
                    ✓ Portable format
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<CloudUpload />}
                  onClick={() => handleCreateBackup('data')}
                  fullWidth
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Data Backup'}
                </Button>
              </Paper>
            </Grid>

            {/* Full SQL Backup */}
            <Grid size={{xs:12, md:4}}>
              <Paper sx={{ p: 3, height: '100%', border: '2px solid', borderColor: 'success.main' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box sx={{ p: 1.5, bgcolor: 'success.50', borderRadius: 2 }}>
                    <Backup color="success" sx={{ fontSize: 32 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">Full Backup</Typography>
                    <Typography variant="caption" color="text.secondary">
                      .SQL format
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Complete database dump including schema, data, indexes & constraints.
                </Typography>
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'success.50', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    ✓ Schema + Data<br/>
                    ✓ Indexes & Keys<br/>
                    ✓ Full restoration
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<Backup />}
                  onClick={() => handleCreateBackup('full')}
                  fullWidth
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Full Backup'}
                </Button>
              </Paper>
            </Grid>

            {/* Restore */}
            <Grid size={{xs:12, md:4}}>
              <Paper sx={{ p: 3, height: '100%', border: '2px solid', borderColor: 'warning.main' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box sx={{ p: 1.5, bgcolor: 'warning.50', borderRadius: 2 }}>
                    <Restore color="warning" sx={{ fontSize: 32 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">Restore Backup</Typography>
                    <Typography variant="caption" color="text.secondary">
                      From existing backup
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Restore your database from a previously created backup file.
                </Typography>
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'warning.50', borderRadius: 1 }}>
                  <Typography variant="caption" color="warning.dark">
                    ⚠ Warning: This will<br/>
                    replace current data
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<CloudDownload />}
                  onClick={() => setRestoreDialogOpen(true)}
                  fullWidth
                  disabled={backups.length === 0}
                >
                  Restore from Backup
                </Button>
              </Paper>
            </Grid>
          </Grid>

          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              Available Backups
            </Typography>
            {backups.length === 0 ? (
              <Alert severity="info">No backups available. Create your first backup above.</Alert>
            ) : (
              <List>
                {backups.map((backup) => (
                  <ListItem key={backup.id} divider>
                    <ListItemIcon>
                      <Box sx={{ 
                        p: 1, 
                        borderRadius: 1, 
                        bgcolor: backup.type === 'full' ? 'success.50' : 'primary.50' 
                      }}>
                        {backup.type === 'full' ? (
                          <Backup color="success" />
                        ) : (
                          <CloudUpload color="primary" />
                        )}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {backup.filename}
                          <Box 
                            component="span" 
                            sx={{ 
                              px: 1, 
                              py: 0.25, 
                              borderRadius: 1, 
                              fontSize: '0.7rem',
                              fontWeight: 'bold',
                              bgcolor: backup.type === 'full' ? 'success.main' : 'primary.main',
                              color: 'white',
                            }}
                          >
                            {backup.type === 'full' ? 'SQL' : 'JSON'}
                          </Box>
                        </Box>
                      }
                      secondary={`Size: ${formatFileSize(backup.size)} • Created: ${new Date(backup.createdAt).toLocaleString()}`}
                    />
                    <ListItemSecondaryAction>
                      <Button
                        size="small"
                        color="primary"
                        startIcon={<Download />}
                        onClick={() => handleDownloadBackup(backup)}
                        sx={{ mr: 1 }}
                      >
                        Download
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          setSelectedBackup(backup);
                          setRestoreDialogOpen(true);
                        }}
                        sx={{ mr: 1 }}
                      >
                        Restore
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleDeleteBackup(backup)}
                      >
                        Delete
                      </Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Box>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Backup Progress Dialog */}
      <Dialog open={backupDialogOpen} onClose={() => !loading && setBackupDialogOpen(false)}>
        <DialogTitle>Creating Backup...</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Please wait while your backup is being created.
          </Typography>
          <LinearProgress />
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)}>
        <DialogTitle>Restore Backup</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Warning: Restoring a backup will replace all current data. This action cannot be undone.
          </Alert>
            <FormControl fullWidth>
              <InputLabel>Select Backup</InputLabel>
              <Select
              value={(selectedBackup as Backup | null)?.id ?? ''}
                label="Select Backup"
              onChange={(e) => {
                const backup = backups.find((b) => b.id === e.target.value);
                setSelectedBackup(backup ?? null);
              }}
              >
                {backups.map((backup) => (
                  <MenuItem key={backup.id} value={backup.id}>
                    {backup.filename} ({formatFileSize(backup.size)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          {loading && <LinearProgress sx={{ mt: 2 }} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)} disabled={loading}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleRestoreBackup}
            disabled={loading || !selectedBackup}
          >
            Restore
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCategory ? 'Edit Category' : 'Add Category'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField
              fullWidth
              label="Category Name *"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Parent Category (Optional)</InputLabel>
              <Select
                value={categoryForm.parentId}
                label="Parent Category (Optional)"
                onChange={(e) => setCategoryForm({ ...categoryForm, parentId: e.target.value as string })}
              >
                <MenuItem value="">None (Top Level)</MenuItem>
                {categories
                  .filter(c => c.id !== editingCategory?.id)
                  .map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Description"
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveCategory}
            disabled={!categoryForm.name}
          >
            {editingCategory ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Brand Dialog */}
      <Dialog open={brandDialogOpen} onClose={() => setBrandDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingBrand ? 'Edit Brand' : 'Add Brand'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField
              fullWidth
              label="Brand Name *"
              value={brandForm.name}
              onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
            />
            <TextField
              fullWidth
              label="Description"
              value={brandForm.description}
              onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })}
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBrandDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveBrand}
            disabled={!brandForm.name}
          >
            {editingBrand ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

