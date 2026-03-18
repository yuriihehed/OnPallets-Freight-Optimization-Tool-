import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Package, Trash2, Layers } from "lucide-react";
import type { PalletData } from "./PalletInputForm";

interface PalletsListProps {
  pallets: PalletData[];
  onRemovePallet: (id: string) => void;
}

export const PalletsList = ({ pallets, onRemovePallet }: PalletsListProps) => {
  const getWeightBadge = (weight: number) => {
    if (weight > 3000) return { variant: "destructive" as const, label: "Heavy" };
    if (weight > 2000) return { variant: "warning" as const, label: "Above Avg" };
    return { variant: "success" as const, label: "Normal" };
  };

  return (
    <Card className="shadow-[var(--shadow-medium)]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <CardTitle>Load Manifest</CardTitle>
        </div>
        <CardDescription>
          {pallets.length} {pallets.length === 1 ? 'item' : 'items'} in current load
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pallets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No freight added yet</p>
            <p className="text-sm">Add your first item to get started</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {pallets.map((pallet, index) => {
                const weightBadge = getWeightBadge(pallet.weight);
                return (
                  <div
                    key={pallet.id}
                    className="flex items-start justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-[var(--transition-base)]"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {pallet.type || 'Item'} #{index + 1}
                        </span>
                        <Badge variant={weightBadge.variant}>
                          {weightBadge.label}
                        </Badge>
                        {pallet.allowDoubleStack && (
                          <Badge variant="secondary" className="gap-1">
                            <Layers className="h-3 w-3" />
                            Stackable
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {pallet.commodity}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>L: {pallet.length}"</span>
                        <span>W: {pallet.width}"</span>
                        <span>H: {pallet.height}"</span>
                      </div>
                      <div className="text-sm font-medium">
                        {pallet.weight.toLocaleString()} lbs
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemovePallet(pallet.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
