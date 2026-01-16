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
  Button,
  Card,
  CardContent,
  Collapse,
  Skeleton,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
  ArrowBack,
  Print,
  LocalShipping,
  AccountBalance,
  Phone,
  Email,
  ExpandMore,
  ExpandLess,
  ShoppingBag,
  Payment,
  Receipt,
} from '@mui/icons-material';
import { format } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface PurchaseItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  freightIn: number;
  total: number;
  product: {
    name: string;
    sku: string;
  };
}

interface Purchase {
  id: string;
  invoiceNo: string;
  supplierId: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  due: number;
  status: string;
  isReturn: boolean;
  notes: string | null;
  date: string;
  createdAt: string;
  items: PurchaseItem[];
}

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  balance: number;
  isActive: boolean;
  createdAt: string;
}


export default function VendorDetailPage({ params }: { params: { id: string } }) {
  const supplierId = params.id;
  
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Stats
  const [stats, setStats] = useState({
    totalPurchases: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalDue: 0,
    totalReturns: 0,
  });

  useEffect(() => {
    if (supplierId) {
      fetchSupplierData();
    }
  }, [supplierId]);

  const fetchSupplierData = async () => {
    try {
      setLoading(true);
      
      // Fetch supplier details
      const supplierRes = await fetch(`/api/suppliers/${supplierId}`);
      const supplierData = await supplierRes.json();
      
      if (supplierRes.ok) {
        setSupplier(supplierData.supplier || supplierData.data || supplierData);
      } else {
        toast.error('Failed to load vendor details');
        return;
      }

      // Fetch purchases for this supplier
      const purchasesRes = await fetch(`/api/purchases?supplierId=${supplierId}&limit=1000`);
      const purchasesData = await purchasesRes.json();
      const allPurchases = purchasesData.data || [];
      setPurchases(allPurchases);

      // Calculate stats
      const regularPurchases = allPurchases.filter((p: Purchase) => !p.isReturn);
      const returns = allPurchases.filter((p: Purchase) => p.isReturn);
      
      setStats({
        totalPurchases: regularPurchases.length,
        totalAmount: regularPurchases.reduce((sum: number, p: Purchase) => sum + Number(p.total), 0),
        totalPaid: regularPurchases.reduce((sum: number, p: Purchase) => sum + Number(p.paid), 0),
        totalDue: regularPurchases.reduce((sum: number, p: Purchase) => sum + Number(p.due), 0),
        totalReturns: returns.length,
      });


    } catch (error) {
      console.error('Error fetching vendor data:', error);
      toast.error('Failed to load vendor data');
    } finally {
      setLoading(false);
    }
  };

  const toggleRowExpand = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const paginatedPurchases = purchases.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton component={Link} href="/suppliers">
            <ArrowBack />
          </IconButton>
          <Skeleton variant="text" width={300} height={40} />
        </Box>
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {[1, 2].map((i) => (
            <Grid size={{xs:12, md:6}} key={i}>
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, mb: 3 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (!supplier) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton component={Link} href="/suppliers">
            <ArrowBack />
          </IconButton>
          <Typography variant="h4">Vendor not found</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton component={Link} href="/suppliers">
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" fontWeight="bold">
            {supplier.name}
          </Typography>
          <Chip
            label={supplier.isActive ? 'Active' : 'Inactive'}
            color={supplier.isActive ? 'success' : 'default'}
            size="small"
          />
        </Box>
        {Number(supplier.balance) > 0 && (
          <Button
            variant="contained"
            color="warning"
            startIcon={<Payment />}
            component={Link}
            href={`/suppliers/pay?supplierId=${supplier.id}`}
            sx={{ borderRadius: 2 }}
          >
            Pay Vendor
          </Button>
        )}
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{xs:12, sm:6, md:6}}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', 
            color: 'white',
            borderRadius: 3,
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>TOTAL BALANCE</Typography>
                  <Typography variant="h3" fontWeight="bold">
                    {Number(supplier.balance) > 0 ? `Rs ${Number(supplier.balance).toLocaleString()}` : '0'}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
                    {Number(supplier.balance) > 0 ? 'Amount Payable' : 'No outstanding balance'}
                  </Typography>
                </Box>
                <AccountBalance sx={{ fontSize: 64, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{xs:12, sm:6, md:6}}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
            color: 'white',
            borderRadius: 3,
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>TOTAL PURCHASES</Typography>
                  <Typography variant="h3" fontWeight="bold">
                    Rs {stats.totalAmount.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
                    {stats.totalPurchases} purchases | {stats.totalReturns} returns
                  </Typography>
                </Box>
                <ShoppingBag sx={{ fontSize: 64, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Vendor Info Card */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalShipping color="primary" /> Vendor Information
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{xs:12, md:6}}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Vendor Name:</Typography>
                <Typography variant="body1" fontWeight="medium">{supplier.name}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Vendor Address:</Typography>
                <Typography variant="body1" fontWeight="medium">
                  {supplier.address ? `${supplier.address}${supplier.city ? `, ${supplier.city}` : ''}` : '-'}
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid size={{xs:12, md:6}}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Phone fontSize="small" color="action" />
                <Box>
                  <Typography variant="body2" color="text.secondary">Mobile#:</Typography>
                  <Typography variant="body1" fontWeight="medium">{supplier.phone || '-'}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Email fontSize="small" color="action" />
                <Box>
                  <Typography variant="body2" color="text.secondary">Email:</Typography>
                  <Typography variant="body1" fontWeight="medium">{supplier.email || '-'}</Typography>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Vendor Ledger */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        <Box sx={{ 
          p: 2, 
          bgcolor: 'warning.light',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Receipt /> Vendor Ledger
          </Typography>
          <Typography variant="body2">
            Showing {purchases.length} of {purchases.length} items
          </Typography>
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>DATE</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>INVOICE NO</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">IS RETURN</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">NET TOTAL</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">DISCOUNT</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">GRAND TOTAL</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">PAID</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">BALANCE</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedPurchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 5 }}>
                    No purchases found for this vendor
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPurchases.map((purchase, index) => (
                  <>
                    <TableRow key={purchase.id} hover>
                      <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                      <TableCell>{format(new Date(purchase.date), 'yyyy-MM-dd')}</TableCell>
                      <TableCell>
                        <Typography 
                          component="span"
                          onClick={() => toggleRowExpand(purchase.id)}
                          sx={{ 
                            color: 'primary.main', 
                            textDecoration: 'none', 
                            fontWeight: 'medium',
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                        >
                          {purchase.invoiceNo}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={purchase.isReturn ? 'YES' : 'NO'} 
                          size="small" 
                          color={purchase.isReturn ? 'warning' : 'success'}
                        />
                      </TableCell>
                      <TableCell align="right">{Number(purchase.subtotal).toLocaleString()}</TableCell>
                      <TableCell align="right">{Number(purchase.discount).toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">{Number(purchase.total).toLocaleString()}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="success.main">{Number(purchase.paid).toLocaleString()}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography color={Number(purchase.due) > 0 ? 'error.main' : 'success.main'}>
                          {Number(purchase.due).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => toggleRowExpand(purchase.id)}
                        >
                          {expandedRow === purchase.id ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Detail Row */}
                    <TableRow>
                      <TableCell colSpan={10} sx={{ p: 0, border: 0 }}>
                        <Collapse in={expandedRow === purchase.id} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 3, bgcolor: '#f8f9fa' }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                              📦 Purchase Detail
                            </Typography>
                            
                            <Grid container spacing={3} sx={{ mb: 3 }}>
                              <Grid size={{xs:4, sm:4, md:4}}>
                                <Typography variant="body2" color="text.secondary">INVOICE NUMBER</Typography>
                                <Typography fontWeight="bold">{purchase.invoiceNo}</Typography>
                              </Grid>
                              <Grid size={{xs:4, sm:4, md:4}}>
                                <Typography variant="body2" color="text.secondary">PURCHASE DATE</Typography>
                                <Typography fontWeight="bold">{format(new Date(purchase.date), 'yyyy-MM-dd')}</Typography>
                              </Grid>
                              <Grid size={{xs:4, sm:4, md:4}}>
                                <Typography variant="body2" color="text.secondary">VENDOR NAME</Typography>
                                <Typography fontWeight="bold" color="primary.main">
                                  {supplier.name}
                                </Typography>
                              </Grid>
                            </Grid>

                            <Button variant="outlined" startIcon={<Print />} size="small" sx={{ mb: 2 }}>
                              Print Invoice
                            </Button>

                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ bgcolor: '#6366f1' }}>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>#</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>PRODUCT NAME</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">UNIT COST</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">QUANTITY</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">DISCOUNT</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">FREIGHT IN</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">TOTAL</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {purchase.items?.map((item, idx) => (
                                    <TableRow key={item.id}>
                                      <TableCell>{idx + 1}</TableCell>
                                      <TableCell>{item.product?.name}</TableCell>
                                      <TableCell align="right">{Number(item.unitPrice).toLocaleString()}</TableCell>
                                      <TableCell align="center">{item.quantity} Units</TableCell>
                                      <TableCell align="right">{Number(item.discount || 0).toLocaleString()}</TableCell>
                                      <TableCell align="right">{Number(item.freightIn || 0).toLocaleString()}</TableCell>
                                      <TableCell align="right">{Number(item.total).toLocaleString()}</TableCell>
                                    </TableRow>
                                  ))}
                                  {/* Totals */}
                                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                    <TableCell colSpan={3} align="right"><strong>Total</strong></TableCell>
                                    <TableCell align="center">
                                      <strong>{purchase.items?.reduce((sum, i) => sum + i.quantity, 0)} Units</strong>
                                    </TableCell>
                                    <TableCell align="right">
                                      <strong>{purchase.items?.reduce((sum, i) => sum + Number(i.discount || 0), 0).toLocaleString()}</strong>
                                    </TableCell>
                                    <TableCell align="right">
                                      <strong>{purchase.items?.reduce((sum, i) => sum + Number(i.freightIn || 0), 0).toLocaleString()}</strong>
                                    </TableCell>
                                    <TableCell align="right">
                                      <strong>{Number(purchase.subtotal).toLocaleString()}</strong>
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </TableContainer>

                            <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
                              <Grid container spacing={2}>
                                <Grid size={{xs:6, sm:6, md:6}}>
                                  <Typography variant="body2">Current Invoice:</Typography>
                                </Grid>
                                <Grid size={{xs:6, sm:6, md:6}}>
                                  <Typography fontWeight="bold">{Number(purchase.subtotal).toLocaleString()}</Typography>
                                </Grid>
                                <Grid size={{xs:6, sm:6, md:6}}>
                                  <Typography variant="body2">Item Discount:</Typography>
                                </Grid>
                                <Grid size={{xs:6, sm:6, md:6}}>
                                  <Typography fontWeight="bold">{Number(purchase.discount).toLocaleString()}</Typography>
                                </Grid>
                                <Grid size={{xs:6, sm:6, md:6}}>
                                  <Typography variant="body2" fontWeight="bold">Grand Total:</Typography>
                                </Grid>
                                  <Grid size={{xs:6, sm:6, md:6}}>
                                  <Typography variant="h6" fontWeight="bold" color="primary.main">
                                    {Number(purchase.total).toLocaleString()}
                                  </Typography>
                                </Grid>
                              </Grid>
                            </Paper>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={purchases.length}
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
    </Box>
  );
}

