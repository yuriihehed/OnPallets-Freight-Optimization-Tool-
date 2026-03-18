import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Package, Scale, Ruler } from "lucide-react";

interface CapacityIssue {
  maxFitCount: number;
  trailersNeeded: number;
  reasons: {
    weight?: string;
    space?: string;
    driveAxle?: string;
    trailerAxle?: string;
  };
  splitPlan: string;
}

interface CapacityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: CapacityIssue | null;
  requestedCount: number;
  palletDimensions: string;
  onAutoSplit: () => void;
  onEdit: () => void;
}

export const CapacityModal = ({
  open,
  onOpenChange,
  issue,
  requestedCount,
  palletDimensions,
  onAutoSplit,
  onEdit,
}: CapacityModalProps) => {
  if (!issue) return null;
  
  const hasWeightIssue = issue.reasons.weight || issue.reasons.driveAxle || issue.reasons.trailerAxle;
  const hasSpaceIssue = issue.reasons.space;
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-[100]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">
              Shipment Won't Fit in One Trailer
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="text-base space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Freight Specifications</p>
                  <p className="text-sm text-muted-foreground">{palletDimensions}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Ruler className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Maximum Capacity</p>
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{issue.maxFitCount}</strong> item{issue.maxFitCount !== 1 ? 's' : ''} can fit with your current dimensions and stacking options
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Limiting Factors:</p>
              <div className="space-y-2 pl-4">
                {hasSpaceIssue && (
                  <div className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5" />
                    <p className="text-sm">
                      <strong className="text-foreground">Space constraint:</strong> {issue.reasons.space}
                    </p>
                  </div>
                )}
                {issue.reasons.weight && (
                  <div className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5" />
                    <p className="text-sm">
                      <strong className="text-foreground">Weight limit:</strong> {issue.reasons.weight}
                    </p>
                  </div>
                )}
                {issue.reasons.driveAxle && (
                  <div className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5" />
                    <p className="text-sm">
                      <strong className="text-foreground">Drive axle:</strong> {issue.reasons.driveAxle}
                    </p>
                  </div>
                )}
                {issue.reasons.trailerAxle && (
                  <div className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5" />
                    <p className="text-sm">
                      <strong className="text-foreground">Trailer axle:</strong> {issue.reasons.trailerAxle}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Scale className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Suggested Plan</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <strong className="text-foreground">{issue.trailersNeeded}</strong> trailer{issue.trailersNeeded !== 1 ? 's' : ''} needed for {requestedCount} items
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{issue.splitPlan}</p>
                </div>
              </div>
            </div>
            
            {issue.maxFitCount > 0 && (
              <p className="text-sm text-muted-foreground italic">
                💡 Tip: You can add up to {issue.maxFitCount} item{issue.maxFitCount !== 1 ? 's' : ''} to fill the current trailer, or use auto-split to plan multiple trailers.
              </p>
            )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onEdit}>Edit Freight</AlertDialogCancel>
          <AlertDialogAction
            onClick={onAutoSplit}
            className="bg-[var(--gradient-primary)] hover:opacity-90"
          >
            Auto-Split Load
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
