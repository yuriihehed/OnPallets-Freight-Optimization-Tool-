// NMFC Freight Classification System (Density-Based, 2025 Standard)

export interface FreightClassInfo {
  class: number;
  minDensity: number;
  maxDensity: number;
  description: string;
}

export const FREIGHT_CLASSES: FreightClassInfo[] = [
  { class: 50, minDensity: 50, maxDensity: Infinity, description: "Over 50 lbs/cu ft - Dense items" },
  { class: 55, minDensity: 35, maxDensity: 50, description: "35-50 lbs/cu ft - Heavy items" },
  { class: 60, minDensity: 30, maxDensity: 35, description: "30-35 lbs/cu ft - Moderately heavy" },
  { class: 65, minDensity: 22.5, maxDensity: 30, description: "22.5-30 lbs/cu ft - Moderately heavy" },
  { class: 70, minDensity: 15, maxDensity: 22.5, description: "15-22.5 lbs/cu ft - Average density" },
  { class: 77.5, minDensity: 13.5, maxDensity: 15, description: "13.5-15 lbs/cu ft - Average density" },
  { class: 85, minDensity: 12, maxDensity: 13.5, description: "12-13.5 lbs/cu ft - Below average" },
  { class: 92.5, minDensity: 10.5, maxDensity: 12, description: "10.5-12 lbs/cu ft - Below average" },
  { class: 100, minDensity: 9, maxDensity: 10.5, description: "9-10.5 lbs/cu ft - Light-medium" },
  { class: 110, minDensity: 8, maxDensity: 9, description: "8-9 lbs/cu ft - Light" },
  { class: 125, minDensity: 7, maxDensity: 8, description: "7-8 lbs/cu ft - Light" },
  { class: 150, minDensity: 6, maxDensity: 7, description: "6-7 lbs/cu ft - Very light" },
  { class: 175, minDensity: 5, maxDensity: 6, description: "5-6 lbs/cu ft - Very light" },
  { class: 200, minDensity: 4, maxDensity: 5, description: "4-5 lbs/cu ft - Extremely light" },
  { class: 250, minDensity: 3, maxDensity: 4, description: "3-4 lbs/cu ft - Extremely light" },
  { class: 300, minDensity: 2, maxDensity: 3, description: "2-3 lbs/cu ft - Ultra-light" },
  { class: 400, minDensity: 1, maxDensity: 2, description: "1-2 lbs/cu ft - Ultra-light" },
  { class: 500, minDensity: 0, maxDensity: 1, description: "Under 1 lb/cu ft - Lightest" },
];

/**
 * Calculate freight class based on density (weight/cubic feet)
 * 2025 NMFC density-based classification
 */
export const calculateFreightClass = (
  weight: number, // pounds
  length: number, // inches
  width: number,  // inches
  height: number  // inches
): number => {
  // Calculate cubic feet
  const cubicInches = length * width * height;
  const cubicFeet = cubicInches / 1728; // 12^3 = 1728 cubic inches per cubic foot
  
  // Calculate density (lbs per cubic foot)
  const density = weight / cubicFeet;
  
  // Find matching class
  for (const classInfo of FREIGHT_CLASSES) {
    if (density > classInfo.minDensity && density <= classInfo.maxDensity) {
      return classInfo.class;
    }
  }
  
  // Fallback to densest class if over 50 lbs/cu ft
  if (density > 50) return 50;
  
  // Fallback to lightest class if under 1 lb/cu ft
  return 500;
};

/**
 * Get class info by class number
 */
export const getClassInfo = (classNumber: number): FreightClassInfo | undefined => {
  return FREIGHT_CLASSES.find(c => c.class === classNumber);
};

/**
 * Calculate weighted average freight class for multiple items
 */
export const calculateWeightedFreightClass = (
  items: Array<{ weight: number; freightClass: number }>
): number => {
  if (items.length === 0) return 0;
  
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  
  // Weight each class by its proportion of total weight
  const weightedSum = items.reduce((sum, item) => {
    return sum + (item.freightClass * (item.weight / totalWeight));
  }, 0);
  
  // Round to nearest valid class
  const roundedClass = Math.round(weightedSum);
  
  // Find closest valid class
  const closestClass = FREIGHT_CLASSES.reduce((prev, curr) => {
    return Math.abs(curr.class - roundedClass) < Math.abs(prev.class - roundedClass) ? curr : prev;
  });
  
  return closestClass.class;
};
