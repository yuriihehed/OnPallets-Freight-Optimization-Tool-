import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PalletInputForm, type PalletData } from "@/components/PalletInputForm";
import { TrailerVisualization } from "@/components/TrailerVisualization";
import { LoadMetrics } from "@/components/LoadMetrics";
import { PalletsList } from "@/components/PalletsList";
import { LoadSummaryBanner } from "@/components/LoadSummaryBanner";
import { CapacityModal } from "@/components/CapacityModal";
import { RotationConfirmModal } from "@/components/RotationConfirmModal";
import { Button } from "@/components/ui/button";
import { Truck, RotateCcw, DollarSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  TRAILER_LENGTH,
  TRAILER_WIDTH,
  MAX_WEIGHT,
  MAX_DRIVE_AXLE,
  MAX_TRAILER_AXLE,
  CLEARANCE,
  calculateAxleWeights,
  calculatePlacedPallets,
} from "@/lib/axleCalculations";

// Helper function to determine optimal pallet orientation (mirrors axleCalculations.ts logic)
const chooseOrientation = (pallet: PalletData) => {
  const innerWidth = TRAILER_WIDTH; // No clearance enforcement in calculations
  
  const can2Original = (pallet.width * 2) <= innerWidth;
  const can2Rotated = (pallet.length * 2) <= innerWidth;
  
  // When 2 pallets can fit side-by-side in original orientation, use shorter dimension along trailer
  const shouldRotate = can2Original && pallet.length > pallet.width;
  
  return {
    L: shouldRotate ? pallet.width : pallet.length,
    W: shouldRotate ? pallet.length : pallet.width,
    canFit2: shouldRotate ? can2Rotated : can2Original,
  };
};

type RowItem = { 
  pallet: PalletData; 
  L: number;
  W: number;
  stacked: boolean;
};

// Pure function to check if a given count of pallets fits WITHOUT auto-rotation (for rotation modal)
const fitsOnceNoAutoRotate = (pallets: PalletData[], newPallet: PalletData, count: number): { fits: boolean; reasons: Record<string, string>; warnings: Record<string, string> } => {
  const testPallets = [...pallets];
  for (let i = 0; i < count; i++) {
    testPallets.push({ ...newPallet, id: `test-${i}` });
  }
  
  const totalWeight = testPallets.reduce((sum, p) => sum + p.weight, 0);
  const reasons: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  
  if (totalWeight > MAX_WEIGHT) {
    reasons.weight = `Total weight ${Math.round(totalWeight).toLocaleString()} lbs exceeds ${MAX_WEIGHT.toLocaleString()} lbs limit`;
  }
  
  // Check space WITHOUT auto-rotation - use exact dimensions as provided
  let effectiveLength = 0;
  let lastRowPallets: RowItem[] = [];
  
  testPallets.forEach((pallet) => {
    const isHeavy = pallet.weight > 3000;
    const L = pallet.length; // Use exact dimensions, no rotation
    const W = pallet.width;
    const canFit2 = (W * 2) <= TRAILER_WIDTH;
    
    let canStack = false;
    if (pallet.allowDoubleStack && lastRowPallets.length > 0) {
      const stackableBase = lastRowPallets.find(base => {
        if (base.stacked || !base.pallet.allowDoubleStack) return false;
        const dimensionsMatch = Math.abs(base.L - L) < 6 && Math.abs(base.W - W) < 6;
        const weightSafe = base.pallet.weight + pallet.weight <= 5000;
        return dimensionsMatch && weightSafe;
      });
      
      if (stackableBase) {
        stackableBase.stacked = true;
        canStack = true;
      }
    }
    
    if (!canStack) {
      if (lastRowPallets.length > 0 && (isHeavy || !canFit2 || lastRowPallets.length >= 2)) {
        const rowLength = Math.max(...lastRowPallets.map(item => item.L));
        effectiveLength += rowLength;
        lastRowPallets = [];
      }
      lastRowPallets.push({ pallet, L, W, stacked: false });
    }
  });
  
  if (lastRowPallets.length > 0) {
    effectiveLength += Math.max(...lastRowPallets.map(item => item.L));
  }
  
  if (effectiveLength > TRAILER_LENGTH) {
    reasons.space = `Floor length ${Math.round(effectiveLength)}" exceeds available ${TRAILER_LENGTH}"`;
  }
  
  return { fits: Object.keys(reasons).length === 0, reasons, warnings };
};

// Pure function to check if a given count of pallets fits (non-recursive)
const fitsOnce = (pallets: PalletData[], newPallet: PalletData, count: number): { fits: boolean; reasons: Record<string, string>; warnings: Record<string, string> } => {
  const testPallets = [...pallets];
  for (let i = 0; i < count; i++) {
    testPallets.push({ ...newPallet, id: `test-${i}` });
  }
  
  const totalWeight = testPallets.reduce((sum, p) => sum + p.weight, 0);
  const reasons: Record<string, string> = {}; // Blocking issues only
  const warnings: Record<string, string> = {}; // Non-blocking warnings
  
  // Check total weight (blocking)
  if (totalWeight > MAX_WEIGHT) {
    reasons.weight = `Total weight ${Math.round(totalWeight).toLocaleString()} lbs exceeds ${MAX_WEIGHT.toLocaleString()} lbs limit`;
  }
  
  // Check axle weights (non-blocking warnings)
  const placed = calculatePlacedPallets(testPallets);
  const axleWeights = calculateAxleWeights(placed);
  
  if (axleWeights.driveOverage > 0) {
    warnings.driveAxle = `Drive axle estimated at ${axleWeights.driveAxle.toLocaleString()} lbs (limit ${MAX_DRIVE_AXLE.toLocaleString()} lbs). Actual weight distribution depends on placement and tandem slide position.`;
  }
  
  if (axleWeights.trailerOverage > 0) {
    warnings.trailerAxle = `Trailer axle estimated at ${axleWeights.trailerAxle.toLocaleString()} lbs (limit ${MAX_TRAILER_AXLE.toLocaleString()} lbs). Actual weight distribution depends on placement and tandem slide position.`;
  }
  
  // Check space - calculate total floor length needed with orientation (blocking)
  let effectiveLength = 0;
  let lastRowPallets: RowItem[] = [];
  
  testPallets.forEach((pallet) => {
    const isHeavy = pallet.weight > 3000;
    const orientation = chooseOrientation(pallet);
    const { L, W, canFit2 } = orientation;
    
    let canStack = false;
    if (pallet.allowDoubleStack && lastRowPallets.length > 0) {
      const stackableBase = lastRowPallets.find(base => {
        if (base.stacked || !base.pallet.allowDoubleStack) return false;
        
        const dimensionsMatch = 
          Math.abs(base.L - L) < 6 &&
          Math.abs(base.W - W) < 6;
        const weightSafe = base.pallet.weight + pallet.weight <= 5000;
        return dimensionsMatch && weightSafe;
      });
      
      if (stackableBase) {
        stackableBase.stacked = true;
        canStack = true;
      }
    }
    
    if (!canStack) {
      if (lastRowPallets.length > 0 && (isHeavy || !canFit2 || lastRowPallets.length >= 2)) {
        const rowLength = Math.max(...lastRowPallets.map(item => item.L));
        effectiveLength += rowLength;
        lastRowPallets = [];
      }
      lastRowPallets.push({ pallet, L, W, stacked: false });
    }
  });
  
  if (lastRowPallets.length > 0) {
    effectiveLength += Math.max(...lastRowPallets.map(item => item.L));
  }
  
  const availableLength = TRAILER_LENGTH; // No clearance deduction
  if (effectiveLength > availableLength) {
    reasons.space = `Floor length ${Math.round(effectiveLength)}" exceeds available ${availableLength}" (pallets too long or cannot rotate)`;
  }
  
  return {
    fits: Object.keys(reasons).length === 0, // Only blocking reasons affect fit
    reasons,
    warnings,
  };
};

// Iterative capacity calculation using binary search (no recursion)
const calculateLoadCapacity = (pallets: PalletData[], newPallet: PalletData, count: number) => {
  // Quick check for requested count
  const quickCheck = fitsOnce(pallets, newPallet, count);
  
  if (quickCheck.fits) {
    return { fits: true, reasons: {}, warnings: quickCheck.warnings, maxPallets: count, trailersNeeded: 1, splitPlan: '' };
  }
  
  // Binary search to find max pallets that fit
  let lo = 0;
  let hi = count;
  
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const result = fitsOnce(pallets, newPallet, mid);
    
    if (result.fits) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  
  const maxPallets = lo;
  
  // Guard against division by zero
  if (maxPallets === 0) {
    return {
      fits: false,
      reasons: quickCheck.reasons,
      warnings: {},
      maxPallets: 0,
      trailersNeeded: Infinity,
      splitPlan: 'Cannot fit any pallets - reduce weight or dimensions',
    };
  }
  
  const trailersNeeded = Math.ceil(count / maxPallets);
  const palletsPerTrailer = Math.ceil(count / trailersNeeded);
  const splitPlan = trailersNeeded > 1
    ? `Split as: ${Array(trailersNeeded - 1).fill(palletsPerTrailer).join(' + ')} + ${count - (palletsPerTrailer * (trailersNeeded - 1))} pallets`
    : '';
  
  return {
    fits: false,
    reasons: quickCheck.reasons,
    warnings: {},
    maxPallets,
    trailersNeeded,
    splitPlan,
  };
};

const Index = () => {
  const navigate = useNavigate();
  const [pallets, setPallets] = useState<PalletData[]>([]);
  const [capacityModalOpen, setCapacityModalOpen] = useState(false);
  const [capacityIssue, setCapacityIssue] = useState<any>(null);
  const [pendingPallet, setPendingPallet] = useState<{ pallet: PalletData; count: number } | null>(null);
  const [rotationModalOpen, setRotationModalOpen] = useState(false);
  const [rotationPendingPallet, setRotationPendingPallet] = useState<{ pallet: PalletData; count: number } | null>(null);

  const handleAddPallet = (pallet: PalletData, count: number = 1, skipRotationCheck: boolean = false) => {
    try {
      if (!skipRotationCheck) {
        // Check fit WITHOUT auto-rotation using exact input dimensions
        const originalFit = fitsOnceNoAutoRotate(pallets, pallet, count);
        
        // Check fit with manually swapped dimensions
        const swappedPallet = {
          ...pallet,
          length: pallet.width,
          width: pallet.length,
        };
        const swappedFit = fitsOnceNoAutoRotate(pallets, swappedPallet, count);
        
        // If original doesn't fit but swapped does, show rotation modal
        if (!originalFit.fits && swappedFit.fits) {
          setRotationPendingPallet({ pallet, count });
          setRotationModalOpen(true);
          return;
        }
      }
      
      // Now check with normal capacity calculation (which uses auto-rotation)
      const capacity = calculateLoadCapacity(pallets, pallet, count);
      
      if (!capacity.fits) {
        // Show capacity modal
        const dimensions = `${pallet.length}"L × ${pallet.width}"W × ${pallet.height}"H, ${pallet.weight} lbs`;
        setCapacityIssue({
          maxFitCount: capacity.maxPallets,
          trailersNeeded: capacity.trailersNeeded,
          reasons: capacity.reasons,
          splitPlan: capacity.splitPlan,
        });
        setPendingPallet({ pallet, count });
        setCapacityModalOpen(true);
        return;
      }
      
      const newPallets: PalletData[] = [];
      for (let i = 0; i < count; i++) {
        newPallets.push({
          ...pallet,
          id: `pallet-${Date.now()}-${i}-${Math.random()}`
        });
      }
      setPallets(prev => [...prev, ...newPallets]);
      
      // Check if pallets were auto-rotated
      const orientation = chooseOrientation(pallet);
      const wasRotated = orientation.L !== pallet.length;
      
      // Show success toast
      toast({
        title: "Pallets Added",
        description: `Successfully added ${count} pallet${count > 1 ? 's' : ''} to the load.${wasRotated ? ` Auto-rotated to ${orientation.L}"×${orientation.W}" for optimal space utilization.` : ''}`,
      });
      
      // Show axle warnings if present (non-blocking)
      if (capacity.warnings && Object.keys(capacity.warnings).length > 0) {
        const warningMessages = Object.values(capacity.warnings);
        toast({
          title: "Axle Distribution Notice",
          description: warningMessages.join(' '),
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error adding pallets:', error);
      toast({
        title: "Error",
        description: "Failed to add pallets. Please try again with a smaller quantity.",
        variant: "destructive",
      });
    }
  };

  const handleAutoSplit = () => {
    if (!pendingPallet || !capacityIssue) return;
    
    const { pallet, count } = pendingPallet;
    const maxFit = capacityIssue.maxFitCount;
    
    if (maxFit > 0) {
      // Add max pallets that fit
      const newPallets: PalletData[] = [];
      for (let i = 0; i < maxFit; i++) {
        newPallets.push({
          ...pallet,
          id: `pallet-${Date.now()}-${i}-${Math.random()}`
        });
      }
      setPallets(prev => [...prev, ...newPallets]);
      
      toast({
        title: "Pallets Added to First Trailer",
        description: `Added ${maxFit} pallets. You'll need ${capacityIssue.trailersNeeded} total trailers for ${count} pallets.`,
      });
    }
    
    setCapacityModalOpen(false);
    setPendingPallet(null);
    setCapacityIssue(null);
  };

  const handleEditPallets = () => {
    setCapacityModalOpen(false);
    setPendingPallet(null);
    setCapacityIssue(null);
  };

  const handleRemovePallet = (id: string) => {
    setPallets(prev => prev.filter(p => p.id !== id));
  };

  const handleClearAll = () => {
    setPallets([]);
  };

  const handleRotationConfirm = () => {
    if (!rotationPendingPallet) return;
    
    // Swap length and width, then add the rotated pallet
    const rotatedPallet = {
      ...rotationPendingPallet.pallet,
      length: rotationPendingPallet.pallet.width,
      width: rotationPendingPallet.pallet.length,
    };
    
    setRotationModalOpen(false);
    setRotationPendingPallet(null);
    
    // Add with skipRotationCheck to avoid infinite loop
    handleAddPallet(rotatedPallet, rotationPendingPallet.count, true);
  };

  const handleRotationCancel = () => {
    setRotationModalOpen(false);
    setRotationPendingPallet(null);
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      
      <CapacityModal
        open={capacityModalOpen}
        onOpenChange={setCapacityModalOpen}
        issue={capacityIssue}
        requestedCount={pendingPallet?.count || 0}
        palletDimensions={pendingPallet ? `${pendingPallet.pallet.length}"L × ${pendingPallet.pallet.width}"W × ${pendingPallet.pallet.height}"H, ${pendingPallet.pallet.weight} lbs` : ''}
        onAutoSplit={handleAutoSplit}
        onEdit={handleEditPallets}
      />
      
      <RotationConfirmModal
        open={rotationModalOpen}
        onConfirm={handleRotationConfirm}
        onCancel={handleRotationCancel}
        pallet={rotationPendingPallet?.pallet || null}
        count={rotationPendingPallet?.count || 0}
      />
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card shadow-[var(--shadow-soft)]">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--gradient-primary)] rounded-lg">
                <Truck className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">OnPallets</h1>
                <p className="text-xs md:text-sm text-muted-foreground">LTL Load Calculator & Optimizer</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {pallets.length > 0 && (
                <>
                  <Button
                    onClick={() => navigate("/pricing", { state: { pallets } })}
                    className="gap-2 flex-1 sm:flex-initial"
                    size="sm"
                  >
                    <DollarSign className="h-4 w-4" />
                    <span className="hidden sm:inline">{pallets.some(p => p.isFTL) ? 'Get FTL Quote' : 'Get Quote'}</span>
                    <span className="sm:hidden">Quote</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClearAll}
                    className="gap-2"
                    size="sm"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span className="hidden md:inline">Clear All</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pb-20">
        {pallets.length > 0 && <LoadSummaryBanner pallets={pallets} />}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Input & Metrics */}
          <div className="space-y-6 order-1 lg:order-1">
            <div className="space-y-6">
              <PalletInputForm onAddPallet={handleAddPallet} />
              {pallets.length === 0 && <LoadMetrics pallets={pallets} />}
            </div>
            {pallets.length > 0 && <LoadMetrics pallets={pallets} />}
          </div>

          {/* Right Column - 3D Visualization */}
          <div className="lg:col-span-2 space-y-6 order-2 lg:order-2">
            <TrailerVisualization pallets={pallets} />
            {pallets.length > 0 && <PalletsList pallets={pallets} onRemovePallet={handleRemovePallet} />}
          </div>
        </div>

        {/* Info Footer */}
        <div className="mt-8 p-4 bg-card rounded-lg shadow-[var(--shadow-soft)] border">
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong className="text-foreground">Trailer Specs:</strong> 53' Dry Van (636" L × 102" W × 110" H)</p>
            <p><strong className="text-foreground">Max Weight:</strong> 45,000 lbs total capacity</p>
            <p><strong className="text-foreground">Recommended:</strong> 1,500 lbs average per pallet spot • 2" clearance from walls</p>
            <p><strong className="text-foreground">Double Stacking:</strong> Max 5,000 lbs per stacked pair • Compatible dimensions required</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
