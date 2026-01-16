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
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Chip,
  Card,
  CardContent,
  Grid,
  Stack,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack,
  Category as TypeIcon,
  Percent as PercentIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface CustomerType {
  id: string;
  name: string;
  discount: number;
  isActive: boolean;
  _count?: {
    customers: number;
  };
}

export default function CustomerTypesPage() {
  const [types, setTypes] = useState<CustomerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<CustomerType | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<CustomerType | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/customer-types');
      const data = await res.json();
      setTypes(data.data || []);
    } catch (error) {
      console.error('Error fetching customer types:', error);
      toast.error('Failed to load customer types');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (type?: CustomerType) => {
    if (type) {
      setEditingType(type);
      setName(type.name);
      setDiscount(Number(type.discount));
      setIsActive(type.isActive);
    } else {
      setEditingType(null);
      setName('');
      setDiscount(0);
      setIsActive(true);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingType(null);
    setName('');
    setDiscount(0);
    setIsActive(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a type name');
      return;
    }

    try {
      const url = editingType
        ? `/api/customer-types/${editingType.id}`
        : '/api/customer-types';
      const method = editingType ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, discount, isActive }),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success(editingType ? 'Customer type updated!' : 'Customer type created!');
      handleCloseDialog();
      fetchTypes();
    } catch (error) {
      console.error('Error saving customer type:', error);
      toast.error('Failed to save customer type');
    }
  };

  const handleDeleteClick = (type: CustomerType) => {
    setTypeToDelete(type);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;

    try {
      const res = await fetch(`/api/customer-types/${typeToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete');
      }

      toast.success('Customer type deleted!');
      setDeleteConfirmOpen(false);
      setTypeToDelete(null);
      fetchTypes();
    } catch (error: any) {
      console.error('Error deleting customer type:', error);
      toast.error(error.message || 'Failed to delete customer type');
    }
  };

  // Predefined suggestions
  const suggestions = [
    { name: 'Walk In', discount: 0 },
    { name: 'Regular', discount: 5 },
    { name: 'Wholesale', discount: 15 },
    { name: 'VIP', discount: 10 },
    { name: 'Dealer', discount: 20 },
    { name: 'Retail', discount: 3 },
  ];

  const handleQuickAdd = async (suggestion: { name: string; discount: number }) => {
    // Check if type already exists
    if (types.some((t) => t.name.toLowerCase() === suggestion.name.toLowerCase())) {
      toast.error(`"${suggestion.name}" type already exists`);
      return;
    }

    try {
      const res = await fetch('/api/customer-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: suggestion.name, discount: suggestion.discount, isActive: true }),
      });

      if (!res.ok) throw new Error('Failed to create');

      toast.success(`"${suggestion.name}" type created!`);
      fetchTypes();
    } catch (error) {
      console.error('Error creating customer type:', error);
      toast.error('Failed to create customer type');
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
            Customer Types
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: 2 }}
        >
          Add Type
        </Button>
      </Box>

      {/* Quick Add Suggestions */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
          💡 Quick Add Common Types
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {suggestions.map((s) => (
            <Chip
              key={s.name}
              label={`${s.name} (${s.discount}% off)`}
              onClick={() => handleQuickAdd(s)}
              icon={<AddIcon />}
              variant="outlined"
              color="primary"
              sx={{ 
                cursor: 'pointer',
                '&:hover': { bgcolor: 'primary.light', color: 'white' },
                mb: 1,
              }}
              disabled={types.some((t) => t.name.toLowerCase() === s.name.toLowerCase())}
            />
          ))}
        </Stack>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
            color: 'white',
            borderRadius: 3 
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Types</Typography>
                  <Typography variant="h3" fontWeight="bold">{types.length}</Typography>
                </Box>
                <TypeIcon sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', 
            color: 'white',
            borderRadius: 3 
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Active Types</Typography>
                  <Typography variant="h3" fontWeight="bold">
                    {types.filter((t) => t.isActive).length}
                  </Typography>
                </Box>
                <PercentIcon sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 
            color: 'white',
            borderRadius: 3 
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Max Discount</Typography>
                  <Typography variant="h3" fontWeight="bold">
                    {types.length > 0 ? Math.max(...types.map((t) => Number(t.discount))) : 0}%
                  </Typography>
                </Box>
                <PercentIcon sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Types Table */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#1a1a2e' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Type Name</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Discount %</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Customers</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Status</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : types.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    <TypeIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                    <Typography color="text.secondary">No customer types found</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Click "Add Type" or use quick add to create types
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                types.map((type, index) => (
                  <TableRow key={type.id} hover>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Typography fontWeight="medium">{type.name}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`${Number(type.discount)}%`}
                        color={Number(type.discount) > 0 ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 'bold', minWidth: 60 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        icon={<PeopleIcon />}
                        label={type._count?.customers || 0}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={type.isActive ? 'Active' : 'Inactive'}
                        color={type.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleOpenDialog(type)}
                        title="Edit"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(type)}
                        title="Delete"
                        disabled={(type._count?.customers || 0) > 0}
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
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TypeIcon />
            {editingType ? 'Edit Customer Type' : 'Create Customer Type'}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Type Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Wholesale, VIP, Regular"
            sx={{ mb: 3 }}
          />
          <TextField
            fullWidth
            label="Discount Percentage"
            type="number"
            value={discount}
            onChange={(e) => setDiscount(Math.max(0, Math.min(100, Number(e.target.value))))}
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
            helperText="Discount will be auto-applied when this customer type is selected"
            sx={{ mb: 3 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                color="success"
              />
            }
            label="Active"
          />

          {/* Preview */}
          <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Preview:
            </Typography>
            <Typography variant="body1">
              <strong>{name || 'Type Name'}</strong> customers will get{' '}
              <Chip
                label={`${discount}% discount`}
                color={discount > 0 ? 'success' : 'default'}
                size="small"
                sx={{ fontWeight: 'bold' }}
              />{' '}
              on all purchases.
            </Typography>
            {discount > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Example: Rs 1,000 → Rs {(1000 - (1000 * discount / 100)).toLocaleString()} 
                (Save Rs {(1000 * discount / 100).toLocaleString()})
              </Typography>
            )}
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog} variant="outlined" sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained" sx={{ borderRadius: 2 }}>
            {editingType ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>
          Delete Customer Type?
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography>
            Are you sure you want to delete <strong>"{typeToDelete?.name}"</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} variant="outlined" sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button onClick={handleDelete} variant="contained" color="error" sx={{ borderRadius: 2 }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

