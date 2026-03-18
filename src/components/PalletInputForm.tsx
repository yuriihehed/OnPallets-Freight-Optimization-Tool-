import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Package, RotateCw, Layers, Lightbulb, Info, Truck } from "lucide-react";
import { calculateFreightClass } from "@/lib/freightClass";

export interface PalletData {
  id: string;
  length: number; // inches
  width: number; // inches
  height: number; // inches
  weight: number; // lbs
  commodity: string;
  allowDoubleStack: boolean;
  type?: string; // e.g., "pallet", "crate", "pipe", "box"
  fragile?: boolean;
  hazmat?: boolean;
  freightClass?: number; // Auto-calculated from density
  isFTL?: boolean; // FTL flag
}

interface PalletInputFormProps {
  onAddPallet: (pallet: PalletData, count: number) => void;
}

export const PalletInputForm = ({ onAddPallet }: PalletInputFormProps) => {
  const [length, setLength] = useState("48");
  const [width, setWidth] = useState("40");
  const [height, setHeight] = useState("48");
  const [weight, setWeight] = useState("1500");
  const [commodity, setCommodity] = useState("");
  const [freightType, setFreightType] = useState("Pallet");
  const [allowDoubleStack, setAllowDoubleStack] = useState(false);
  const [palletCount, setPalletCount] = useState("1");
  const [fragile, setFragile] = useState(false);
  const [hazmat, setHazmat] = useState(false);
  const [calculatedClass, setCalculatedClass] = useState<number | null>(null);
  const [isStandardPallet, setIsStandardPallet] = useState(false);
  const [isFTL, setIsFTL] = useState(false);
  
  // Auto-calculate freight class when dimensions/weight change
  useEffect(() => {
    const l = parseFloat(length);
    const w = parseFloat(width);
    const h = parseFloat(height);
    const wt = parseFloat(weight);
    
    if (l > 0 && w > 0 && h > 0 && wt > 0) {
      const freightClass = calculateFreightClass(wt, l, w, h);
      setCalculatedClass(freightClass);
    } else {
      setCalculatedClass(null);
    }
  }, [length, width, height, weight]);

  // Check if rotation would save space
  const checkRotationSuggestion = () => {
    const l = parseFloat(length);
    const w = parseFloat(width);
    
    // If length is significantly longer than width, suggest rotation
    if (l > 60 && w <= 48 && l > w * 1.5) {
      return {
        show: true,
        message: `💡 Tip: This item (${l}"L × ${w}"W) could be rotated to ${w}"L × ${l}"W to fit side-by-side more efficiently.`,
        canRotate: true
      };
    }
    return { show: false, message: "", canRotate: false };
  };

  const rotationSuggestion = checkRotationSuggestion();

  const handleRotate = () => {
    const temp = length;
    setLength(width);
    setWidth(temp);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const count = parseInt(palletCount) || 1;
    
    const pallet: PalletData = {
      id: `pallet-${Date.now()}`,
      length: parseFloat(length),
      width: parseFloat(width),
      height: parseFloat(height),
      weight: parseFloat(weight),
      commodity: commodity || freightType || "General Freight",
      type: freightType,
      allowDoubleStack,
      fragile,
      hazmat,
      freightClass: calculatedClass || undefined,
      isFTL,
    };
    
    onAddPallet(pallet, count);
    
    // Reset commodity, double stack, count, and type but keep dimensions
    setCommodity("");
    setFreightType("Pallet");
    setAllowDoubleStack(false);
    setFragile(false);
    setHazmat(false);
    setPalletCount("1");
  };

  return (
    <Card className="shadow-[var(--shadow-medium)]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <CardTitle>Add Freight</CardTitle>
        </div>
        <CardDescription>
          Enter dimensions and weight for pallets, crates, pipes, or any cargo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {rotationSuggestion.show && (
            <Alert className="border-secondary/50 bg-secondary/10">
              <Lightbulb className="h-4 w-4 text-secondary" />
              <AlertDescription className="flex items-center justify-between gap-2">
                <span className="text-sm">{rotationSuggestion.message}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRotate}
                  className="flex-shrink-0"
                >
                  <RotateCw className="h-3 w-3 mr-1" />
                  Rotate
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Standard Pallet Checkbox */}
          <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <Checkbox
              id="standard-pallet"
              checked={isStandardPallet}
              onCheckedChange={(checked) => {
                setIsStandardPallet(checked as boolean);
                if (checked) {
                  setLength("48");
                  setWidth("40");
                  // Don't auto-fill height - user must specify
                }
              }}
            />
            <Label htmlFor="standard-pallet" className="cursor-pointer text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Standard Pallet (48"×40")
            </Label>
          </div>

          {/* FTL Checkbox */}
          <div className="flex items-center gap-2 p-3 bg-accent/5 border border-accent/20 rounded-lg">
            <Checkbox
              id="ftl-mode"
              checked={isFTL}
              onCheckedChange={(checked) => {
                setIsFTL(checked as boolean);
                if (checked) {
                  // Auto-suggest FTL-optimized values
                  if (!isStandardPallet) {
                    setLength("48");
                    setWidth("40");
                    setIsStandardPallet(true);
                  }
                  setPalletCount("26"); // Typical FTL
                }
              }}
            />
            <Label htmlFor="ftl-mode" className="cursor-pointer text-sm flex items-center gap-2">
              <Truck className="h-4 w-4 text-accent" />
              Full Truckload (FTL)
            </Label>
          </div>

          {/* FTL Weight Guide */}
          {isFTL && (
            <Alert className="border-accent/50 bg-accent/5">
              <Info className="h-4 w-4 text-accent" />
              <AlertDescription className="text-sm">
                <strong>FTL Weight Guide:</strong>
                <ul className="list-disc ml-4 mt-1 space-y-1">
                  <li><strong>Light (&lt;15k lbs):</strong> ~15% lower rates, easier backhaul</li>
                  <li><strong>Standard (15k-30k):</strong> Base FTL rates</li>
                  <li><strong>Heavy (30k-45k):</strong> ~15% premium for fuel costs</li>
                  <li><strong>Max legal:</strong> 45,000 lbs (without permits)</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="length">Length (in)</Label>
              <Input
                id="length"
                type="number"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                min="1"
                max="636"
                required
                disabled={isStandardPallet}
                className="transition-[var(--transition-base)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="width">Width (in)</Label>
              <Input
                id="width"
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                min="1"
                max="102"
                required
                disabled={isStandardPallet}
                className="transition-[var(--transition-base)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Height (in)</Label>
              <Input
                id="height"
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                min="1"
                max="110"
                required
                className="transition-[var(--transition-base)]"
              />
              {isStandardPallet && (
                <p className="text-xs text-muted-foreground mt-1">
                  Height required for stacking calculations
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (lbs)</Label>
              <Input
                id="weight"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                min="1"
                max="45000"
                required
                className="transition-[var(--transition-base)]"
              />
              {isStandardPallet && (
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Recommended:</strong> Standard FTL is 30 pallets at ~1,500 lbs each (45,000 lbs total)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="count">Pallet Count</Label>
              <Input
                id="count"
                type="number"
                value={palletCount}
                onChange={(e) => setPalletCount(e.target.value)}
                min="1"
                max="100"
                required
                className="transition-[var(--transition-base)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="freight-type">Freight Type</Label>
              <Input
                id="freight-type"
                type="text"
                value={freightType}
                onChange={(e) => setFreightType(e.target.value)}
                placeholder="e.g., Pallet, Crate, Pipe"
                className="transition-[var(--transition-base)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commodity">Commodity (optional)</Label>
              <Input
                id="commodity"
                type="text"
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                placeholder="e.g., Electronics, Steel"
                className="transition-[var(--transition-base)]"
              />
            </div>
          </div>

          {calculatedClass && (
            <Alert className="border-primary/50 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                <strong>Freight Class {calculatedClass}</strong> - Auto-calculated from density ({(parseFloat(weight) / ((parseFloat(length) * parseFloat(width) * parseFloat(height)) / 1728)).toFixed(1)} lb/cu ft)
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <div>
                <Label htmlFor="double-stack" className="cursor-pointer">
                  Allow Double Stacking
                </Label>
                <p className="text-xs text-muted-foreground">
                  Stack compatible pallets to save space
                </p>
              </div>
            </div>
            <Switch
              id="double-stack"
              checked={allowDoubleStack}
              onCheckedChange={setAllowDoubleStack}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <Label htmlFor="fragile" className="cursor-pointer text-sm">
                Fragile
              </Label>
              <Switch
                id="fragile"
                checked={fragile}
                onCheckedChange={setFragile}
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <Label htmlFor="hazmat" className="cursor-pointer text-sm">
                Hazmat
              </Label>
              <Switch
                id="hazmat"
                checked={hazmat}
                onCheckedChange={setHazmat}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add {parseInt(palletCount) > 1 ? `${palletCount} Items` : 'Item'} to Load
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
