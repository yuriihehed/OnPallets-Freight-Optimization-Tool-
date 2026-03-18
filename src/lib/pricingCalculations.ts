// LTL Pricing Calculator (2025 Market Rates)

export interface RateCard {
  baseLowRPM: number;  // Rate per mile - low estimate ($/mile)
  baseHighRPM: number; // Rate per mile - high estimate ($/mile)
  fuelSurcharge: number; // Current FSC percentage (0.32 = 32%)
  classMultipliers: Record<number, number>; // Class-specific rate multipliers
  accessorialFees: Record<string, number>; // Flat fees for extra services
}

export interface FreightClassBreakdown {
  class: number;
  weight: number;
}

export interface PriceEstimate {
  baseLow: number;
  baseHigh: number;
  fuelLow: number;
  fuelHigh: number;
  accessorialTotal: number;
  totalLow: number;
  totalHigh: number;
  weightedClass: number;
  details: {
    distance: number;
    totalWeight: number;
    linearFeet: number;
    cubeUtilization: number;
  };
}

export interface BrokeragePriceEstimate extends PriceEstimate {
  brokerageMarkup: number;
  brokerageMarkupPercent: number;
  shipperTotalLow: number;
  shipperTotalHigh: number;
}

export interface FTLQualification {
  isFTL: boolean;
  volumeUtilization: number;
  linearFeet: number;
  weight: number;
  palletCount: number;
  reason: string;
}

export interface FTLPriceEstimate {
  baseLow: number;
  baseHigh: number;
  fuelIncluded: boolean;
  accessorialTotal: number;
  totalLow: number;
  totalHigh: number;
  ratePerMile: number;
  weightTier?: string;
  weightMultiplier?: number;
  details: {
    distance: number;
    totalWeight: number;
    linearFeet: number;
    cubeUtilization: number;
  };
}

// Default 2025 market rate card (industry averages)
export const DEFAULT_RATE_CARD: RateCard = {
  baseLowRPM: 1.80,   // $/mile conservative estimate
  baseHighRPM: 2.60,  // $/mile optimistic estimate
  fuelSurcharge: 0.32, // 32% FSC (current market average)
  classMultipliers: {
    50: 0.65,
    55: 0.70,
    60: 0.75,
    65: 0.80,
    70: 0.85,
    77.5: 0.95,
    85: 1.00,
    92.5: 1.10,
    100: 1.15,
    110: 1.25,
    125: 1.35,
    150: 1.55,
    175: 1.75,
    200: 2.00,
    250: 2.30,
    300: 2.60,
    400: 3.00,
    500: 3.50,
  },
  accessorialFees: {
    liftgate_pickup: 75,
    liftgate_delivery: 75,
    inside_delivery: 125,
    residential_pickup: 85,
    residential_delivery: 100,
    limited_access: 85,
    appointment: 50,
    hazmat: 150,
    notify_before_delivery: 35,
    trade_show: 200,
  },
};

/**
 * Calculate LTL freight price estimate
 */
export const calculateLTLPrice = (
  distance: number, // miles
  totalWeight: number, // lbs
  freightClassBreakdown: FreightClassBreakdown[],
  accessorials: string[], // keys from accessorialFees
  linearFeet: number = 0,
  cubeUtilization: number = 0,
  rateCard: RateCard = DEFAULT_RATE_CARD
): PriceEstimate => {
  // Calculate weighted average class multiplier
  let weightedMultiplier = 1.0;
  let weightedClass = 100;
  
  if (freightClassBreakdown.length > 0) {
    const totalClassWeight = freightClassBreakdown.reduce((sum, item) => sum + item.weight, 0);
    
    weightedMultiplier = freightClassBreakdown.reduce((sum, item) => {
      const multiplier = rateCard.classMultipliers[item.class] || 1.0;
      const weightRatio = item.weight / totalClassWeight;
      return sum + (multiplier * weightRatio);
    }, 0);
    
    weightedClass = freightClassBreakdown.reduce((sum, item) => {
      const weightRatio = item.weight / totalClassWeight;
      return sum + (item.class * weightRatio);
    }, 0);
  }
  
  // Base linehaul calculation
  const baseLow = distance * rateCard.baseLowRPM * weightedMultiplier;
  const baseHigh = distance * rateCard.baseHighRPM * weightedMultiplier;
  
  // Fuel surcharge (percentage of base)
  const fuelLow = baseLow * rateCard.fuelSurcharge;
  const fuelHigh = baseHigh * rateCard.fuelSurcharge;
  
  // Accessorial fees (flat fees)
  const accessorialTotal = accessorials.reduce((sum, key) => {
    return sum + (rateCard.accessorialFees[key] || 0);
  }, 0);
  
  // Total estimates
  const totalLow = baseLow + fuelLow + accessorialTotal;
  const totalHigh = baseHigh + fuelHigh + accessorialTotal;
  
  return {
    baseLow: Math.round(baseLow),
    baseHigh: Math.round(baseHigh),
    fuelLow: Math.round(fuelLow),
    fuelHigh: Math.round(fuelHigh),
    accessorialTotal: Math.round(accessorialTotal),
    totalLow: Math.round(totalLow),
    totalHigh: Math.round(totalHigh),
    weightedClass: Math.round(weightedClass),
    details: {
      distance,
      totalWeight,
      linearFeet,
      cubeUtilization,
    },
  };
};

/**
 * Calculate distance using Haversine formula (great-circle distance)
 * Returns distance in miles with 15% routing factor applied
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  // Apply 15% routing factor for practical road distance
  return Math.round(distance * 1.15);
};

const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Check if load qualifies for Full Truckload (FTL) pricing
 */
export const checkFTLQualification = (
  palletCount: number,
  totalWeight: number,
  linearFeet: number,
  cubeUtilization: number
): FTLQualification => {
  const reasons: string[] = [];
  let isFTL = false;

  // Check multiple criteria for FTL qualification
  if (cubeUtilization >= 80) {
    reasons.push("Volume utilization ≥80%");
    isFTL = true;
  }
  
  if (linearFeet >= 40) {
    reasons.push("Linear feet ≥40ft");
    isFTL = true;
  }
  
  if (totalWeight >= 20000) {
    reasons.push("Weight ≥20,000 lbs");
    isFTL = true;
  }
  
  if (palletCount >= 24) {
    reasons.push("Pallet count ≥24");
    isFTL = true;
  }

  return {
    isFTL,
    volumeUtilization: cubeUtilization,
    linearFeet,
    weight: totalWeight,
    palletCount,
    reason: isFTL ? reasons.join(", ") : "Load does not meet FTL criteria"
  };
};

/**
 * Calculate FTL (Full Truckload) price estimate
 */
export const calculateFTLPrice = (
  distance: number,
  totalWeight: number,
  linearFeet: number,
  cubeUtilization: number,
  accessorials: string[],
  marketMultiplier: number = 1.0,
  rateCard: RateCard = DEFAULT_RATE_CARD
): FTLPriceEstimate => {
  // FTL base rates (flat rate per mile, fuel typically included)
  const baseFTLRatePerMile = 2.00; // National average for dry van
  
  // Weight-based multiplier
  let weightMultiplier = 1.0;
  let weightTier = "medium";
  
  if (totalWeight < 15000) {
    weightMultiplier = 0.85;
    weightTier = "light";
  } else if (totalWeight >= 15000 && totalWeight < 30000) {
    weightMultiplier = 1.0;
    weightTier = "medium";
  } else if (totalWeight >= 30000 && totalWeight < 45000) {
    weightMultiplier = 1.15;
    weightTier = "heavy";
  } else {
    weightMultiplier = 1.30;
    weightTier = "overweight";
  }
  
  // Apply both market and weight multipliers
  let adjustedRate = baseFTLRatePerMile * marketMultiplier * weightMultiplier;
  
  // Short haul premium (< 250 miles)
  if (distance < 250) {
    adjustedRate *= 1.15;
  }
  
  // Calculate base linehaul (low/high estimates)
  const baseLow = Math.round(distance * adjustedRate * 0.90);
  const baseHigh = Math.round(distance * adjustedRate * 1.10);
  
  // Accessorial fees (same as LTL)
  const accessorialTotal = accessorials.reduce((sum, key) => {
    return sum + (rateCard.accessorialFees[key] || 0);
  }, 0);
  
  return {
    baseLow,
    baseHigh,
    fuelIncluded: true,
    accessorialTotal: Math.round(accessorialTotal),
    totalLow: baseLow + accessorialTotal,
    totalHigh: baseHigh + accessorialTotal,
    ratePerMile: adjustedRate,
    weightTier,
    weightMultiplier,
    details: {
      distance,
      totalWeight,
      linearFeet,
      cubeUtilization,
    },
  };
};

/**
 * Calculate brokerage markup and shipper-facing price
 */
export const calculateBrokeragePrice = (
  carrierPrice: PriceEstimate,
  distance: number,
  marketCondition: "normal" | "tight" | "loose" = "normal"
): BrokeragePriceEstimate => {
  // Dynamic markup based on lane characteristics
  let markupPercent = 0.18; // Base 18% markup
  
  // Adjust based on distance (short haul = higher margin)
  if (distance < 250) {
    markupPercent = 0.25; // 25% for short haul
  } else if (distance > 1000) {
    markupPercent = 0.15; // 15% for long haul
  }
  
  // Adjust based on market conditions
  if (marketCondition === "tight") {
    markupPercent += 0.05; // Add 5% in tight markets
  } else if (marketCondition === "loose") {
    markupPercent -= 0.03; // Reduce 3% in loose markets
  }
  
  // Calculate markup amounts
  const markupLow = Math.round(carrierPrice.totalLow * markupPercent);
  const markupHigh = Math.round(carrierPrice.totalHigh * markupPercent);
  
  return {
    ...carrierPrice,
    brokerageMarkup: Math.round((markupLow + markupHigh) / 2),
    brokerageMarkupPercent: Math.round(markupPercent * 100),
    shipperTotalLow: carrierPrice.totalLow + markupLow,
    shipperTotalHigh: carrierPrice.totalHigh + markupHigh,
  };
};

/**
 * Get accessorial fee display name
 */
export const getAccessorialName = (key: string): string => {
  const names: Record<string, string> = {
    liftgate_pickup: "Liftgate at Pickup",
    liftgate_delivery: "Liftgate at Delivery",
    inside_delivery: "Inside Delivery",
    residential_pickup: "Residential Pickup",
    residential_delivery: "Residential Delivery",
    limited_access: "Limited Access",
    appointment: "Appointment Required",
    hazmat: "Hazardous Materials",
    notify_before_delivery: "Notify Before Delivery",
    trade_show: "Trade Show Delivery",
  };
  return names[key] || key;
};
