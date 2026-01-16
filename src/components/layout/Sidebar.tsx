'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  Collapse,
  Avatar,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  PointOfSale as POSIcon,
  Inventory as InventoryIcon,
  Category as CategoryIcon,
  ShoppingCart as SalesIcon,
  ShoppingBag as PurchasesIcon,
  People as CustomersIcon,
  LocalShipping as VendorsIcon,
  Receipt as ExpensesIcon,
  AccountBalance as AccountsIcon,
  Assessment as ReportsIcon,
  Settings as SettingsIcon,
  Backup as BackupIcon,
  Group as UsersIcon,
  Store as StoreIcon,
  ReceiptLong as TaxIcon,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { useState } from 'react';
import { useSession } from 'next-auth/react';

const DRAWER_WIDTH = 260;

interface MenuItem {
  title: string;
  path?: string;
  icon: React.ReactNode;
  children?: MenuItem[];
  roles?: string[];
}

const menuItems: MenuItem[] = [
  {
    title: 'Dashboard',
    path: '/dashboard',
    icon: <DashboardIcon />,
    roles: ['ADMINISTRATOR', 'MANAGER'],
  },
  {
    title: 'POS',
    path: '/pos',
    icon: <POSIcon />,
  },
  {
    title: 'Products',
    path: '/products',
    icon: <InventoryIcon />,
    roles: ['ADMINISTRATOR', 'MANAGER'],
  },
  {
    title: 'Inventory',
    path: '/inventory',
    icon: <CategoryIcon />,
    roles: ['ADMINISTRATOR', 'MANAGER'],
  },
  {
    title: 'Sales',
    path: '/sales',
    icon: <SalesIcon />,
    roles: ['ADMINISTRATOR', 'MANAGER'],
  },
  {
    title: 'Purchases',
    path: '/purchases',
    icon: <PurchasesIcon />,
    roles: ['ADMINISTRATOR', 'MANAGER'],
  },
  {
    title: 'Customers',
    path: '/customers',
    icon: <CustomersIcon />,
    roles: ['ADMINISTRATOR', 'MANAGER'],
  },
  {
    title: 'Vendors',
    path: '/suppliers',
    icon: <VendorsIcon />,
    roles: ['ADMINISTRATOR', 'MANAGER'],
  },
  {
    title: 'Expenses',
    path: '/expenses',
    icon: <ExpensesIcon />,
    roles: ['ADMINISTRATOR', 'MANAGER'],
  },
  {
    title: 'Accounts',
    path: '/accounts',
    icon: <AccountsIcon />,
    roles: ['ADMINISTRATOR', 'MANAGER'],
  },
  {
    title: 'Reports',
    path: '/reports',
    icon: <ReportsIcon />,
    roles: ['ADMINISTRATOR', 'MANAGER'],
  },
  {
    title: 'Tax Management',
    path: '/tax',
    icon: <TaxIcon />,
    roles: ['ADMINISTRATOR', 'MANAGER'],
  },
  {
    title: 'Settings',
    path: '/settings',
    icon: <SettingsIcon />,
    roles: ['ADMINISTRATOR', 'MANAGER'],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  variant?: 'permanent' | 'temporary';
}

export default function Sidebar({ open, onClose, variant = 'permanent' }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const userRole = session?.user?.role || 'USER';

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const canAccess = (item: MenuItem) => {
    if (!item.roles) return true;
    return item.roles.includes(userRole);
  };

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    if (!canAccess(item)) return null;

    const isActive = item.path === pathname;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.title);

    if (hasChildren) {
      return (
        <Box key={item.title}>
          <ListItemButton
            onClick={() => toggleExpand(item.title)}
            sx={{
              pl: 2 + depth * 2,
              borderRadius: 1,
              mx: 1,
              mb: 0.5,
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.title} />
            {isExpanded ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children?.map((child) => renderMenuItem(child, depth + 1))}
            </List>
          </Collapse>
        </Box>
      );
    }

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      if (variant === 'temporary') {
        onClose();
      }
      if (item.path && !isActive) {
        // Navigate immediately - Next.js will handle prefetching
        router.push(item.path);
      }
    };

    return (
      <ListItem key={item.title} disablePadding sx={{ mb: 0.5 }}>
        <ListItemButton
          component={item.path ? 'div' : Link}
          href={item.path || '#'}
          selected={isActive}
          onClick={handleClick}
          sx={{
            pl: 2 + depth * 2,
            borderRadius: 1,
            mx: 1,
            cursor: 'pointer',
            '&.Mui-selected': {
              backgroundColor: 'primary.main',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            },
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
            {item.icon}
          </ListItemIcon>
          <ListItemText primary={item.title} />
        </ListItemButton>
      </ListItem>
    );
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
          <POSIcon />
        </Avatar>
        <Box>
          <Typography variant="h6" fontWeight="bold" color="white">
            Posify
          </Typography>
          <Typography variant="caption" color="grey.400">
            Point of Sale
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

      {/* Menu Items */}
      <List sx={{ flex: 1, py: 2 }}>
        {menuItems.map((item) => renderMenuItem(item))}
      </List>

      {/* User Info */}
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: 'secondary.main' }}>
          {session?.user?.name?.charAt(0) || 'U'}
        </Avatar>
        <Box sx={{ overflow: 'hidden' }}>
          <Typography variant="body2" color="white" noWrap>
            {session?.user?.name || 'User'}
          </Typography>
          <Typography variant="caption" color="grey.400" noWrap>
            {session?.user?.role || 'USER'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: '#1a1a2e',
          color: 'white',
          border: 'none',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}

