import type { SalesTrend } from "@/lib/types/database";

/**
 * Simple linear regression for sales forecasting
 */
function linearRegression(data: number[]): { slope: number; intercept: number } {
  const n = data.length;
  const indices = Array.from({ length: n }, (_, i) => i);

  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = data.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((sum, x, i) => sum + x * data[i], 0);
  const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Forecast future sales using linear regression
 */
export function forecastSales(
  historicalData: SalesTrend[],
  periodsAhead: number = 3
): Array<{ month: string; revenue: number; isForecast: boolean }> {
  if (historicalData.length < 3) {
    throw new Error("Need at least 3 data points for forecasting");
  }

  const revenues = historicalData.map((d) => Number(d.revenue));
  const { slope, intercept } = linearRegression(revenues);

  // Calculate trend strength
  const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
  const trendStrength = Math.abs(slope / avgRevenue);

  // Apply seasonal adjustment (simplified)
  const seasonalFactors = calculateSeasonalFactors(revenues);

  const forecasts: Array<{ month: string; revenue: number; isForecast: boolean }> = [
    ...historicalData.map((d) => ({
      month: d.month,
      revenue: Number(d.revenue),
      isForecast: false,
    })),
  ];

  const lastDate = new Date(historicalData[historicalData.length - 1].month);

  for (let i = 1; i <= periodsAhead; i++) {
    const nextIndex = revenues.length + i - 1;
    let forecastValue = slope * nextIndex + intercept;

    // Apply seasonal adjustment
    const seasonalIndex = nextIndex % 12;
    forecastValue *= seasonalFactors[seasonalIndex];

    // Ensure positive values
    forecastValue = Math.max(0, forecastValue);

    const nextDate = new Date(lastDate);
    nextDate.setMonth(nextDate.getMonth() + i);

    forecasts.push({
      month: nextDate.toISOString().split("T")[0],
      revenue: Math.round(forecastValue * 100) / 100,
      isForecast: true,
    });
  }

  return forecasts;
}

/**
 * Calculate seasonal factors (simplified)
 */
function calculateSeasonalFactors(data: number[]): number[] {
  const seasonalFactors = Array(12).fill(1);

  if (data.length >= 12) {
    const avgRevenue = data.reduce((a, b) => a + b, 0) / data.length;

    // Calculate average for each month position
    for (let month = 0; month < 12; month++) {
      const monthValues = data.filter((_, i) => i % 12 === month);
      if (monthValues.length > 0) {
        const monthAvg = monthValues.reduce((a, b) => a + b, 0) / monthValues.length;
        seasonalFactors[month] = monthAvg / avgRevenue;
      }
    }
  }

  return seasonalFactors;
}

/**
 * Analyze trends in sales data
 */
export interface TrendAnalysis {
  direction: "up" | "down" | "stable";
  strength: "strong" | "moderate" | "weak";
  growthRate: number; // Percentage
  description: string;
}

export function analyzeTrend(data: SalesTrend[]): TrendAnalysis {
  if (data.length < 2) {
    return {
      direction: "stable",
      strength: "weak",
      growthRate: 0,
      description: "Insufficient data for trend analysis",
    };
  }

  const revenues = data.map((d) => Number(d.revenue));
  const { slope } = linearRegression(revenues);

  const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
  const growthRate = (slope / avgRevenue) * 100;

  let direction: "up" | "down" | "stable";
  let strength: "strong" | "moderate" | "weak";

  if (Math.abs(growthRate) < 1) {
    direction = "stable";
    strength = "weak";
  } else if (growthRate > 0) {
    direction = "up";
    strength = growthRate > 5 ? "strong" : growthRate > 2 ? "moderate" : "weak";
  } else {
    direction = "down";
    strength = growthRate < -5 ? "strong" : growthRate < -2 ? "moderate" : "weak";
  }

  const description = `Sales show a ${strength} ${direction}ward trend with a ${Math.abs(growthRate).toFixed(1)}% ${
    direction === "up" ? "growth" : direction === "down" ? "decline" : "change"
  } rate.`;

  return {
    direction,
    strength,
    growthRate: Math.round(growthRate * 100) / 100,
    description,
  };
}

/**
 * Detect anomalies using statistical methods (Z-score)
 */
export interface Anomaly {
  index: number;
  month: string;
  revenue: number;
  zScore: number;
  type: "high" | "low";
  description: string;
}

export function detectAnomalies(data: SalesTrend[], threshold: number = 2): Anomaly[] {
  if (data.length < 3) {
    return [];
  }

  const revenues = data.map((d) => Number(d.revenue));

  // Calculate mean and standard deviation
  const mean = revenues.reduce((a, b) => a + b, 0) / revenues.length;
  const variance =
    revenues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / revenues.length;
  const stdDev = Math.sqrt(variance);

  const anomalies: Anomaly[] = [];

  data.forEach((item, index) => {
    const revenue = Number(item.revenue);
    const zScore = (revenue - mean) / stdDev;

    if (Math.abs(zScore) > threshold) {
      anomalies.push({
        index,
        month: item.month,
        revenue,
        zScore: Math.round(zScore * 100) / 100,
        type: zScore > 0 ? "high" : "low",
        description: `${
          zScore > 0 ? "Unusually high" : "Unusually low"
        } sales detected (${Math.abs(zScore).toFixed(1)} standard deviations ${
          zScore > 0 ? "above" : "below"
        } average)`,
      });
    }
  });

  return anomalies;
}

/**
 * Classify sales performance
 */
export interface Classification {
  category: "excellent" | "good" | "average" | "poor";
  percentile: number;
  description: string;
}

export function classifyPerformance(
  currentRevenue: number,
  historicalData: number[]
): Classification {
  const sorted = [...historicalData].sort((a, b) => a - b);
  const position = sorted.findIndex((val) => currentRevenue <= val);
  const percentile =
    position === -1 ? 100 : (position / sorted.length) * 100;

  let category: Classification["category"];
  let description: string;

  if (percentile >= 90) {
    category = "excellent";
    description = "Performance is in the top 10% of historical data";
  } else if (percentile >= 70) {
    category = "good";
    description = "Performance is above average";
  } else if (percentile >= 30) {
    category = "average";
    description = "Performance is within normal range";
  } else {
    category = "poor";
    description = "Performance is below average and needs attention";
  }

  return {
    category,
    percentile: Math.round(percentile),
    description,
  };
}

/**
 * Calculate moving average for smoothing trends
 */
export function calculateMovingAverage(
  data: number[],
  window: number = 3
): number[] {
  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(data[i]);
    } else {
      const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / window);
    }
  }

  return result;
}
