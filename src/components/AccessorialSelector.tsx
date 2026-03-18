import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessorialName } from "@/lib/pricingCalculations";

interface AccessorialSelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

const ACCESSORIAL_OPTIONS = [
  { key: "liftgate_pickup", category: "Equipment" },
  { key: "liftgate_delivery", category: "Equipment" },
  { key: "inside_delivery", category: "Service" },
  { key: "residential_pickup", category: "Location" },
  { key: "residential_delivery", category: "Location" },
  { key: "limited_access", category: "Location" },
  { key: "appointment", category: "Service" },
  { key: "hazmat", category: "Special" },
  { key: "notify_before_delivery", category: "Service" },
];

export const AccessorialSelector = ({ selected, onChange }: AccessorialSelectorProps) => {
  const handleToggle = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Accessorial Services</CardTitle>
        <CardDescription>
          Select any additional services required for pickup or delivery
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ACCESSORIAL_OPTIONS.map(option => (
            <div key={option.key} className="flex items-center space-x-2">
              <Checkbox
                id={option.key}
                checked={selected.includes(option.key)}
                onCheckedChange={() => handleToggle(option.key)}
              />
              <Label
                htmlFor={option.key}
                className="text-sm font-normal cursor-pointer flex-1"
              >
                {getAccessorialName(option.key)}
                <span className="text-xs text-muted-foreground ml-1">
                  ({option.category})
                </span>
              </Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
