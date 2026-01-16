import { useAppStore } from '@/store/useStore';

/**
 * Currency mapping - maps currency codes to their symbols
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  PKR: 'Rs.',
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
};

/**
 * Get currency symbol for a given currency code
 */
export function getCurrencySymbol(currency: string = 'PKR'): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

/**
 * Format an amount with currency symbol
 * This function can be used in both client and server components
 */
export function formatCurrency(
  amount: number,
  currency?: string,
  currencySymbol?: string
): string {
  // If currency and symbol are provided, use them directly
  if (currency && currencySymbol) {
    return `${currencySymbol} ${amount.toLocaleString()}`;
  }
  
  // Otherwise, use defaults
  const symbol = currencySymbol || getCurrencySymbol(currency || 'PKR');
  return `${symbol} ${amount.toLocaleString()}`;
}

/**
 * Hook to format currency using store values
 * Use this in client components
 */
export function useFormatCurrency() {
  const { currency, currencySymbol } = useAppStore();
  
  return (amount: number) => formatCurrency(amount, currency, currencySymbol);
}
