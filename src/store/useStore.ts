import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// POS Cart Store
interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
  tax: number;
  total: number;
  maxStock?: number; // Available stock for validation
}

interface HeldSale {
  id: string;
  items: CartItem[];
  customerId: string | null;
  customerName: string;
  discount: number;
  note: string;
  timestamp: Date;
  isCashSale: boolean;
  cashReceived: number;
}

interface POSState {
  cart: CartItem[];
  customerId: string | null;
  customerName: string;
  discount: number;
  discountPercent: number;
  tax: number;
  notes: string;
  paymentType: string;
  amountPaid: number;
  heldSales: HeldSale[];
  
  // Actions
  addToCart: (item: Omit<CartItem, 'id' | 'total'>) => void;
  updateCartItem: (id: string, updates: Partial<CartItem>) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  resetToWalkIn: () => void;
  setCustomer: (id: string | null, name: string) => void;
  setDiscount: (discount: number, percent?: number) => void;
  setNotes: (notes: string) => void;
  setPayment: (type: string, amount: number) => void;
  
  // Held Sales Actions
  holdSale: (note: string, isCashSale: boolean, cashReceived: number) => void;
  resumeSale: (id: string) => HeldSale | undefined;
  deleteHeldSale: (id: string) => void;
  
  // Computed
  getSubtotal: () => number;
  getTotalTax: () => number;
  getTotal: () => number;
  getDue: () => number;
}

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      // Cart state - will be cleared on refresh via partialize
      cart: [],
      customerId: null,
      customerName: 'Walk-in Customer',
      discount: 0,
      discountPercent: 0,
      tax: 0,
      notes: '',
      paymentType: 'cash',
      amountPaid: 0,
      
      // Held sales - will be persisted
      heldSales: [],

      addToCart: (item) => {
        const cart = get().cart;
        const existingIndex = cart.findIndex(i => i.productId === item.productId);
        
        if (existingIndex >= 0) {
          // Update existing item quantity
          const existing = cart[existingIndex];
          const newQty = existing.quantity + item.quantity;
          const total = (item.unitPrice * newQty) - item.discount + item.tax;
          
          set({
            cart: cart.map((i, idx) => 
              idx === existingIndex 
                ? { ...i, quantity: newQty, total }
                : i
            ),
          });
        } else {
          // Add new item
          const total = (item.unitPrice * item.quantity) - item.discount + item.tax;
          set({
            cart: [...cart, { ...item, id: crypto.randomUUID(), total }],
          });
        }
      },

      updateCartItem: (id, updates) => {
        set({
          cart: get().cart.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, ...updates };
            // Recalculate tax if price or quantity changed (tax is per item based on unitPrice * quantity)
            // Note: tax should be recalculated from product taxRate, but we'll preserve it if not provided
            const itemSubtotal = updated.unitPrice * updated.quantity;
            const itemTax = updated.tax || 0; // Keep existing tax if not recalculated
            updated.total = itemSubtotal - updated.discount + itemTax;
            return updated;
          }),
        });
      },

      removeFromCart: (id) => {
        set({ cart: get().cart.filter(item => item.id !== id) });
      },

      clearCart: () => {
        set({
          cart: [],
          customerId: null,
          customerName: 'Walk-in Customer',
          discount: 0,
          discountPercent: 0,
          notes: '',
          amountPaid: 0,
        });
      },
      
      resetToWalkIn: () => {
        set({
          cart: [],
          customerId: null,
          customerName: 'Walk-in Customer',
          discount: 0,
          discountPercent: 0,
          notes: '',
          amountPaid: 0,
          paymentType: 'cash',
        });
      },

      setCustomer: (id, name) => {
        set({ customerId: id, customerName: name });
      },

      setDiscount: (discount, percent = 0) => {
        set({ discount, discountPercent: percent });
      },

      setNotes: (notes) => {
        set({ notes });
      },

      setPayment: (type, amount) => {
        set({ paymentType: type, amountPaid: amount });
      },
      
      // Held Sales Actions
      holdSale: (note, isCashSale, cashReceived) => {
        const { cart, customerId, customerName, discount } = get();
        if (cart.length === 0) return;
        
        const heldSale: HeldSale = {
          id: crypto.randomUUID(),
          items: [...cart],
          customerId,
          customerName,
          discount,
          note,
          timestamp: new Date(),
          isCashSale,
          cashReceived,
        };
        
        set({
          heldSales: [...get().heldSales, heldSale],
          // Clear current cart
          cart: [],
          customerId: null,
          customerName: 'Walk-in Customer',
          discount: 0,
          discountPercent: 0,
          notes: '',
          amountPaid: 0,
        });
      },
      
      resumeSale: (id) => {
        const heldSale = get().heldSales.find(s => s.id === id);
        if (!heldSale) return undefined;
        
        set({
          cart: heldSale.items,
          customerId: heldSale.customerId,
          customerName: heldSale.customerName,
          discount: heldSale.discount,
          heldSales: get().heldSales.filter(s => s.id !== id),
        });
        
        return heldSale; // Return the held sale so caller can restore isCashSale and cashReceived
      },
      
      deleteHeldSale: (id) => {
        set({
          heldSales: get().heldSales.filter(s => s.id !== id),
        });
      },

      getSubtotal: () => {
        // Subtotal is sum of (unitPrice * quantity - discount) for each item (before tax)
        return get().cart.reduce((sum, item) => {
          const itemSubtotal = (item.unitPrice * item.quantity) - item.discount;
          return sum + itemSubtotal;
        }, 0);
      },

      getTotalTax: () => {
        // Total tax is sum of tax from all items
        return get().cart.reduce((sum, item) => sum + item.tax, 0);
      },

      getTotal: () => {
        const subtotal = get().getSubtotal();
        const totalTax = get().getTotalTax();
        const { discount } = get();
        return subtotal - discount + totalTax;
      },

      getDue: () => {
        return get().getTotal() - get().amountPaid;
      },
    }),
    {
      name: 'pos-store',
      // Only persist heldSales, not the cart
      partialize: (state) => ({ heldSales: state.heldSales }),
    }
  )
);

// App Settings Store
type ThemeMode = 'light' | 'dark' | 'system';

interface AppSettings {
  sidebarOpen: boolean;
  darkMode: boolean;
  themeMode: ThemeMode;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setSettings: (settings: Partial<AppSettings>) => void;
}

export const useAppStore = create<AppSettings>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      darkMode: false,
      themeMode: 'light' as ThemeMode,
      currency: 'PKR',
      currencySymbol: 'Rs.',
      taxRate: 0,

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleDarkMode: () => {
        const currentMode = get().themeMode;
        if (currentMode === 'system') {
          // If system, toggle based on current darkMode state
          set((state) => ({ darkMode: !state.darkMode, themeMode: state.darkMode ? 'light' : 'dark' }));
        } else {
          // Toggle between light and dark
          const newMode = currentMode === 'light' ? 'dark' : 'light';
          set({ darkMode: newMode === 'dark', themeMode: newMode });
        }
      },
      setThemeMode: (mode) => {
        if (mode === 'system') {
          // Detect system preference
          const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
          set({ themeMode: mode, darkMode: prefersDark });
        } else {
          set({ themeMode: mode, darkMode: mode === 'dark' });
        }
      },
      setSettings: (settings) => set((state) => ({ ...state, ...settings })),
    }),
    {
      name: 'app-settings',
    }
  )
);

