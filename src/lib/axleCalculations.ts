import { PalletData } from "@/components/PalletInputForm";

// Trailer and axle constants
export const TRAILER_LENGTH = 636; // inches
export const TRAILER_WIDTH = 102; // inches
export const TRAILER_HEIGHT = 110; // inches
export const CLEARANCE = 2; // inches
export const MAX_WEIGHT = 45000; // lbs
export const MAX_DRIVE_AXLE = 34000; // lbs
export const MAX_TRAILER_AXLE = 34000; // lbs

// Axle positions (simplified model)
const KINGPIN_POSITION = 36; // inches from front of trailer
const TRAILER_TANDEM_POSITION = 492; // inches from front (41 feet)
const TRACTOR_TRAILER_TARE = 30000; // lbs (empty tractor + trailer weight)

interface PlacedPallet {
  pallet: PalletData;
  xPos: number; // inches from front of trailer
  zPos: number; // inches from centerline (+ is right, - is left)
  isStacked: boolean; // This pallet is stacked ON another pallet
  hasStackedPallet: boolean; // This base pallet HAS another pallet stacked on it
  exceedsCapacity: boolean; // true if pallet extends beyond trailer length
}

interface AxleWeights {
  driveAxle: number;
  trailerAxle: number;
  totalWeight: number;
  driveOverage: number;
  trailerOverage: number;
  isValid: boolean;
}

export const calculateAxleWeights = (placedPallets: PlacedPallet[]): AxleWeights => {
  const totalPalletWeight = placedPallets.reduce((sum, p) => sum + p.pallet.weight, 0);
  const totalWeight = totalPalletWeight + TRACTOR_TRAILER_TARE;
  
  // Simplified beam model: calculate moments around kingpin and trailer tandem
  let driveAxleLoad = TRACTOR_TRAILER_TARE * 0.4; // 40% of tare on drive axle
  let trailerAxleLoad = TRACTOR_TRAILER_TARE * 0.6; // 60% of tare on trailer axle
  
  // Distance between axles
  const axleDistance = TRAILER_TANDEM_POSITION - KINGPIN_POSITION;
  
  placedPallets.forEach(({ pallet, xPos }) => {
    // Calculate load distribution based on position
    const distanceFromKingpin = xPos - KINGPIN_POSITION;
    const distanceFromTrailerTandem = xPos - TRAILER_TANDEM_POSITION;
    
    if (xPos < KINGPIN_POSITION) {
      // Load in front of kingpin (rare) - mostly on drive axle
      driveAxleLoad += pallet.weight * 0.9;
      trailerAxleLoad += pallet.weight * 0.1;
    } else if (xPos > TRAILER_TANDEM_POSITION) {
      // Load behind trailer tandem - mostly on trailer axle
      const leverArm = distanceFromTrailerTandem / axleDistance;
      trailerAxleLoad += pallet.weight * (1 + leverArm * 0.3);
      driveAxleLoad -= pallet.weight * leverArm * 0.3;
    } else {
      // Load between axles - distribute proportionally
      const trailerRatio = distanceFromKingpin / axleDistance;
      trailerAxleLoad += pallet.weight * trailerRatio;
      driveAxleLoad += pallet.weight * (1 - trailerRatio);
    }
  });
  
  const driveOverage = Math.max(0, driveAxleLoad - MAX_DRIVE_AXLE);
  const trailerOverage = Math.max(0, trailerAxleLoad - MAX_TRAILER_AXLE);
  
  return {
    driveAxle: Math.round(driveAxleLoad),
    trailerAxle: Math.round(trailerAxleLoad),
    totalWeight: Math.round(totalWeight),
    driveOverage: Math.round(driveOverage),
    trailerOverage: Math.round(trailerOverage),
    isValid: driveAxleLoad <= MAX_DRIVE_AXLE && trailerAxleLoad <= MAX_TRAILER_AXLE && totalWeight <= MAX_WEIGHT,
  };
};

// Helper function to determine optimal pallet orientation
const chooseOrientation = (pallet: PalletData) => {
  const innerWidth = TRAILER_WIDTH; // No clearance enforcement in calculations
  
  // Check if 2 pallets fit side-by-side in original orientation
  const can2Original = (pallet.width * 2) <= innerWidth;
  
  // Check if 2 pallets fit side-by-side when rotated
  const can2Rotated = (pallet.length * 2) <= innerWidth;
  
  // Prefer orientation that:
  // 1. Allows 2 side-by-side
  // 2. Uses shorter dimension along trailer length
  // When 2 pallets can fit side-by-side in original orientation, use shorter dimension along trailer
  const shouldRotate = can2Original && pallet.length > pallet.width;
  
  return {
    L: shouldRotate ? pallet.width : pallet.length,  // Along trailer
    W: shouldRotate ? pallet.length : pallet.width,  // Across trailer
    canFit2: shouldRotate ? can2Rotated : can2Original,
  };
};

export const calculatePlacedPallets = (pallets: PalletData[]): PlacedPallet[] => {
  const placed: PlacedPallet[] = [];
  let currentLength = 0; // No clearance at front
  let lastRowPallets: PlacedPallet[] = [];
  
  pallets.forEach((pallet) => {
    const isHeavy = pallet.weight > 3000;
    const orientation = chooseOrientation(pallet);
    const { L, W, canFit2 } = orientation;
    
    // Check if can stack
    let stackedOn: PlacedPallet | null = null;
    if (pallet.allowDoubleStack && lastRowPallets.length > 0) {
      stackedOn = lastRowPallets.find(prev => {
        const prevOrientation = chooseOrientation(prev.pallet);
        const dimensionsMatch = 
          Math.abs(prevOrientation.L - L) < 6 &&
          Math.abs(prevOrientation.W - W) < 6;
        const weightSafe = prev.pallet.weight + pallet.weight <= 5000;
        // KEY FIX: Check if base pallet doesn't already have a pallet stacked on it
        return prev.pallet.allowDoubleStack && dimensionsMatch && weightSafe && !prev.hasStackedPallet;
      }) || null;
    }
    
    let xPos: number, zPos: number;
    
    if (stackedOn) {
      xPos = stackedOn.xPos;
      zPos = stackedOn.zPos;
      const exceedsCapacity = (xPos + L / 2) > TRAILER_LENGTH;
      // Mark the base pallet as having something stacked on it
      stackedOn.hasStackedPallet = true;
      placed.push({ pallet, xPos, zPos, isStacked: true, hasStackedPallet: false, exceedsCapacity });
    } else {
      // Start new row if needed
      if (lastRowPallets.length > 0 && (isHeavy || !canFit2 || lastRowPallets.length >= 2)) {
        const lastRowLength = Math.max(...lastRowPallets.map(p => {
          const prevOrientation = chooseOrientation(p.pallet);
          return prevOrientation.L;
        }));
        currentLength += lastRowLength;
        lastRowPallets = [];
      }
      
      xPos = currentLength + L / 2;
      
      // Z position (width placement)
      if (isHeavy || !canFit2) {
        zPos = TRAILER_WIDTH / 2; // Centered
      } else {
        const isLeftSide = lastRowPallets.length === 0;
        zPos = isLeftSide ? (TRAILER_WIDTH / 2 - W / 2 - 3) : (TRAILER_WIDTH / 2 + W / 2 + 3);
      }
      
      const exceedsCapacity = (xPos + L / 2) > TRAILER_LENGTH;
      const placedPallet = { pallet, xPos, zPos, isStacked: false, hasStackedPallet: false, exceedsCapacity };
      placed.push(placedPallet);
      lastRowPallets.push(placedPallet);
    }
  });
  
  return placed;
};

export const calculateCubeUtilization = (pallets: PalletData[]): number => {
  const usableVolume = TRAILER_LENGTH * TRAILER_WIDTH * TRAILER_HEIGHT; // Full trailer volume, no clearance deduction
  const palletVolume = pallets.reduce((sum, p) => sum + (p.length * p.width * p.height), 0);
  return Math.round((palletVolume / usableVolume) * 100);
};
