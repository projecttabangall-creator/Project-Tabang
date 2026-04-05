import { MAX_PRICE_MULTIPLIER, DEFAULT_COMMISSION_PERCENT } from "@tabang/shared";

/**
 * Calculate commission on a given price
 */
export function calculateCommission(price: number): number {
  return Math.round(price * (DEFAULT_COMMISSION_PERCENT / 100));
}

/**
 * Calculate total amount resident pays (price + commission)
 */
export function calculateTotalForResident(price: number): number {
  return price + calculateCommission(price);
}

/**
 * Validate that final price doesn't exceed 2x the suggested price
 * Returns { isValid, requiresApproval }
 */
export function validateFinalPrice(
  suggestedPrice: number,
  finalPrice: number
): { isValid: boolean; requiresApproval: boolean } {
  const maxAllowed = suggestedPrice * MAX_PRICE_MULTIPLIER;

  if (finalPrice > maxAllowed) {
    return { isValid: false, requiresApproval: true };
  }

  if (finalPrice < suggestedPrice) {
    return { isValid: false, requiresApproval: false }; // Price can't be lower than suggested
  }

  return { isValid: true, requiresApproval: false };
}

/**
 * Calculate cancellation penalty (20% of initial price, paid to worker)
 */
export function calculateCancellationPenalty(price: number): number {
  return Math.round(price * 0.2);
}
