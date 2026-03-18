import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Scale, Box, AlertTriangle, CheckCircle2, RotateCw } from "lucide-react";
import type { PalletData } from "./PalletInputForm";
import { TRAILER_LENGTH, TRAILER_WIDTH, TRAILER_HEIGHT, MAX_WEIGHT, CLEARANCE } from "@/lib/axleCalculations";

interface LoadMetricsProps {
  pallets: PalletData[];
}

export const LoadMetrics = ({ pallets }: LoadMetricsProps) => {
  // Calculate total weight
  const totalWeight = pallets.reduce((sum, p) => sum + p.weight, 0);
  const weightPercentage = (totalWeight / MAX_WEIGHT) * 100;
  
  // Calculate space used (accounting for stacking and side-by-side placement)
  let effectiveLength = 0;
  let lastRowPallets: PalletData[] = [];
  
  pallets.forEach((pallet, index) => {
    const isHeavy = pallet.weight > 3000;
    const canFitSideBySide = (pallet.width * 2) <= TRAILER_WIDTH; // No clearance deduction
    
    // Check if can stack on previous pallet
    let canStack = false;
    if (pallet.allowDoubleStack && lastRowPallets.length > 0) {
      canStack = lastRowPallets.some(prev => {
        const dimensionsMatch = 
          Math.abs(prev.length - pallet.length) < 6 &&
          Math.abs(prev.width - pallet.width) < 6;
        const weightSafe = prev.weight + pallet.weight <= 5000;
        return prev.allowDoubleStack && dimensionsMatch && weightSafe;
      });
    }
    
    if (!canStack) {
      // Start new row if needed
      if (lastRowPallets.length > 0 && (isHeavy || !canFitSideBySide || lastRowPallets.length >= 2)) {
        const rowLength = Math.max(...lastRowPallets.map(p => p.length));
        effectiveLength += rowLength; // No clearance between rows
        lastRowPallets = [];
      }
      lastRowPallets.push(pallet);
    }
  });
  
  // Add last row
  if (lastRowPallets.length > 0) {
    effectiveLength += Math.max(...lastRowPallets.map(p => p.length));
  }
  
  const availableLength = TRAILER_LENGTH; // Full trailer length, no clearance deduction
  const lengthPercentage = (effectiveLength / availableLength) * 100;
  
  // Calculate cubic feet
  const totalCubicInches = pallets.reduce((sum, p) => sum + (p.length * p.width * p.height), 0);
  const totalCubicFeet = totalCubicInches / 1728;
  const trailerCubicFeet = (TRAILER_LENGTH * TRAILER_WIDTH * TRAILER_HEIGHT) / 1728;
  const cubicPercentage = (totalCubicFeet / trailerCubicFeet) * 100;
  
  // Weight warnings
  const hasOverweight = pallets.some(p => p.weight > 3000);
  const nearMaxWeight = totalWeight > MAX_WEIGHT * 0.9;
  const overMaxWeight = totalWeight > MAX_WEIGHT;
  
  const getWeightStatus = () => {
    if (overMaxWeight) return { color: "destructive", icon: AlertTriangle, text: "Over Limit" };
    if (nearMaxWeight) return { color: "warning", icon: AlertTriangle, text: "Near Limit" };
    return { color: "success", icon: CheckCircle2, text: "Good" };
  };
  
  const weightStatus = getWeightStatus();
  const WeightIcon = weightStatus.icon;

  return (
    <div className="space-y-4">
      {/* Weight Card */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Total Weight</CardTitle>
            </div>
            <Badge variant={weightStatus.color as any}>
              <WeightIcon className="h-3 w-3 mr-1" />
              {weightStatus.text}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current Load</span>
            <span className="font-semibold">{totalWeight.toLocaleString()} lbs</span>
          </div>
          <Progress value={weightPercentage} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{weightPercentage.toFixed(1)}% of max</span>
            <span>Max: {MAX_WEIGHT.toLocaleString()} lbs</span>
          </div>
          {hasOverweight && (
            <div className="flex items-start gap-2 p-2 bg-warning/10 rounded-md mt-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
              <p className="text-xs text-warning">
                One or more pallets exceed recommended 2,000 lbs per spot
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Space Utilization Card */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Box className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Space Utilization</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Linear Feet */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Linear Feet</span>
              <span className="font-semibold">{(effectiveLength / 12).toFixed(1)} ft</span>
            </div>
            <Progress value={lengthPercentage} className="h-2" />
            <div className="text-xs text-muted-foreground text-right">
              {lengthPercentage.toFixed(1)}% of 53 ft
            </div>
          </div>

          {/* Cubic Space */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cubic Feet</span>
              <span className="font-semibold">{totalCubicFeet.toFixed(0)} ft³</span>
            </div>
            <Progress value={cubicPercentage} className="h-2" />
            <div className="text-xs text-muted-foreground text-right">
              {cubicPercentage.toFixed(1)}% of {trailerCubicFeet.toFixed(0)} ft³
            </div>
          </div>

          {/* Rotation Report */}
          {pallets.length > 0 && (() => {
            const innerWidth = TRAILER_WIDTH; // No clearance deduction
            const rotatedCount = pallets.filter(p => {
              const can2Original = (p.width * 2) <= innerWidth;
              const can2Rotated = (p.length * 2) <= innerWidth;
              const shouldRotate = can2Original && p.length > p.width;
              return shouldRotate;
            }).length;
            
            if (rotatedCount > 0) {
              return (
                <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-md border border-primary/20 mt-4">
                  <RotateCw className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-xs space-y-1">
                    <p className="font-medium text-primary">Auto-Rotation Applied</p>
                    <p className="text-muted-foreground">
                      {rotatedCount} pallet{rotatedCount > 1 ? 's' : ''} rotated 90° to optimize floor space and allow side-by-side placement
                    </p>
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </CardContent>
      </Card>

      {/* Pallet Count Summary */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-primary">{pallets.length}</div>
              <div className="text-sm text-muted-foreground">Total Pallets</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-secondary">
                {pallets.length > 0 ? (totalWeight / pallets.length).toFixed(0) : 0}
              </div>
              <div className="text-sm text-muted-foreground">Avg Weight (lbs)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
