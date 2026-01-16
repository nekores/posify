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
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Search,
  Add,
  AccountBalance,
  TrendingUp,
  TrendingDown,
  ExpandMore,
  ExpandLess,
  Folder,
  Receipt,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import { format } from 'date-fns';

interface Account {
  id: string;
  code: string;
  name: string;
  groupId: string;
  type: string;
  balance: number;
  isSystem: boolean;
  isActive: boolean;
  group: {
    name: string;
  };
}

interface AccountGroup {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  accounts: Account[];
  children?: AccountGroup[];
}

interface Transaction {
  id: string;
  amount: number;
  description: string | null;
  date: string;
  debitAccount: {
    name: string;
    code: string;
  };
  creditAccount: {
    name: string;
    code: string;
  };
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    groupId: '',
    type: '',
  });

  const [newTransaction, setNewTransaction] = useState({
    debitAccountId: '',
    creditAccountId: '',
    amount: 0,
    description: '',
  });

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      const data = await response.json();
      setAccounts(data.accounts || []);
      setGroups(data.groups || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/transactions');
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleCreateAccount = async () => {
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount),
      });

      if (response.ok) {
        setAccountDialogOpen(false);
        setNewAccount({ code: '', name: '', groupId: '', type: '' });
        fetchAccounts();
      }
    } catch (error) {
      console.error('Error creating account:', error);
    }
  };

  const handleCreateTransaction = async () => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransaction),
      });

      if (response.ok) {
        setTransactionDialogOpen(false);
        setNewTransaction({ debitAccountId: '', creditAccountId: '', amount: 0, description: '' });
        fetchAccounts();
        fetchTransactions();
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'asset':
        return '#4caf50';
      case 'liability':
        return '#f44336';
      case 'equity':
        return '#9c27b0';
      case 'income':
        return '#2196f3';
      case 'expense':
        return '#ff9800';
      default:
        return '#757575';
    }
  };

  const filteredAccounts = accounts.filter((account) =>
    account.name.toLowerCase().includes(search.toLowerCase()) ||
    account.code.toLowerCase().includes(search.toLowerCase())
  );

  const filteredTransactions = transactions.filter((tx) =>
    tx.description?.toLowerCase().includes(search.toLowerCase()) ||
    tx.debitAccount.name.toLowerCase().includes(search.toLowerCase()) ||
    tx.creditAccount.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalAssets = accounts
    .filter((a) => a.type === 'asset')
    .reduce((sum, a) => sum + Number(a.balance), 0);
  const totalLiabilities = accounts
    .filter((a) => a.type === 'liability')
    .reduce((sum, a) => sum + Number(a.balance), 0);
  const totalIncome = accounts
    .filter((a) => a.type === 'income')
    .reduce((sum, a) => sum + Number(a.balance), 0);
  const totalExpenses = accounts
    .filter((a) => a.type === 'expense')
    .reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Accounts & Transactions
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setAccountDialogOpen(true)}
          >
            New Account
          </Button>
          <Button
            variant="contained"
            startIcon={<Receipt />}
            onClick={() => setTransactionDialogOpen(true)}
          >
            New Transaction
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>Total Assets</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    Rs {totalAssets.toLocaleString()}
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
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>Total Liabilities</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    Rs {totalLiabilities.toLocaleString()}
                  </Typography>
                </Box>
                <TrendingDown sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>Total Income</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    Rs {totalIncome.toLocaleString()}
                  </Typography>
                </Box>
                <ArrowUpward sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>Total Expenses</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    Rs {totalExpenses.toLocaleString()}
                  </Typography>
                </Box>
                <ArrowDownward sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Chart of Accounts" icon={<AccountBalance />} iconPosition="start" />
          <Tab label="Transactions" icon={<Receipt />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Search */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          size="small"
          placeholder={tabValue === 0 ? 'Search accounts...' : 'Search transactions...'}
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

      {/* Chart of Accounts */}
      {tabValue === 0 && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><strong>Code</strong></TableCell>
                  <TableCell><strong>Account Name</strong></TableCell>
                  <TableCell><strong>Group</strong></TableCell>
                  <TableCell align="center"><strong>Type</strong></TableCell>
                  <TableCell align="right"><strong>Balance</strong></TableCell>
                  <TableCell align="center"><strong>Status</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">Loading...</TableCell>
                  </TableRow>
                ) : filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No accounts found</TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((account) => (
                    <TableRow key={account.id} hover>
                      <TableCell>
                        <Typography fontWeight="medium">{account.code}</Typography>
                      </TableCell>
                      <TableCell>{account.name}</TableCell>
                      <TableCell>{account.group?.name}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={account.type}
                          size="small"
                          sx={{ backgroundColor: getTypeColor(account.type), color: 'white' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          fontWeight="medium"
                          color={Number(account.balance) < 0 ? 'error.main' : 'inherit'}
                        >
                          Rs {Number(account.balance).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={account.isActive ? 'Active' : 'Inactive'}
                          color={account.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Transactions */}
      {tabValue === 1 && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><strong>Date</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell><strong>Debit Account</strong></TableCell>
                  <TableCell><strong>Credit Account</strong></TableCell>
                  <TableCell align="right"><strong>Amount</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">No transactions found</TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((tx) => (
                    <TableRow key={tx.id} hover>
                      <TableCell>
                        {format(new Date(tx.date), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>{tx.description || '-'}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {tx.debitAccount.name}
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            ({tx.debitAccount.code})
                          </Typography>
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {tx.creditAccount.name}
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            ({tx.creditAccount.code})
                          </Typography>
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="medium">
                          Rs {Number(tx.amount).toLocaleString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredTransactions.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </Paper>
      )}

      {/* New Account Dialog */}
      <Dialog open={accountDialogOpen} onClose={() => setAccountDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Account</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
            <TextField
              fullWidth
              label="Account Code"
              value={newAccount.code}
              onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Account Name"
              value={newAccount.name}
              onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={newAccount.type}
                label="Type"
                onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
              >
                <MenuItem value="asset">Asset</MenuItem>
                <MenuItem value="liability">Liability</MenuItem>
                <MenuItem value="equity">Equity</MenuItem>
                <MenuItem value="income">Income</MenuItem>
                <MenuItem value="expense">Expense</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Group</InputLabel>
              <Select
                value={newAccount.groupId}
                label="Group"
                onChange={(e) => setNewAccount({ ...newAccount, groupId: e.target.value })}
              >
                {groups.map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.name} ({group.type})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccountDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateAccount}
            disabled={!newAccount.code || !newAccount.name || !newAccount.groupId || !newAccount.type}
          >
            Create Account
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Transaction Dialog */}
      <Dialog open={transactionDialogOpen} onClose={() => setTransactionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Transaction</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Debit Account</InputLabel>
              <Select
                value={newTransaction.debitAccountId}
                label="Debit Account"
                onChange={(e) => setNewTransaction({ ...newTransaction, debitAccountId: e.target.value })}
              >
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Credit Account</InputLabel>
              <Select
                value={newTransaction.creditAccountId}
                label="Credit Account"
                onChange={(e) => setNewTransaction({ ...newTransaction, creditAccountId: e.target.value })}
              >
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={newTransaction.amount}
              onChange={(e) => setNewTransaction({ ...newTransaction, amount: Number(e.target.value) })}
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={newTransaction.description}
              onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransactionDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateTransaction}
            disabled={
              !newTransaction.debitAccountId ||
              !newTransaction.creditAccountId ||
              newTransaction.amount <= 0
            }
          >
            Create Transaction
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

