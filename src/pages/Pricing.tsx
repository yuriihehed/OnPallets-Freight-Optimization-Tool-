import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AccessorialSelector } from "@/components/AccessorialSelector";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, DollarSign, AlertCircle, TrendingUp, Package, MapPin, Loader2, Truck, TrendingDown, Scale, AlertTriangle } from "lucide-react";
import { calculateLTLPrice, calculateFTLPrice, calculateBrokeragePrice, checkFTLQualification, getAccessorialName, calculateDistance } from "@/lib/pricingCalculations";
import { calculateFreightClass, calculateWeightedFreightClass } from "@/lib/freightClass";
import { PalletData } from "@/components/PalletInputForm";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Pricing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const pallets = (location.state?.pallets as PalletData[]) || [];
  const { toast } = useToast();
  
  const [pickupCity, setPickupCity] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [distance, setDistance] = useState("");
  const [accessorials, setAccessorials] = useState<string[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [marketCondition, setMarketCondition] = useState<"normal" | "tight" | "loose">("normal");
  const [marketMultiplier, setMarketMultiplier] = useState(1.0);
  const [pricingMode, setPricingMode] = useState<"carrier" | "brokerage">("carrier");
  const [loadType, setLoadType] = useState<"ltl" | "ftl">("ltl");
  
  // Calculate freight details from pallets
  const totalWeight = pallets.reduce((sum, p) => sum + p.weight, 0);
  const totalCubicFeet = pallets.reduce((sum, p) => {
    return sum + ((p.length * p.width * p.height) / 1728);
  }, 0);
  
  // Calculate linear feet (simplified - max length used)
  const linearFeet = pallets.reduce((total, p) => total + (p.length / 12), 0);
  
  // Calculate freight class for each pallet
  const freightClassBreakdown = pallets.map(p => ({
    weight: p.weight,
    freightClass: calculateFreightClass(p.length, p.width, p.height, p.weight),
  }));
  
  const weightedClass = calculateWeightedFreightClass(freightClassBreakdown);
  
  // Cube utilization (53' trailer = ~3,816 cu ft usable)
  const cubeUtilization = Math.round((totalCubicFeet / 3816) * 100);
  
  // Check FTL qualification
  const ftlQualification = checkFTLQualification(pallets.length, totalWeight, linearFeet, cubeUtilization);
  
  // Check if FTL was explicitly requested via checkbox
  const isFTLRequested = pallets.some(p => p.isFTL);
  
  // Auto-select FTL if qualified or explicitly requested
  useEffect(() => {
    if ((ftlQualification.isFTL || isFTLRequested) && loadType === "ltl") {
      setLoadType("ftl");
    }
  }, [ftlQualification.isFTL, isFTLRequested]);
  
  // Geocoding and distance calculation
  const handleCalculateRoute = async () => {
    if (!pickupCity.trim() || !deliveryCity.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both pickup and delivery cities",
        variant: "destructive",
      });
      return;
    }

    setIsCalculating(true);
    
    try {
      // Geocode pickup city
      const pickupResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickupCity)}&limit=1`
      );
      const pickupData = await pickupResponse.json();
      
      if (!pickupData || pickupData.length === 0) {
        throw new Error("Pickup city not found");
      }

      // Geocode delivery city
      const deliveryResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(deliveryCity)}&limit=1`
      );
      const deliveryData = await deliveryResponse.json();
      
      if (!deliveryData || deliveryData.length === 0) {
        throw new Error("Delivery city not found");
      }

      // Calculate distance
      const calculatedDistance = calculateDistance(
        parseFloat(pickupData[0].lat),
        parseFloat(pickupData[0].lon),
        parseFloat(deliveryData[0].lat),
        parseFloat(deliveryData[0].lon)
      );

      setDistance(calculatedDistance.toString());

      // Analyze market conditions based on DAT real-time data
      await analyzeMarketConditions(calculatedDistance, pickupCity, deliveryCity);

      toast({
        title: "Route Calculated",
        description: `Distance: ${calculatedDistance} miles`,
      });
    } catch (error) {
      console.error("Geocoding error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to calculate route",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  // Fetch real-time market conditions from DAT
  const analyzeMarketConditions = async (dist: number, pickup: string, delivery: string) => {
    try {
      console.log('Fetching DAT market data...');
      
      const { data, error } = await supabase.functions.invoke('get-dat-market-rates', {
        body: { 
          origin: pickup,
          destination: delivery,
          equipmentType: "V" // V = Van/Dry Van (LTL standard)
        }
      });

      if (error) {
        console.error('DAT API error:', error);
        toast({
          title: "Market Data Unavailable",
          description: "Using standard pricing model",
          variant: "default",
        });
        setMarketMultiplier(1.0);
        setMarketCondition("normal");
        return;
      }

      console.log('DAT market data:', data);

      if (data.success) {
        setMarketMultiplier(data.marketMultiplier);
        setMarketCondition(data.marketCondition);
        
        toast({
          title: "Market Data Updated",
          description: `${data.capacityIndicator} capacity - ${data.trendDirection} trend`,
        });
      } else {
        // Fallback to default if DAT API fails
        console.log('Using default market conditions:', data.details);
        setMarketMultiplier(1.0);
        setMarketCondition("normal");
      }
    } catch (error) {
      console.error('Market analysis error:', error);
      setMarketMultiplier(1.0);
      setMarketCondition("normal");
    }
  };

  // Calculate price estimate with market adjustments
  const distanceNum = parseFloat(distance) || 0;
  const baseEstimate = calculateLTLPrice(
    distanceNum,
    totalWeight,
    freightClassBreakdown.map(f => ({ class: f.freightClass, weight: f.weight })),
    accessorials,
    linearFeet,
    cubeUtilization
  );

  // Calculate FTL pricing
  const ftlEstimate = calculateFTLPrice(
    distanceNum,
    totalWeight,
    linearFeet,
    cubeUtilization,
    accessorials,
    marketMultiplier
  );
  
  // Apply market multiplier to LTL
  const ltlPriceEstimate = {
    ...baseEstimate,
    baseLow: Math.round(baseEstimate.baseLow * marketMultiplier),
    baseHigh: Math.round(baseEstimate.baseHigh * marketMultiplier),
    fuelLow: Math.round(baseEstimate.fuelLow * marketMultiplier),
    fuelHigh: Math.round(baseEstimate.fuelHigh * marketMultiplier),
    totalLow: Math.round((baseEstimate.baseLow + baseEstimate.fuelLow) * marketMultiplier + baseEstimate.accessorialTotal),
    totalHigh: Math.round((baseEstimate.baseHigh + baseEstimate.fuelHigh) * marketMultiplier + baseEstimate.accessorialTotal),
  };
  
  // Convert FTL estimate to PriceEstimate format for brokerage calculation compatibility
  const ftlAsPriceEstimate: typeof ltlPriceEstimate = {
    ...ftlEstimate,
    weightedClass: weightedClass,
    fuelLow: 0, // Fuel included in FTL base rate
    fuelHigh: 0,
  };
  
  // Calculate brokerage pricing based on selected load type
  const priceEstimate = loadType === "ltl" ? ltlPriceEstimate : ftlAsPriceEstimate;
  
  const brokerageEstimate = calculateBrokeragePrice(priceEstimate, distanceNum, marketCondition);
  
  // Determine which price to display
  const displayPrice = pricingMode === "brokerage" ? brokerageEstimate : priceEstimate;
  
  if (pallets.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Load Data</CardTitle>
            <CardDescription>
              Please add freight items first before getting a quote.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Load Builder
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      {/* Header */}
      <header className="border-b bg-card shadow-[var(--shadow-soft)]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">LTL Rate Quote</h1>
                <p className="text-sm text-muted-foreground">Market pricing estimate</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{pallets.length} items</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left Column - Inputs */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Shipment Details
                </CardTitle>
                <CardDescription>
                  Enter pickup and delivery locations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Pricing Mode Selection */}
                <div className="space-y-2 pb-4 border-b">
                  <Label>Pricing Mode</Label>
                  <RadioGroup value={pricingMode} onValueChange={(v) => setPricingMode(v as "carrier" | "brokerage")}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="carrier" id="carrier" />
                      <Label htmlFor="carrier" className="font-normal cursor-pointer">Carrier Quote (What carrier receives)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="brokerage" id="brokerage" />
                      <Label htmlFor="brokerage" className="font-normal cursor-pointer">Brokerage Quote (Shipper + Broker margin)</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                {/* Load Type Selection - Only show if FTL qualified */}
                {ftlQualification.isFTL && (
                  <div className="space-y-2 pb-4 border-b">
                    <Label className="flex items-center gap-2">
                      Load Type
                      <Badge variant="default" className="text-xs">FTL Eligible</Badge>
                    </Label>
                    <RadioGroup value={loadType} onValueChange={(v) => setLoadType(v as "ltl" | "ftl")}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ltl" id="ltl" />
                        <Label htmlFor="ltl" className="font-normal cursor-pointer">LTL (Less Than Truckload)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ftl" id="ftl" />
                        <Label htmlFor="ftl" className="font-normal cursor-pointer">FTL (Full Truckload) - Recommended</Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ftlQualification.reason}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="pickup">Pickup City, State</Label>
                  <Input
                    id="pickup"
                    type="text"
                    placeholder="e.g., Dallas, TX"
                    value={pickupCity}
                    onChange={(e) => setPickupCity(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCalculateRoute()}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery">Delivery City, State</Label>
                  <Input
                    id="delivery"
                    type="text"
                    placeholder="e.g., Atlanta, GA"
                    value={deliveryCity}
                    onChange={(e) => setDeliveryCity(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCalculateRoute()}
                  />
                </div>

                <Button 
                  onClick={handleCalculateRoute} 
                  disabled={isCalculating || !pickupCity.trim() || !deliveryCity.trim()}
                  className="w-full"
                >
                  {isCalculating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Calculating Route...
                    </>
                  ) : (
                    <>Calculate Distance & Market Rates</>
                  )}
                </Button>

                {distance && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Calculated Distance:</span>
                      <span className="text-lg font-bold text-primary">{distance} miles</span>
                    </div>
                    {marketCondition !== "normal" && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Market Condition:</span>
                        <Badge variant={marketCondition === "tight" ? "destructive" : "default"}>
                          {marketCondition === "tight" ? "Tight Capacity" : "Good Capacity"}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Load Summary</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Total Weight:</div>
                    <div className="font-medium text-right">{totalWeight.toLocaleString()} lbs</div>
                    
                    <div className="text-muted-foreground">Linear Feet:</div>
                    <div className="font-medium text-right">{linearFeet.toFixed(1)} ft</div>
                    
                    <div className="text-muted-foreground">Freight Class:</div>
                    <div className="font-medium text-right">Class {weightedClass}</div>
                    
                    <div className="text-muted-foreground">Cube Utilization:</div>
                    <div className="font-medium text-right">{cubeUtilization}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <AccessorialSelector
              selected={accessorials}
              onChange={setAccessorials}
            />
          </div>

          {/* Right Column - Price Breakdown */}
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  {loadType === "ftl" ? <Truck className="h-5 w-5 text-primary" /> : <DollarSign className="h-5 w-5 text-primary" />}
                  <CardTitle>Estimated {loadType.toUpperCase()} Rate {pricingMode === "brokerage" && "(Brokerage)"}</CardTitle>
                </div>
                <CardDescription>
                  Based on current market conditions • {loadType === "ltl" && `Class ${weightedClass} • `}{distanceNum} miles
                  {marketMultiplier !== 1.0 && (
                    <span className="ml-2 text-primary font-medium">
                      • {marketMultiplier > 1.0 ? "+" : ""}{((marketMultiplier - 1) * 100).toFixed(0)}% market adjustment
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Price Range Display */}
                <div className="text-center p-6 bg-primary/5 rounded-lg border-2 border-primary/20">
                  <div className="text-sm text-muted-foreground mb-2">
                    {pricingMode === "brokerage" ? "Shipper Quote (With Broker Margin)" : "Carrier Quote"}
                  </div>
                  <div className="text-4xl font-bold text-primary">
                    ${displayPrice.totalLow.toLocaleString()} - ${displayPrice.totalHigh.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    Average: ${Math.round((displayPrice.totalLow + displayPrice.totalHigh) / 2).toLocaleString()}
                  </div>
                </div>
                
                {/* Brokerage Breakdown */}
                {pricingMode === "brokerage" && (
                  <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Brokerage Breakdown
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Carrier Payment:</span>
                        <span className="font-medium">${priceEstimate.totalLow.toLocaleString()} - ${priceEstimate.totalHigh.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-primary">
                        <span>Brokerage Margin ({brokerageEstimate.brokerageMarkupPercent}%):</span>
                        <span className="font-bold">+${brokerageEstimate.brokerageMarkup.toLocaleString()}</span>
                      </div>
                      <Separator className="my-1" />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Quote to Shipper:</span>
                        <span>${brokerageEstimate.shipperTotalLow.toLocaleString()} - ${brokerageEstimate.shipperTotalHigh.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* FTL vs LTL Comparison */}
                {ftlQualification.isFTL && (
                  <Alert>
                    <Truck className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Load Type Comparison:</strong>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between">
                          <span>LTL Estimate:</span>
                          <span>${ltlPriceEstimate.totalLow.toLocaleString()} - ${ltlPriceEstimate.totalHigh.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>FTL Estimate:</span>
                          <span>${ftlEstimate.totalLow.toLocaleString()} - ${ftlEstimate.totalHigh.toLocaleString()}</span>
                        </div>
                        {ftlEstimate.totalLow < ltlPriceEstimate.totalLow && (
                          <div className="flex items-center gap-1 text-primary font-medium mt-1">
                            <TrendingDown className="h-3 w-3" />
                            <span>Potential savings: ${(ltlPriceEstimate.totalLow - ftlEstimate.totalLow).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Weight Impact on FTL Pricing */}
                {loadType === "ftl" && ftlEstimate.weightTier && (
                  <Card className="border-accent/30 bg-accent/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Scale className="h-4 w-4" />
                        Weight Impact on Pricing
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Load Weight:</span>
                        <span className="font-semibold">{totalWeight.toLocaleString()} lbs</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Weight Category:</span>
                        <Badge variant={
                          ftlEstimate.weightTier === "light" ? "default" :
                          ftlEstimate.weightTier === "medium" ? "secondary" :
                          ftlEstimate.weightTier === "heavy" ? "warning" : "destructive"
                        }>
                          {ftlEstimate.weightTier?.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Rate Adjustment:</span>
                        <span className={
                          (ftlEstimate.weightMultiplier || 1) < 1 ? "font-semibold text-success" : 
                          (ftlEstimate.weightMultiplier || 1) > 1 ? "font-semibold text-warning" : "font-semibold"
                        }>
                          {(ftlEstimate.weightMultiplier || 1) < 1 ? "−" : (ftlEstimate.weightMultiplier || 1) > 1 ? "+" : ""}
                          {Math.abs(((ftlEstimate.weightMultiplier || 1) - 1) * 100).toFixed(0)}%
                        </span>
                      </div>
                      
                      {/* Smart recommendations */}
                      <Alert className="mt-3 border-accent/50">
                        <AlertDescription className="text-xs">
                          {ftlEstimate.weightTier === "light" && (
                            <span>💰 <strong>Savings!</strong> Light loads typically save ~15% on fuel costs due to better efficiency.</span>
                          )}
                          {ftlEstimate.weightTier === "medium" && (
                            <span>✅ <strong>Standard Rate:</strong> Your load falls within the typical weight range for FTL pricing.</span>
                          )}
                          {ftlEstimate.weightTier === "heavy" && (
                            <span>⚠️ <strong>Premium:</strong> Heavy loads incur ~15% higher rates due to increased fuel consumption.</span>
                          )}
                          {ftlEstimate.weightTier === "overweight" && (
                            <span>🚨 <strong>Overweight:</strong> May require special permits. Consider splitting the load into two shipments.</span>
                          )}
                        </AlertDescription>
                      </Alert>
                      
                      {/* Additional weight optimization tips */}
                      {totalWeight > 40000 && totalWeight < 45000 && (
                        <Alert className="border-warning/50 bg-warning/5">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <AlertDescription className="text-xs">
                            <strong>Consider splitting:</strong> Your load is close to max weight (45k lbs). Two lighter loads might cost the same but provide faster delivery and lower risk.
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {totalWeight < 12000 && (
                        <Alert className="border-primary/50 bg-primary/5">
                          <AlertDescription className="text-xs">
                            <strong>Optimization tip:</strong> Your load is light ({totalWeight.toLocaleString()} lbs). Consider consolidating with other shipments or negotiating lower rates due to fuel savings.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                <Separator />
                
                {/* Detailed Breakdown */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Cost Breakdown
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                      <span>Base {loadType === "ftl" ? "Truckload" : "Linehaul"}</span>
                      <span className="font-semibold">
                        ${priceEstimate.baseLow.toLocaleString()} - ${priceEstimate.baseHigh.toLocaleString()}
                      </span>
                    </div>
                    {loadType === "ltl" && (
                      <div className="flex justify-between items-center p-2">
                        <span className="text-muted-foreground">Fuel Surcharge (32%)</span>
                        <span>
                          ${priceEstimate.fuelLow.toLocaleString()} - ${priceEstimate.fuelHigh.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {loadType === "ftl" && (
                      <div className="flex justify-between items-center p-2">
                        <span className="text-muted-foreground">Fuel (Included in rate)</span>
                        <span className="text-xs">${ftlEstimate.ratePerMile.toFixed(2)} per mile</span>
                      </div>
                    )}
                    
                    {accessorials.length > 0 && (
                      <>
                        <Separator className="my-2" />
                        <div className="font-medium text-muted-foreground text-xs mb-1">
                          Accessorial Services:
                        </div>
                        {accessorials.map(acc => (
                          <div key={acc} className="flex justify-between items-center p-2">
                            <span className="text-muted-foreground">{getAccessorialName(acc)}</span>
                            <span>${priceEstimate.accessorialTotal / accessorials.length}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                
                {marketCondition !== "normal" && (
                  <Alert variant={marketCondition === "tight" ? "destructive" : "default"}>
                    <TrendingUp className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Market Insight:</strong> {marketCondition === "tight" 
                        ? "This lane is currently experiencing tight capacity. Rates may be higher than average."
                        : "This lane has good capacity availability. Rates are competitive."}
                    </AlertDescription>
                  </Alert>
                )}

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Disclaimer:</strong> This estimate includes market condition adjustments based on lane characteristics and distance. 
                    {pricingMode === "brokerage" && " Brokerage margins vary by lane density, market conditions, and shipper relationships."} 
                    {loadType === "ftl" && " FTL rates shown are for standard dry van equipment."} 
                    For binding quotes, contact carriers or freight brokers directly.
                  </AlertDescription>
                </Alert>
                
                <div className="pt-4">
                  <Button onClick={() => navigate("/")} variant="outline" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Load Builder
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Freight Class Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Freight Class Breakdown</CardTitle>
                <CardDescription>Individual item classifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {pallets.slice(0, 10).map((pallet, idx) => {
                    const itemClass = calculateFreightClass(pallet.length, pallet.width, pallet.height, pallet.weight);
                    const density = (pallet.weight / ((pallet.length * pallet.width * pallet.height) / 1728)).toFixed(1);
                    
                    return (
                      <div key={idx} className="flex justify-between items-center p-2 bg-muted/20 rounded">
                        <div>
                          <div className="font-medium">{pallet.type || "Item"} {idx + 1}</div>
                          <div className="text-xs text-muted-foreground">
                            {pallet.length}"×{pallet.width}"×{pallet.height}" • {pallet.weight} lbs • {density} lb/cu ft
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-primary">Class {itemClass}</div>
                        </div>
                      </div>
                    );
                  })}
                  {pallets.length > 10 && (
                    <div className="text-center text-muted-foreground text-xs pt-2">
                      ... and {pallets.length - 10} more items
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pricing;
