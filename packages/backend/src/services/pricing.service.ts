import { MAX_PRICE_MULTIPLIER, DEFAULT_COMMISSION_PERCENT } from "@tabang/shared";
import { db } from "../config/firebase";

/**
 * Calculate commission on a given price
 */
export function calculateCommission(
  price: number,
  commissionPercent: number = DEFAULT_COMMISSION_PERCENT
): number {
  return Math.round(price * (commissionPercent / 100));
}

/**
 * Calculate total amount resident pays (price + commission)
 */
export function calculateTotalForResident(
  price: number,
  commissionPercent: number = DEFAULT_COMMISSION_PERCENT
): number {
  return price + calculateCommission(price, commissionPercent);
}

/**
 * Read the current commission percent from system config.
 * Falls back to the shared default when no admin override exists.
 */
export async function getCommissionPercent(): Promise<number> {
  try {
    const pricingConfigDoc = await db
      .collection("systemConfig")
      .doc("pricing")
      .get();

    const configuredPercent = pricingConfigDoc.data()?.commissionPercent;
    if (
      typeof configuredPercent === "number" &&
      Number.isFinite(configuredPercent) &&
      configuredPercent >= 0
    ) {
      return configuredPercent;
    }
  } catch (error) {
    console.error("Failed to load commission percent:", error);
  }

  return DEFAULT_COMMISSION_PERCENT;
}

/**
 * Validate the worker's final price against the PRD rules.
 * Returns whether the price is valid or needs admin approval.
 */
export function validateFinalPrice(
  suggestedPrice: number,
  _minPrice: number,
  finalPrice: number
): { isValid: boolean; requiresApproval: boolean; error?: string } {
  const maxAllowed = suggestedPrice * MAX_PRICE_MULTIPLIER;

  if (finalPrice > maxAllowed) {
    return {
      isValid: false,
      requiresApproval: true,
      error: `Final price above PHP ${maxAllowed} requires admin approval`,
    };
  }

  return { isValid: true, requiresApproval: false };
}

/**
 * Calculate cancellation penalty (20% of initial price, paid to worker)
 */
export function calculateCancellationPenalty(price: number): number {
  return Math.round(price * 0.2);
}
