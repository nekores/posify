"use client";

import { useState, useEffect } from "react";
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
      Divider,
      Card,
      CardContent,
      MenuItem,
      FormControl,
      InputLabel,
      Select,
      Autocomplete,
      Stack,
      Collapse,
      FormControlLabel,
      Checkbox,
      ToggleButtonGroup,
      ToggleButton,
} from "@mui/material";
import {
      Search,
      Visibility,
      Add,
      Print,
      FileDownload,
      ShoppingBag,
      AccountBalance,
      LocalShipping,
      TrendingDown,
      Delete,
      ExpandMore,
      ExpandLess,
      FilterList,
      Refresh,
      AttachMoney,
      CreditCard,
      AccountBalanceWallet,
      AssignmentReturn,
} from "@mui/icons-material";
import { Grid } from "@mui/material";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Link from "next/link";

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
      supplier: {
            id: string;
            name: string;
            phone: string;
      } | null;
      user: {
            username: string;
      } | null;
      items: PurchaseItem[];
}

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
      stock: number;
}

interface NewPurchaseItem {
      product: Product | null;
      packQty: number;
      unitsInPack: number;
      totalUnits: number;
      unitCost: number;
      packCost: number;
      freightIn: number;
      total: number;
      unitSalePrice: number;
      packSalePrice: number;
}

export default function PurchasesPage() {
      const [purchases, setPurchases] = useState<Purchase[]>([]);
      const [suppliers, setSuppliers] = useState<Supplier[]>([]);
      const [products, setProducts] = useState<Product[]>([]);
      const [loading, setLoading] = useState(true);
      const [page, setPage] = useState(0);
      const [rowsPerPage, setRowsPerPage] = useState(20);
      const [total, setTotal] = useState(0);

      // Filters
      const [filterDate, setFilterDate] = useState("");
      const [filterInvoice, setFilterInvoice] = useState("");
      const [filterSupplier, setFilterSupplier] = useState("");

      // Dialogs
      const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(
            null
      );
      const [detailsOpen, setDetailsOpen] = useState(false);
      const [expandedRow, setExpandedRow] = useState<string | null>(null);

      // Stats
      const [stats, setStats] = useState({
            totalPurchases: 0,
            totalAmount: 0,
            totalPaid: 0,
            totalDue: 0,
      });

      useEffect(() => {
            fetchPurchases();
            fetchSuppliers();
            fetchProducts();
      }, [page, rowsPerPage]);

      const fetchPurchases = async () => {
            try {
                  setLoading(true);
                  const params = new URLSearchParams();
                  params.append("page", (page + 1).toString());
                  params.append("limit", rowsPerPage.toString());
                  if (filterDate) params.append("date", filterDate);
                  if (filterInvoice) params.append("invoiceNo", filterInvoice);
                  if (filterSupplier)
                        params.append("supplierId", filterSupplier);

                  const response = await fetch(
                        `/api/purchases?${params.toString()}`
                  );
                  const data = await response.json();
                  setPurchases(data.data || []);
                  setTotal(data.total || 0);

                  // Calculate stats
                  const allPurchases = data.data || [];
                  setStats({
                        totalPurchases: data.total || 0,
                        totalAmount: allPurchases.reduce(
                              (sum: number, p: Purchase) =>
                                    sum + Number(p.total),
                              0
                        ),
                        totalPaid: allPurchases.reduce(
                              (sum: number, p: Purchase) =>
                                    sum + Number(p.paid),
                              0
                        ),
                        totalDue: allPurchases.reduce(
                              (sum: number, p: Purchase) => sum + Number(p.due),
                              0
                        ),
                  });
            } catch (error) {
                  console.error("Error fetching purchases:", error);
                  toast.error("Failed to fetch purchases");
            } finally {
                  setLoading(false);
            }
      };

      const fetchSuppliers = async () => {
            try {
                  const response = await fetch("/api/suppliers?limit=500");
                  const data = await response.json();
                  setSuppliers(data.data || []);
            } catch (error) {
                  console.error("Error fetching suppliers:", error);
            }
      };

      const fetchProducts = async () => {
            try {
                  const response = await fetch("/api/products?limit=1000");
                  const data = await response.json();
                  setProducts(data.data || []);
            } catch (error) {
                  console.error("Error fetching products:", error);
            }
      };

      const handleFilter = () => {
            setPage(0);
            fetchPurchases();
      };

      const handleResetFilter = () => {
            setFilterDate("");
            setFilterInvoice("");
            setFilterSupplier("");
            setPage(0);
            fetchPurchases();
      };

      const handleViewDetails = (purchase: Purchase) => {
            setSelectedPurchase(purchase);
            setDetailsOpen(true);
      };

      const handleDelete = async (purchase: Purchase) => {
            const isReturn = purchase.isReturn;
            const actionType = isReturn ? "Purchase Return" : "Purchase";

            const confirmMessage =
                  `Are you sure you want to delete ${actionType} "${purchase.invoiceNo}"?\n\n` +
                  `This will:\n` +
                  `• ${isReturn ? "ADD back" : "REMOVE"} ${
                        purchase.items?.reduce(
                              (sum, i) => sum + i.quantity,
                              0
                        ) || 0
                  } units from stock\n` +
                  `• ${
                        isReturn ? "INCREASE" : "DECREASE"
                  } vendor balance by Rs ${Number(
                        isReturn ? purchase.total : purchase.due
                  ).toLocaleString()}\n` +
                  `• Revert any cash transactions\n\n` +
                  `This action cannot be undone!`;

            if (!confirm(confirmMessage)) return;

            try {
                  const res = await fetch(`/api/purchases/${purchase.id}`, {
                        method: "DELETE",
                  });
                  const data = await res.json();

                  if (res.ok) {
                        toast.success(
                              `${actionType} deleted successfully! Stock & finances reverted.`
                        );
                        fetchPurchases();
                  } else {
                        toast.error(data.error || "Failed to delete purchase");
                  }
            } catch (error) {
                  console.error("Error deleting purchase:", error);
                  toast.error("Failed to delete purchase");
            }
      };

      const toggleRowExpand = (id: string) => {
            setExpandedRow(expandedRow === id ? null : id);
      };

      return (
            <Box>
                  {/* Header */}
                  <Box
                        sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              mb: 3,
                        }}>
                        <Typography
                              variant='h4'
                              fontWeight='bold'>
                              Purchase Management
                        </Typography>
                        <Stack
                              direction='row'
                              spacing={2}>
                              <Button
                                    variant='contained'
                                    color='success'
                                    startIcon={<Add />}
                                    component={Link}
                                    href='/purchases/create'
                                    sx={{ borderRadius: 2 }}>
                                    New Purchase
                              </Button>
                              <Button
                                    variant='contained'
                                    color='warning'
                                    startIcon={<AssignmentReturn />}
                                    component={Link}
                                    href='/purchases/return'
                                    sx={{ borderRadius: 2 }}>
                                    Return Purchase
                              </Button>
                              <Button
                                    variant='outlined'
                                    color='inherit'
                                    startIcon={<Refresh />}
                                    onClick={handleResetFilter}
                                    sx={{ borderRadius: 2 }}>
                                    Reset Search
                              </Button>
                        </Stack>
                  </Box>

                  {/* Stats Cards */}
                  <Grid
                        container
                        spacing={3}
                        sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                              <Card
                                    sx={{
                                          background:
                                                "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                          color: "white",
                                          borderRadius: 3,
                                    }}>
                                    <CardContent>
                                          <Box
                                                sx={{
                                                      display: "flex",
                                                      alignItems: "center",
                                                      justifyContent:
                                                            "space-between",
                                                }}>
                                                <Box>
                                                      <Typography
                                                            variant='body2'
                                                            sx={{
                                                                  opacity: 0.8,
                                                            }}>
                                                            Total Purchases
                                                      </Typography>
                                                      <Typography
                                                            variant='h4'
                                                            fontWeight='bold'>
                                                            {
                                                                  stats.totalPurchases
                                                            }
                                                      </Typography>
                                                </Box>
                                                <ShoppingBag
                                                      sx={{
                                                            fontSize: 48,
                                                            opacity: 0.3,
                                                      }}
                                                />
                                          </Box>
                                    </CardContent>
                              </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                              <Card
                                    sx={{
                                          background:
                                                "linear-gradient(135deg, #eb3349 0%, #f45c43 100%)",
                                          color: "white",
                                          borderRadius: 3,
                                    }}>
                                    <CardContent>
                                          <Box
                                                sx={{
                                                      display: "flex",
                                                      alignItems: "center",
                                                      justifyContent:
                                                            "space-between",
                                                }}>
                                                <Box>
                                                      <Typography
                                                            variant='body2'
                                                            sx={{
                                                                  opacity: 0.8,
                                                            }}>
                                                            Total Amount
                                                      </Typography>
                                                      <Typography
                                                            variant='h5'
                                                            fontWeight='bold'>
                                                            Rs{" "}
                                                            {stats.totalAmount.toLocaleString()}
                                                      </Typography>
                                                </Box>
                                                <TrendingDown
                                                      sx={{
                                                            fontSize: 48,
                                                            opacity: 0.3,
                                                      }}
                                                />
                                          </Box>
                                    </CardContent>
                              </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                              <Card
                                    sx={{
                                          background:
                                                "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
                                          color: "white",
                                          borderRadius: 3,
                                    }}>
                                    <CardContent>
                                          <Box
                                                sx={{
                                                      display: "flex",
                                                      alignItems: "center",
                                                      justifyContent:
                                                            "space-between",
                                                }}>
                                                <Box>
                                                      <Typography
                                                            variant='body2'
                                                            sx={{
                                                                  opacity: 0.8,
                                                            }}>
                                                            Total Paid
                                                      </Typography>
                                                      <Typography
                                                            variant='h5'
                                                            fontWeight='bold'>
                                                            Rs{" "}
                                                            {stats.totalPaid.toLocaleString()}
                                                      </Typography>
                                                </Box>
                                                <AccountBalance
                                                      sx={{
                                                            fontSize: 48,
                                                            opacity: 0.3,
                                                      }}
                                                />
                                          </Box>
                                    </CardContent>
                              </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                              <Card
                                    sx={{
                                          background:
                                                "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                                          color: "white",
                                          borderRadius: 3,
                                    }}>
                                    <CardContent>
                                          <Box
                                                sx={{
                                                      display: "flex",
                                                      alignItems: "center",
                                                      justifyContent:
                                                            "space-between",
                                                }}>
                                                <Box>
                                                      <Typography
                                                            variant='body2'
                                                            sx={{
                                                                  opacity: 0.8,
                                                            }}>
                                                            Total Due
                                                      </Typography>
                                                      <Typography
                                                            variant='h5'
                                                            fontWeight='bold'>
                                                            Rs{" "}
                                                            {stats.totalDue.toLocaleString()}
                                                      </Typography>
                                                </Box>
                                                <LocalShipping
                                                      sx={{
                                                            fontSize: 48,
                                                            opacity: 0.3,
                                                      }}
                                                />
                                          </Box>
                                    </CardContent>
                              </Card>
                        </Grid>
                  </Grid>

                  {/* Filters */}
                  <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                        <Grid
                              container
                              spacing={2}
                              alignItems='center'>
                              <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
                                    <TextField
                                          fullWidth
                                          type='date'
                                          label='Date'
                                          value={filterDate}
                                          onChange={(e) =>
                                                setFilterDate(e.target.value)
                                          }
                                          InputLabelProps={{ shrink: true }}
                                          placeholder='Search by date...'
                                    />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <TextField
                                          fullWidth
                                          label='Invoice No'
                                          value={filterInvoice}
                                          onChange={(e) =>
                                                setFilterInvoice(e.target.value)
                                          }
                                          placeholder='Search by invoice number...'
                                    />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
                                    <FormControl fullWidth>
                                          <InputLabel id='supplier-filter-label'>
                                                Vendor
                                          </InputLabel>
                                          <Select
                                                labelId='supplier-filter-label'
                                                value={filterSupplier}
                                                label='Vendor'
                                                onChange={(e) =>
                                                      setFilterSupplier(
                                                            e.target.value
                                                      )
                                                }
                                                MenuProps={{
                                                      PaperProps: {
                                                            sx: {
                                                                  maxHeight: 300,
                                                            },
                                                      },
                                                }}>
                                                <MenuItem value=''>
                                                      All Vendors
                                                </MenuItem>
                                                {suppliers.map((s) => (
                                                      <MenuItem
                                                            key={s.id}
                                                            value={s.id}>
                                                            {s.name}
                                                      </MenuItem>
                                                ))}
                                          </Select>
                                    </FormControl>
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <Button
                                          fullWidth
                                          variant='contained'
                                          onClick={handleFilter}
                                          sx={{
                                                height: 56,
                                                borderRadius: 2,
                                                background:
                                                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                          }}>
                                          Filter
                                    </Button>
                              </Grid>
                        </Grid>
                  </Paper>

                  {/* Purchases Table */}
                  <Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
                        <TableContainer>
                              <Table>
                                    <TableHead>
                                          <TableRow
                                                sx={{
                                                      background:
                                                            "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
                                                }}>
                                                <TableCell
                                                      sx={{
                                                            color: "white",
                                                            fontWeight: "bold",
                                                      }}>
                                                      #
                                                </TableCell>
                                                <TableCell
                                                      sx={{
                                                            color: "white",
                                                            fontWeight: "bold",
                                                      }}>
                                                      DATE
                                                </TableCell>
                                                <TableCell
                                                      sx={{
                                                            color: "white",
                                                            fontWeight: "bold",
                                                      }}>
                                                      INVOICE NO
                                                </TableCell>
                                                <TableCell
                                                      sx={{
                                                            color: "white",
                                                            fontWeight: "bold",
                                                      }}>
                                                      VENDOR
                                                </TableCell>
                                                <TableCell
                                                      sx={{
                                                            color: "white",
                                                            fontWeight: "bold",
                                                      }}
                                                      align='center'>
                                                      IS RETURN
                                                </TableCell>
                                                <TableCell
                                                      sx={{
                                                            color: "white",
                                                            fontWeight: "bold",
                                                      }}
                                                      align='right'>
                                                      NET TOTAL
                                                </TableCell>
                                                <TableCell
                                                      sx={{
                                                            color: "white",
                                                            fontWeight: "bold",
                                                      }}
                                                      align='right'>
                                                      DISCOUNT
                                                </TableCell>
                                                <TableCell
                                                      sx={{
                                                            color: "white",
                                                            fontWeight: "bold",
                                                      }}
                                                      align='right'>
                                                      GRAND TOTAL
                                                </TableCell>
                                                <TableCell
                                                      sx={{
                                                            color: "white",
                                                            fontWeight: "bold",
                                                      }}
                                                      align='right'>
                                                      PAID
                                                </TableCell>
                                                <TableCell
                                                      sx={{
                                                            color: "white",
                                                            fontWeight: "bold",
                                                      }}
                                                      align='right'>
                                                      BALANCE
                                                </TableCell>
                                                <TableCell
                                                      sx={{
                                                            color: "white",
                                                            fontWeight: "bold",
                                                      }}
                                                      align='center'>
                                                      ACTIONS
                                                </TableCell>
                                          </TableRow>
                                    </TableHead>
                                    <TableBody>
                                          {loading ? (
                                                <TableRow>
                                                      <TableCell
                                                            colSpan={11}
                                                            align='center'
                                                            sx={{ py: 5 }}>
                                                            Loading...
                                                      </TableCell>
                                                </TableRow>
                                          ) : purchases.length === 0 ? (
                                                <TableRow>
                                                      <TableCell
                                                            colSpan={11}
                                                            align='center'
                                                            sx={{ py: 5 }}>
                                                            No purchases found
                                                      </TableCell>
                                                </TableRow>
                                          ) : (
                                                purchases.map(
                                                      (purchase, index) => (
                                                            <>
                                                                  <TableRow
                                                                        key={
                                                                              purchase.id
                                                                        }
                                                                        hover>
                                                                        <TableCell>
                                                                              {page *
                                                                                    rowsPerPage +
                                                                                    index +
                                                                                    1}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                              {format(
                                                                                    new Date(
                                                                                          purchase.date
                                                                                    ),
                                                                                    "yyyy-MM-dd"
                                                                              )}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                              <Typography
                                                                                    component={
                                                                                          Link
                                                                                    }
                                                                                    href='#'
                                                                                    onClick={(
                                                                                          e
                                                                                    ) => {
                                                                                          e.preventDefault();
                                                                                          toggleRowExpand(
                                                                                                purchase.id
                                                                                          );
                                                                                    }}
                                                                                    sx={{
                                                                                          color: "primary.main",
                                                                                          textDecoration:
                                                                                                "none",
                                                                                          fontWeight:
                                                                                                "medium",
                                                                                    }}>
                                                                                    {
                                                                                          purchase.invoiceNo
                                                                                    }
                                                                              </Typography>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                              {purchase
                                                                                    .supplier
                                                                                    ?.name ||
                                                                                    "N/A"}
                                                                        </TableCell>
                                                                        <TableCell align='center'>
                                                                              <Chip
                                                                                    label={
                                                                                          purchase.isReturn
                                                                                                ? "YES"
                                                                                                : "NO"
                                                                                    }
                                                                                    size='small'
                                                                                    color={
                                                                                          purchase.isReturn
                                                                                                ? "warning"
                                                                                                : "success"
                                                                                    }
                                                                              />
                                                                        </TableCell>
                                                                        <TableCell align='right'>
                                                                              {Number(
                                                                                    purchase.subtotal
                                                                              ).toLocaleString()}
                                                                        </TableCell>
                                                                        <TableCell align='right'>
                                                                              {Number(
                                                                                    purchase.discount
                                                                              ).toLocaleString()}
                                                                        </TableCell>
                                                                        <TableCell align='right'>
                                                                              <Typography fontWeight='bold'>
                                                                                    {Number(
                                                                                          purchase.total
                                                                                    ).toLocaleString()}
                                                                              </Typography>
                                                                        </TableCell>
                                                                        <TableCell align='right'>
                                                                              <Typography color='success.main'>
                                                                                    {Number(
                                                                                          purchase.paid
                                                                                    ).toLocaleString()}
                                                                              </Typography>
                                                                        </TableCell>
                                                                        <TableCell align='right'>
                                                                              <Typography
                                                                                    color={
                                                                                          Number(
                                                                                                purchase.due
                                                                                          ) >
                                                                                          0
                                                                                                ? "error.main"
                                                                                                : "success.main"
                                                                                    }>
                                                                                    {Number(
                                                                                          purchase.due
                                                                                    ).toLocaleString()}
                                                                              </Typography>
                                                                        </TableCell>
                                                                        <TableCell align='center'>
                                                                              <IconButton
                                                                                    size='small'
                                                                                    color='primary'
                                                                                    onClick={() =>
                                                                                          toggleRowExpand(
                                                                                                purchase.id
                                                                                          )
                                                                                    }>
                                                                                    {expandedRow ===
                                                                                    purchase.id ? (
                                                                                          <ExpandLess />
                                                                                    ) : (
                                                                                          <ExpandMore />
                                                                                    )}
                                                                              </IconButton>
                                                                              <IconButton
                                                                                    size='small'
                                                                                    color='error'
                                                                                    onClick={() =>
                                                                                          handleDelete(
                                                                                                purchase
                                                                                          )
                                                                                    }>
                                                                                    <Delete />
                                                                              </IconButton>
                                                                        </TableCell>
                                                                  </TableRow>
                                                                  {/* Expanded Detail Row */}
                                                                  <TableRow>
                                                                        <TableCell
                                                                              colSpan={
                                                                                    11
                                                                              }
                                                                              sx={{
                                                                                    p: 0,
                                                                                    border: 0,
                                                                              }}>
                                                                              <Collapse
                                                                                    in={
                                                                                          expandedRow ===
                                                                                          purchase.id
                                                                                    }
                                                                                    timeout='auto'
                                                                                    unmountOnExit>
                                                                                    <Box
                                                                                          sx={{
                                                                                                p: 3,
                                                                                                bgcolor: "#f8f9fa",
                                                                                          }}>
                                                                                          <Typography
                                                                                                variant='h6'
                                                                                                fontWeight='bold'
                                                                                                sx={{
                                                                                                      mb: 2,
                                                                                                      display: "flex",
                                                                                                      alignItems:
                                                                                                            "center",
                                                                                                      gap: 1,
                                                                                                }}>
                                                                                                📦
                                                                                                Purchase
                                                                                                Detail
                                                                                          </Typography>

                                                                                          <Grid
                                                                                                container
                                                                                                spacing={
                                                                                                      3
                                                                                                }
                                                                                                sx={{
                                                                                                      mb: 3,
                                                                                                }}>
                                                                                                <Grid
                                                                                                      size={{
                                                                                                            xs: 4,
                                                                                                            sm: 4,
                                                                                                            md: 4,
                                                                                                      }}>
                                                                                                      <Typography
                                                                                                            variant='body2'
                                                                                                            color='text.secondary'>
                                                                                                            INVOICE
                                                                                                            NUMBER
                                                                                                      </Typography>
                                                                                                      <Typography fontWeight='bold'>
                                                                                                            {
                                                                                                                  purchase.invoiceNo
                                                                                                            }
                                                                                                      </Typography>
                                                                                                </Grid>
                                                                                                <Grid
                                                                                                      size={{
                                                                                                            xs: 4,
                                                                                                            sm: 4,
                                                                                                            md: 4,
                                                                                                      }}>
                                                                                                      <Typography
                                                                                                            variant='body2'
                                                                                                            color='text.secondary'>
                                                                                                            PURCHASE
                                                                                                            DATE
                                                                                                      </Typography>
                                                                                                      <Typography fontWeight='bold'>
                                                                                                            {format(
                                                                                                                  new Date(
                                                                                                                        purchase.date
                                                                                                                  ),
                                                                                                                  "yyyy-MM-dd"
                                                                                                            )}
                                                                                                      </Typography>
                                                                                                </Grid>
                                                                                                <Grid
                                                                                                      size={{
                                                                                                            xs: 4,
                                                                                                            sm: 4,
                                                                                                            md: 4,
                                                                                                      }}>
                                                                                                      <Typography
                                                                                                            variant='body2'
                                                                                                            color='text.secondary'>
                                                                                                            VENDOR
                                                                                                            NAME
                                                                                                      </Typography>
                                                                                                      <Typography
                                                                                                            fontWeight='bold'
                                                                                                            color='primary.main'>
                                                                                                            {purchase
                                                                                                                  .supplier
                                                                                                                  ?.name ||
                                                                                                                  "N/A"}
                                                                                                      </Typography>
                                                                                                </Grid>
                                                                                          </Grid>

                                                                                          <Button
                                                                                                variant='outlined'
                                                                                                startIcon={
                                                                                                      <Print />
                                                                                                }
                                                                                                size='small'
                                                                                                sx={{
                                                                                                      mb: 2,
                                                                                                }}>
                                                                                                Print
                                                                                                Invoice
                                                                                          </Button>

                                                                                          <TableContainer
                                                                                                component={
                                                                                                      Paper
                                                                                                }
                                                                                                variant='outlined'>
                                                                                                <Table size='small'>
                                                                                                      <TableHead>
                                                                                                            <TableRow
                                                                                                                  sx={{
                                                                                                                        bgcolor: "#6366f1",
                                                                                                                  }}>
                                                                                                                  <TableCell
                                                                                                                        sx={{
                                                                                                                              color: "white",
                                                                                                                              fontWeight:
                                                                                                                                    "bold",
                                                                                                                        }}>
                                                                                                                        #
                                                                                                                  </TableCell>
                                                                                                                  <TableCell
                                                                                                                        sx={{
                                                                                                                              color: "white",
                                                                                                                              fontWeight:
                                                                                                                                    "bold",
                                                                                                                        }}>
                                                                                                                        PRODUCT
                                                                                                                        NAME
                                                                                                                  </TableCell>
                                                                                                                  <TableCell
                                                                                                                        sx={{
                                                                                                                              color: "white",
                                                                                                                              fontWeight:
                                                                                                                                    "bold",
                                                                                                                        }}
                                                                                                                        align='right'>
                                                                                                                        UNIT
                                                                                                                        COST
                                                                                                                  </TableCell>
                                                                                                                  <TableCell
                                                                                                                        sx={{
                                                                                                                              color: "white",
                                                                                                                              fontWeight:
                                                                                                                                    "bold",
                                                                                                                        }}
                                                                                                                        align='center'>
                                                                                                                        QUANTITY
                                                                                                                  </TableCell>
                                                                                                                  <TableCell
                                                                                                                        sx={{
                                                                                                                              color: "white",
                                                                                                                              fontWeight:
                                                                                                                                    "bold",
                                                                                                                        }}
                                                                                                                        align='right'>
                                                                                                                        DISCOUNT
                                                                                                                  </TableCell>
                                                                                                                  <TableCell
                                                                                                                        sx={{
                                                                                                                              color: "white",
                                                                                                                              fontWeight:
                                                                                                                                    "bold",
                                                                                                                        }}
                                                                                                                        align='right'>
                                                                                                                        FREIGHT
                                                                                                                        IN
                                                                                                                  </TableCell>
                                                                                                                  <TableCell
                                                                                                                        sx={{
                                                                                                                              color: "white",
                                                                                                                              fontWeight:
                                                                                                                                    "bold",
                                                                                                                        }}
                                                                                                                        align='right'>
                                                                                                                        TOTAL
                                                                                                                  </TableCell>
                                                                                                            </TableRow>
                                                                                                      </TableHead>
                                                                                                      <TableBody>
                                                                                                            {purchase.items?.map(
                                                                                                                  (
                                                                                                                        item,
                                                                                                                        idx
                                                                                                                  ) => (
                                                                                                                        <TableRow
                                                                                                                              key={
                                                                                                                                    item.id
                                                                                                                              }>
                                                                                                                              <TableCell>
                                                                                                                                    {idx +
                                                                                                                                          1}
                                                                                                                              </TableCell>
                                                                                                                              <TableCell>
                                                                                                                                    {
                                                                                                                                          item
                                                                                                                                                .product
                                                                                                                                                ?.name
                                                                                                                                    }
                                                                                                                              </TableCell>
                                                                                                                              <TableCell align='right'>
                                                                                                                                    {Number(
                                                                                                                                          item.unitPrice
                                                                                                                                    ).toLocaleString()}
                                                                                                                              </TableCell>
                                                                                                                              <TableCell align='center'>
                                                                                                                                    {
                                                                                                                                          item.quantity
                                                                                                                                    }{" "}
                                                                                                                                    Units
                                                                                                                              </TableCell>
                                                                                                                              <TableCell align='right'>
                                                                                                                                    {Number(
                                                                                                                                          item.discount ||
                                                                                                                                                0
                                                                                                                                    ).toLocaleString()}
                                                                                                                              </TableCell>
                                                                                                                              <TableCell align='right'>
                                                                                                                                    {Number(
                                                                                                                                          item.freightIn ||
                                                                                                                                                0
                                                                                                                                    ).toLocaleString()}
                                                                                                                              </TableCell>
                                                                                                                              <TableCell align='right'>
                                                                                                                                    {Number(
                                                                                                                                          item.total
                                                                                                                                    ).toLocaleString()}
                                                                                                                              </TableCell>
                                                                                                                        </TableRow>
                                                                                                                  )
                                                                                                            )}
                                                                                                            {/* Totals */}
                                                                                                            <TableRow
                                                                                                                  sx={{
                                                                                                                        bgcolor: "#f5f5f5",
                                                                                                                  }}>
                                                                                                                  <TableCell
                                                                                                                        colSpan={
                                                                                                                              3
                                                                                                                        }
                                                                                                                        align='right'>
                                                                                                                        <strong>
                                                                                                                              Total
                                                                                                                        </strong>
                                                                                                                  </TableCell>
                                                                                                                  <TableCell align='center'>
                                                                                                                        <strong>
                                                                                                                              {purchase.items?.reduce(
                                                                                                                                    (
                                                                                                                                          sum,
                                                                                                                                          i
                                                                                                                                    ) =>
                                                                                                                                          sum +
                                                                                                                                          i.quantity,
                                                                                                                                    0
                                                                                                                              )}{" "}
                                                                                                                              Units
                                                                                                                        </strong>
                                                                                                                  </TableCell>
                                                                                                                  <TableCell align='right'>
                                                                                                                        <strong>
                                                                                                                              {purchase.items
                                                                                                                                    ?.reduce(
                                                                                                                                          (
                                                                                                                                                sum,
                                                                                                                                                i
                                                                                                                                          ) =>
                                                                                                                                                sum +
                                                                                                                                                Number(
                                                                                                                                                      i.discount ||
                                                                                                                                                            0
                                                                                                                                                ),
                                                                                                                                          0
                                                                                                                                    )
                                                                                                                                    .toLocaleString()}
                                                                                                                        </strong>
                                                                                                                  </TableCell>
                                                                                                                  <TableCell align='right'>
                                                                                                                        <strong>
                                                                                                                              {purchase.items
                                                                                                                                    ?.reduce(
                                                                                                                                          (
                                                                                                                                                sum,
                                                                                                                                                i
                                                                                                                                          ) =>
                                                                                                                                                sum +
                                                                                                                                                Number(
                                                                                                                                                      i.freightIn ||
                                                                                                                                                            0
                                                                                                                                                ),
                                                                                                                                          0
                                                                                                                                    )
                                                                                                                                    .toLocaleString()}
                                                                                                                        </strong>
                                                                                                                  </TableCell>
                                                                                                                  <TableCell align='right'>
                                                                                                                        <strong>
                                                                                                                              {Number(
                                                                                                                                    purchase.subtotal
                                                                                                                              ).toLocaleString()}
                                                                                                                        </strong>
                                                                                                                  </TableCell>
                                                                                                            </TableRow>
                                                                                                      </TableBody>
                                                                                                </Table>
                                                                                          </TableContainer>

                                                                                          <Paper
                                                                                                variant='outlined'
                                                                                                sx={{
                                                                                                      mt: 2,
                                                                                                      p: 2,
                                                                                                }}>
                                                                                                <Grid
                                                                                                      container
                                                                                                      spacing={
                                                                                                            2
                                                                                                      }>
                                                                                                      <Grid
                                                                                                            size={{
                                                                                                                  xs: 6,
                                                                                                                  sm: 6,
                                                                                                                  md: 6,
                                                                                                            }}>
                                                                                                            <Typography variant='body2'>
                                                                                                                  Current
                                                                                                                  Invoice:
                                                                                                            </Typography>
                                                                                                      </Grid>
                                                                                                      <Grid
                                                                                                            size={{
                                                                                                                  xs: 6,
                                                                                                                  sm: 6,
                                                                                                                  md: 6,
                                                                                                            }}>
                                                                                                            <Typography fontWeight='bold'>
                                                                                                                  {Number(
                                                                                                                        purchase.subtotal
                                                                                                                  ).toLocaleString()}
                                                                                                            </Typography>
                                                                                                      </Grid>
                                                                                                      <Grid
                                                                                                            size={{
                                                                                                                  xs: 6,
                                                                                                                  sm: 6,
                                                                                                                  md: 6,
                                                                                                            }}>
                                                                                                            <Typography variant='body2'>
                                                                                                                  Item
                                                                                                                  Discount:
                                                                                                            </Typography>
                                                                                                      </Grid>
                                                                                                      <Grid
                                                                                                            size={{
                                                                                                                  xs: 6,
                                                                                                                  sm: 6,
                                                                                                                  md: 6,
                                                                                                            }}>
                                                                                                            <Typography fontWeight='bold'>
                                                                                                                  {Number(
                                                                                                                        purchase.discount
                                                                                                                  ).toLocaleString()}
                                                                                                            </Typography>
                                                                                                      </Grid>
                                                                                                      <Grid
                                                                                                            size={{
                                                                                                                  xs: 6,
                                                                                                                  sm: 6,
                                                                                                                  md: 6,
                                                                                                            }}>
                                                                                                            <Typography
                                                                                                                  variant='body2'
                                                                                                                  fontWeight='bold'>
                                                                                                                  Grand
                                                                                                                  Total:
                                                                                                            </Typography>
                                                                                                      </Grid>
                                                                                                      <Grid
                                                                                                            size={{
                                                                                                                  xs: 6,
                                                                                                                  sm: 6,
                                                                                                                  md: 6,
                                                                                                            }}>
                                                                                                            <Typography
                                                                                                                  variant='h6'
                                                                                                                  fontWeight='bold'
                                                                                                                  color='primary.main'>
                                                                                                                  {Number(
                                                                                                                        purchase.total
                                                                                                                  ).toLocaleString()}
                                                                                                            </Typography>
                                                                                                      </Grid>
                                                                                                </Grid>
                                                                                          </Paper>
                                                                                    </Box>
                                                                              </Collapse>
                                                                        </TableCell>
                                                                  </TableRow>
                                                            </>
                                                      )
                                                )
                                          )}
                                    </TableBody>
                              </Table>
                        </TableContainer>
                        <TablePagination
                              component='div'
                              count={total}
                              page={page}
                              onPageChange={(_, newPage) => setPage(newPage)}
                              rowsPerPage={rowsPerPage}
                              onRowsPerPageChange={(e) => {
                                    setRowsPerPage(
                                          parseInt(e.target.value, 10)
                                    );
                                    setPage(0);
                              }}
                              rowsPerPageOptions={[10, 20, 50, 100]}
                        />
                  </Paper>
            </Box>
      );
}
