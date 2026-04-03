/** Indian grouping; preserves fractional rupees without forcing 2-decimal rounding. */
export function formatInr(amount: number) {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 10,
  });
}
