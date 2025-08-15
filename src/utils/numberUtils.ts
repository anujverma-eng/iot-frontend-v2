/**
 * Utility functions for safe number operations across the application
 */

/**
 * Safely converts a value to a number and formats it with toFixed.
 * Handles cases where the value might be a string, null, undefined, or NaN.
 * 
 * @param value - The value to convert and format
 * @param decimals - Number of decimal places (default: 4)
 * @param fallback - Fallback value if conversion fails (default: '0.0000')
 * @returns Formatted number string
 */
export function safeToFixed(value: any, decimals: number = 4, fallback: string = '0.0000'): string {
  // Handle null, undefined, or empty values
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  // Convert to number if it's a string
  const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);

  // Check if the conversion resulted in a valid number
  if (isNaN(numValue) || !isFinite(numValue)) {
    return fallback;
  }

  return numValue.toFixed(decimals);
}

/**
 * Safely converts a value to a number.
 * Handles cases where the value might be a string, null, undefined, or NaN.
 * 
 * @param value - The value to convert
 * @param fallback - Fallback value if conversion fails (default: 0)
 * @returns Converted number
 */
export function safeToNumber(value: any, fallback: number = 0): number {
  // Handle null, undefined, or empty values
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  // Convert to number if it's a string
  const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);

  // Check if the conversion resulted in a valid number
  if (isNaN(numValue) || !isFinite(numValue)) {
    return fallback;
  }

  return numValue;
}

/**
 * Safely formats a numeric value for display.
 * Combines safeToNumber and toFixed with additional formatting options.
 * 
 * @param value - The value to format
 * @param decimals - Number of decimal places (default: 4)
 * @param unit - Optional unit to append (default: '')
 * @param fallback - Fallback display value (default: 'N/A')
 * @returns Formatted display string
 */
export function formatNumericValue(
  value: any, 
  decimals: number = 4, 
  unit: string = '', 
  fallback: string = 'N/A'
): string {
  const numValue = safeToNumber(value);
  
  if (numValue === 0 && (value === null || value === undefined || value === '')) {
    return fallback;
  }

  const formatted = numValue.toFixed(decimals);
  return unit ? `${formatted} ${unit}` : formatted;
}
