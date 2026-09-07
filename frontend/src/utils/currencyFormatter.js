export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham (AED)' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal (SAR)' },
  { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee (Rs)' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka (৳)' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CA$)' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar (A$)' }
];

export function formatCurrency(amount = 0, currency = { symbol: '₹', code: 'INR' }) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount || 0);
  const formattedNumber = num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  // Extract symbol safely whether currency is an object or string
  let symbol = '₹';
  if (typeof currency === 'string') {
    symbol = currency;
  } else if (currency && currency.symbol) {
    symbol = currency.symbol;
  }

  // Position symbol cleanly (prefix with space for multi-letter codes like AED/SAR/Rs)
  if (symbol.length > 2) {
    return `${symbol} ${formattedNumber}`;
  }
  return `${symbol}${formattedNumber}`;
}
