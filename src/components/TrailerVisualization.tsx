import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, PerspectiveCamera } from "@react-three/drei";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Layers } from "lucide-react";
import * as THREE from "three";
import type { PalletData } from "./PalletInputForm";
import { calculatePlacedPallets, TRAILER_LENGTH, TRAILER_WIDTH, TRAILER_HEIGHT } from "@/lib/axleCalculations";

// Trailer dimensions imported from axleCalculations

interface TrailerVisualizationProps {
  pallets: PalletData[];
}

const Pallet = ({ position, dimensions, color }: { 
  position: [number, number, number]; 
  dimensions: [number, number, number];
  color: string;
}) => {
  return (
    <mesh position={position}>
      <boxGeometry args={dimensions} />
      <meshStandardMaterial color={color} opacity={0.8} transparent />
    </mesh>
  );
};

const TrailerOutline = () => {
  return (
    <group>
      {/* Floor - positioned at the bottom (y=0) */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TRAILER_LENGTH / 10, TRAILER_WIDTH / 10]} />
        <meshStandardMaterial color="#1e40af" opacity={0.2} transparent />
      </mesh>
      
      {/* Grid lines on floor */}
      <gridHelper 
        args={[TRAILER_LENGTH / 10, 10, "#3b82f6", "#6366f1"]} 
        position={[0, 0.01, 0]}
      />
      
      {/* Walls outline - positioned so floor is at y=0 */}
      <group position={[0, TRAILER_HEIGHT / 20, 0]}>
        <lineSegments>
          <edgesGeometry 
            attach="geometry" 
            args={[new THREE.BoxGeometry(TRAILER_LENGTH / 10, TRAILER_HEIGHT / 10, TRAILER_WIDTH / 10)]} 
          />
          <lineBasicMaterial attach="material" color="#1e40af" linewidth={2} />
        </lineSegments>
      </group>
    </group>
  );
};

const Scene = ({ pallets }: { pallets: PalletData[] }) => {
  // Use the same placement algorithm as calculations
  const placedPalletsData = calculatePlacedPallets(pallets);
  
  // Convert to 3D visualization format with coordinate transformation
  const placedPallets = placedPalletsData.map((placed, index) => {
    const { pallet, xPos, zPos, isStacked, exceedsCapacity } = placed;
    
    // Get oriented dimensions (L along trailer, W across trailer)
    const orientation = (() => {
      const innerWidth = TRAILER_WIDTH;
      const can2Original = (pallet.width * 2) <= innerWidth;
      const shouldRotate = can2Original && pallet.length > pallet.width;
      return {
        L: shouldRotate ? pallet.width : pallet.length,
        W: shouldRotate ? pallet.length : pallet.width,
      };
    })();
    
    // Convert from axleCalculations coordinate system to 3D centered coordinates
    // axleCalculations: xPos = 0 to 636 (from front), zPos = 0 to 102 (from left)
    // 3D: x centered at 0, z centered at 0 (scaled by /10)
    const x3D = (xPos / 10) - (TRAILER_LENGTH / 20);
    const z3D = (zPos / 10) - (TRAILER_WIDTH / 20);
    
    // Calculate Y position based on stacking
    let y3D: number;
    if (isStacked) {
      // Find the pallet we're stacked on
      const stackedOnIndex = placedPalletsData.findIndex(p => 
        p.xPos === xPos && p.zPos === zPos && !p.isStacked
      );
      if (stackedOnIndex !== -1) {
        const bottomPallet = placedPalletsData[stackedOnIndex].pallet;
        y3D = (bottomPallet.height / 10) + (pallet.height / 10 / 2);
      } else {
        y3D = pallet.height / 10 / 2;
      }
    } else {
      y3D = pallet.height / 10 / 2;
    }
    
    // Color based on weight OR if it exceeds capacity
    const weightRatio = pallet.weight / 2000;
    const color = exceedsCapacity 
      ? "#dc2626" // Bright red for overflow
      : weightRatio > 1.5 ? "#ef4444" : weightRatio > 1 ? "#f59e0b" : "#22c55e";
    
    return {
      position: [x3D, y3D, z3D] as [number, number, number],
      dimensions: [orientation.L / 10, pallet.height / 10, orientation.W / 10] as [number, number, number],
      color,
      id: pallet.id,
      isStacked,
      exceedsCapacity,
    };
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[80, 40, 80]} />
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        maxPolarAngle={Math.PI / 2 - 0.1}
        minPolarAngle={0}
      />
      
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 5]} intensity={1} />
      <directionalLight position={[-10, 20, -5]} intensity={0.5} />
      <hemisphereLight args={["#ffffff", "#444444", 0.4]} />
      
      <TrailerOutline />
      
      {placedPallets.map((pallet) => (
        <Pallet
          key={pallet.id}
          position={pallet.position}
          dimensions={pallet.dimensions}
          color={pallet.color}
        />
      ))}
    </>
  );
};

export const TrailerVisualization = ({ pallets }: TrailerVisualizationProps) => {
  return (
    <Card className="shadow-[var(--shadow-medium)]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <CardTitle>53' Dry Van Visualization</CardTitle>
        </div>
        <CardDescription>
          Interactive 3D view - drag to rotate, scroll to zoom
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[500px] bg-muted rounded-lg overflow-hidden">
          <Canvas>
            <Scene pallets={pallets} />
          </Canvas>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-success rounded" />
            <span>Normal Weight</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-warning rounded" />
            <span>Heavy (2,000-3,000 lbs)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-destructive rounded" />
            <span>Overweight (&gt;3,000 lbs)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#dc2626" }} />
            <span>Exceeds Trailer Capacity - Needs Another Trailer</span>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span>Double-stacked pallets</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
