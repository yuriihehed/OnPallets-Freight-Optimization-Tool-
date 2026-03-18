import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DATAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface DATRateQuoteRequest {
  origin: string;
  destination: string;
  equipmentType?: string;
}

interface MarketRateResponse {
  success: boolean;
  marketMultiplier: number;
  marketCondition: "normal" | "tight" | "loose";
  averageRate?: number;
  capacityIndicator?: string;
  trendDirection?: string;
  details?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin, destination, equipmentType = "V" } = await req.json() as DATRateQuoteRequest;
    
    console.log(`Fetching DAT rates for: ${origin} -> ${destination}`);

    if (!origin || !destination) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Origin and destination are required",
          marketMultiplier: 1.0,
          marketCondition: "normal"
        } as MarketRateResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const clientId = Deno.env.get('DAT_API_CLIENT_ID');
    const clientSecret = Deno.env.get('DAT_API_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('DAT API credentials not configured');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "DAT API credentials not configured",
          marketMultiplier: 1.0,
          marketCondition: "normal",
          details: "Using default market conditions"
        } as MarketRateResponse),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 1: Authenticate with DAT API
    console.log('Authenticating with DAT API...');
    const authResponse = await fetch('https://freight.api.dat.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'rateview',
      }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('DAT authentication failed:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to authenticate with DAT API",
          marketMultiplier: 1.0,
          marketCondition: "normal",
          details: "Using default market conditions"
        } as MarketRateResponse),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const authData = await authResponse.json() as DATAuthResponse;
    console.log('DAT authentication successful');

    // Step 2: Get rate quote from DAT RateView API
    console.log('Fetching rate quote from DAT...');
    const rateResponse = await fetch('https://freight.api.dat.com/v2/rateview/quote', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin: { city: origin.split(',')[0]?.trim(), state: origin.split(',')[1]?.trim() },
        destination: { city: destination.split(',')[0]?.trim(), state: destination.split(',')[1]?.trim() },
        equipmentType: equipmentType, // V = Van/Dry Van, R = Reefer, F = Flatbed
      }),
    });

    if (!rateResponse.ok) {
      const errorText = await rateResponse.text();
      console.error('DAT rate quote failed:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to fetch rates from DAT",
          marketMultiplier: 1.0,
          marketCondition: "normal",
          details: "Using default market conditions"
        } as MarketRateResponse),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const rateData = await rateResponse.json();
    console.log('DAT rate data received:', JSON.stringify(rateData, null, 2));

    // Step 3: Analyze market conditions from DAT data
    let marketMultiplier = 1.0;
    let marketCondition: "normal" | "tight" | "loose" = "normal";
    let capacityIndicator = "Balanced";
    let trendDirection = "Stable";

    // Parse DAT response for market indicators
    // DAT typically provides: spotRate, contractRate, loadToTruckRatio, trends
    if (rateData.loadToTruckRatio) {
      const ltr = parseFloat(rateData.loadToTruckRatio);
      
      // Load-to-Truck Ratio analysis
      // > 4.0 = Very tight capacity (more loads than trucks)
      // 2.0-4.0 = Tight capacity
      // 1.0-2.0 = Balanced
      // < 1.0 = Loose capacity (more trucks than loads)
      
      if (ltr > 4.0) {
        marketMultiplier = 1.20;
        marketCondition = "tight";
        capacityIndicator = "Very Tight";
      } else if (ltr > 2.0) {
        marketMultiplier = 1.10;
        marketCondition = "tight";
        capacityIndicator = "Tight";
      } else if (ltr < 1.0) {
        marketMultiplier = 0.90;
        marketCondition = "loose";
        capacityIndicator = "Loose";
      }
    }

    // Trend analysis
    if (rateData.trend) {
      trendDirection = rateData.trend;
      if (rateData.trend === "Increasing" || rateData.trend === "Up") {
        marketMultiplier *= 1.05;
      } else if (rateData.trend === "Decreasing" || rateData.trend === "Down") {
        marketMultiplier *= 0.95;
      }
    }

    // Get average spot rate if available
    const averageRate = rateData.spotRate || rateData.averageRate || null;

    console.log(`Market analysis complete: ${marketCondition}, multiplier: ${marketMultiplier}`);

    return new Response(
      JSON.stringify({
        success: true,
        marketMultiplier: Math.round(marketMultiplier * 100) / 100,
        marketCondition,
        averageRate,
        capacityIndicator,
        trendDirection,
        details: `DAT market data - Load-to-Truck Ratio: ${rateData.loadToTruckRatio || 'N/A'}`,
      } as MarketRateResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in get-dat-market-rates function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        marketMultiplier: 1.0,
        marketCondition: "normal",
        details: "Using default market conditions due to error"
      } as MarketRateResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
