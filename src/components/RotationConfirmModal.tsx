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
import { RotateCw } from "lucide-react";
import type { PalletData } from "./PalletInputForm";

interface RotationConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  pallet: PalletData | null;
  count: number;
}

export const RotationConfirmModal = ({
  open,
  onConfirm,
  onCancel,
  pallet,
  count,
}: RotationConfirmModalProps) => {
  if (!pallet) return null;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <RotateCw className="h-5 w-5 text-primary" />
            <AlertDialogTitle>Rotate Pallets to Fit?</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="text-base space-y-3 pt-2">
              <p>
                These {count} pallet{count > 1 ? "s" : ""} ({pallet.length}" × {pallet.width}" × {pallet.height}") won't fit in the current orientation.
              </p>
              <p className="font-medium text-foreground">
                However, they WILL fit if we rotate them to {pallet.width}" × {pallet.length}" × {pallet.height}".
              </p>
              <p className="text-sm text-muted-foreground">
                Would you like to rotate and add them?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="gap-2">
            <RotateCw className="h-4 w-4" />
            Rotate and Add
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
