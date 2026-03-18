import { PalletData } from "@/components/PalletInputForm";
import { calculateAxleWeights, calculatePlacedPallets, calculateCubeUtilization, MAX_DRIVE_AXLE, MAX_TRAILER_AXLE, TRAILER_WIDTH, TRAILER_LENGTH } from "@/lib/axleCalculations";
import { calculateFreightClass, calculateWeightedFreightClass } from "@/lib/freightClass";
import { checkFTLQualification } from "@/lib/pricingCalculations";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LoadSummaryBannerProps {
  pallets: PalletData[];
}

export const LoadSummaryBanner = ({ pallets }: LoadSummaryBannerProps) => {
  if (pallets.length === 0) return null;
  
  const placedPallets = calculatePlacedPallets(pallets);
  const axleWeights = calculateAxleWeights(placedPallets);
  const cubeUtil = calculateCubeUtilization(pallets);
  
  // Calculate total footage used
  let maxLength = 0;
  placedPallets.forEach((placed) => {
    const orientation = (() => {
      const innerWidth = TRAILER_WIDTH;
      const can2Original = (placed.pallet.width * 2) <= innerWidth;
      const shouldRotate = can2Original && placed.pallet.length > placed.pallet.width;
      return {
        L: shouldRotate ? placed.pallet.width : placed.pallet.length,
      };
    })();
    const palletEnd = placed.xPos + (orientation.L / 2);
    if (palletEnd > maxLength) {
      maxLength = palletEnd;
    }
  });
  const footageUsed = (maxLength / 12).toFixed(1); // Convert inches to feet
  const totalFootage = (TRAILER_LENGTH / 12).toFixed(1); // 53 feet
  
  // Calculate weighted freight class
  const freightClassBreakdown = pallets.map(p => ({
    weight: p.weight,
    freightClass: p.freightClass || calculateFreightClass(p.weight, p.length, p.width, p.height),
  }));
  const weightedClass = calculateWeightedFreightClass(freightClassBreakdown);
  
  // Check FTL qualification
  const totalWeight = pallets.reduce((sum, p) => sum + p.weight, 0);
  const ftlQualification = checkFTLQualification(pallets.length, totalWeight, parseFloat(footageUsed), cubeUtil);
  
  const drivePercent = (axleWeights.driveAxle / MAX_DRIVE_AXLE) * 100;
  const trailerPercent = (axleWeights.trailerAxle / MAX_TRAILER_AXLE) * 100;
  
  const getDriveStatus = () => {
    if (drivePercent > 100) return { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" };
    if (drivePercent > 90) return { icon: TrendingUp, color: "text-warning", bg: "bg-warning/10" };
    return { icon: Minus, color: "text-success", bg: "bg-success/10" };
  };
  
  const getTrailerStatus = () => {
    if (trailerPercent > 100) return { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" };
    if (trailerPercent > 90) return { icon: TrendingUp, color: "text-warning", bg: "bg-warning/10" };
    return { icon: Minus, color: "text-success", bg: "bg-success/10" };
  };
  
  const driveStatus = getDriveStatus();
  const trailerStatus = getTrailerStatus();
  const DriveIcon = driveStatus.icon;
  const TrailerIcon = trailerStatus.icon;
  
  return (
    <div className="mb-6 animate-fade-in">
      <div className="bg-card rounded-lg shadow-[var(--shadow-medium)] border overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Load Summary
            </h3>
            {ftlQualification.isFTL && (
              <Badge variant="default" className="flex items-center gap-1">
                <Truck className="h-3 w-3" />
                FTL Eligible
              </Badge>
            )}
          </div>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left side - Basic metrics */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
                  <span className="text-xs text-muted-foreground block mb-1">Pallets</span>
                  <span className="text-lg font-bold text-foreground">{pallets.length}</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
                  <span className="text-xs text-muted-foreground block mb-1">Cube Utilization</span>
                  <span className="text-lg font-bold text-foreground">{cubeUtil}%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
                  <span className="text-xs text-muted-foreground block mb-1">Space Used</span>
                  <span className="text-lg font-bold text-foreground">
                    {footageUsed}' / {totalFootage}'
                  </span>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
                  <span className="text-xs text-muted-foreground block mb-1">Freight Class</span>
                  <span className="text-lg font-bold text-foreground">{weightedClass}</span>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
                <span className="text-xs text-muted-foreground block mb-1">Total Payload</span>
                <span className="text-lg font-bold text-foreground">
                  {(axleWeights.totalWeight / 1000).toFixed(1)}k lbs
                </span>
              </div>
            </div>
            
            {/* Right side - Axle weights */}
            <div className="space-y-3">
              <div className={`rounded-lg p-3 border-2 ${driveStatus.bg} ${driveStatus.color.replace('text-', 'border-')}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <DriveIcon className={`h-4 w-4 ${driveStatus.color}`} />
                    <span className="text-sm font-medium">Drive Axle</span>
                  </div>
                  <span className={`text-xs font-medium ${driveStatus.color}`}>
                    {drivePercent.toFixed(0)}%
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={`font-bold ${driveStatus.color}`}>
                      {axleWeights.driveAxle.toLocaleString()} lbs
                    </span>
                    <span className="text-muted-foreground">
                      / {(MAX_DRIVE_AXLE / 1000).toFixed(0)}k lbs
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${driveStatus.color.replace('text-', 'bg-')} transition-all duration-500`}
                      style={{ width: `${Math.min(drivePercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className={`rounded-lg p-3 border-2 ${trailerStatus.bg} ${trailerStatus.color.replace('text-', 'border-')}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrailerIcon className={`h-4 w-4 ${trailerStatus.color}`} />
                    <span className="text-sm font-medium">Trailer Axle</span>
                  </div>
                  <span className={`text-xs font-medium ${trailerStatus.color}`}>
                    {trailerPercent.toFixed(0)}%
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={`font-bold ${trailerStatus.color}`}>
                      {axleWeights.trailerAxle.toLocaleString()} lbs
                    </span>
                    <span className="text-muted-foreground">
                      / {(MAX_TRAILER_AXLE / 1000).toFixed(0)}k lbs
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${trailerStatus.color.replace('text-', 'bg-')} transition-all duration-500`}
                      style={{ width: `${Math.min(trailerPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
