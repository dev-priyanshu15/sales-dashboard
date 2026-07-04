// The net_amount formula lives HERE and nowhere else (DRY).
// net = gross * (1 - discount/100), rounded to 2 decimals.
export function computeNetAmount(
  quantity: number,
  unitPrice: number,
  discountPercent: number
): number {
  const gross = quantity * unitPrice;
  const net = gross * (1 - discountPercent / 100);
  return Math.round(net * 100) / 100;
}

// Revenue lost to a discount on a single row.
export function computeDiscountLoss(
  quantity: number,
  unitPrice: number,
  discountPercent: number
): number {
  const gross = quantity * unitPrice;
  return Math.round(gross * (discountPercent / 100) * 100) / 100;
}
