import { Request, Response } from "express";
import { dynamo_searchByMultipleAttributes } from "../../functions/dynamo";

/**
 * Example: accurate(ish) energy consumption by using consecutive readings.
 * Also processes occupancy data from Lorawan sensors by calculating 
 * abs(line_1_total_in - line_1_total_out) for each sensor.
 */
export async function getSensorReadingsController(req: Request, res: Response) {
  console.log("getSensorReadingsController called");
  try {
    const { db } = req.app as any; 
    const { buildingId, floorPlanId } = req.params;
    const { timeRange = "today", customStart, customEnd } = req.query;

    if (!buildingId || !floorPlanId) {
      return res
        .status(400)
        .json({ message: "BuildingId and FloorPlanId are required" });
    }

    // 1) Determine date range
    let now = new Date();
    let startDate: Date;

    if (customStart && customEnd) {
      startDate = new Date(customStart as string);
      now = new Date(customEnd as string);
    } else {
      switch (timeRange) {
        case "today":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          break;
        case "week":
          // Last 7 days
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 7
          );
          break;
        case "month":
          // Last 30 days
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 30
          );
          break;
        case "year":
          // Last 365 days
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 365
          );
          break;
        default:
          // fallback: 'today'
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
      }
    }

    // 2) Fetch all readings from DB
    const allReadings = await db
      .collection("readings")
      .find({
        buildingId,
        floorPlanId,
        // If you have a dateTime field: { dateTime: { $gte: startDate, $lte: now } },
      })
      .toArray();

    // (Optional) Your Dynamo function
    dynamo_searchByMultipleAttributes("readings", { buildingId, floorPlanId });

    if (!allReadings || allReadings.length === 0) {
      return res.status(404).json({ message: "No sensor readings found." });
    }

    // 3) Filter by date range
    const filtered = allReadings.filter((r) => {
      const dateTime = new Date(`${r.date} ${r.time}`);
      return dateTime >= startDate && dateTime <= now;
    });

    if (filtered.length === 0) {
      return res
        .status(404)
        .json({ message: "No sensor readings found for the specified range." });
    }

    // 4) Process them
    const processedData = processSensorReadings(filtered, timeRange as string);

    return res.status(200).json({ data: processedData });
  } catch (error) {
    console.error("Error in getSensorReadingsController:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * A more accurate aggregator that now includes occupancy calculations
 */
function processSensorReadings(readings: any[], timeRange: string) {
  // 1) Group readings by day/hour/week as before
  const aggregator: Record<
    string,
    {
      timestamp: string;       // e.g. "Jan 25"
      realDates: Date[];       // store actual Date objects for correct sorting
      energy: number; 
      cost: number; 
      temperatureSum: number;
      temperatureCount: number;
      humiditySum: number;
      humidityCount: number;
      occupancy: number; 
      rawReadings: any[]; 
    }
  > = {};

  // Decide grouping key for display
  const getGroupKey = (dt: Date) => {
    switch (timeRange) {
      case "today":
        // group by hour => e.g. "08:00"
        return dt.getHours().toString().padStart(2, "0") + ":00";

      case "week":
        // group by date => e.g. "Jan 25"
        return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      case "month":
        // group by date => e.g. "Jan 25"
        return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      case "year":
        // group by month-year => e.g. "Jan 2025"
        return dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });

      default:
        // fallback, group by hour
        return dt.getHours().toString().padStart(2, "0") + ":00";
    }
  };

  // Initialize the aggregator
  for (const r of readings) {
    const dt = new Date(`${r.date} ${r.time}`);
    const key = getGroupKey(dt);

    if (!aggregator[key]) {
      aggregator[key] = {
        timestamp: key,
        realDates: [],
        energy: 0,
        cost: 0,
        temperatureSum: 0,
        temperatureCount: 0,
        humiditySum: 0,
        humidityCount: 0,
        occupancy: 0,
        rawReadings: [],
      };
    }

    aggregator[key].realDates.push(dt);     // keep the real date
    aggregator[key].rawReadings.push(r);
  }

  // 2) Process each group
  Object.values(aggregator).forEach((group) => {
    // Sort the group's rawReadings by their actual Date
    group.rawReadings.sort((a, b) => {
      const aDt = new Date(`${a.date} ${a.time}`);
      const bDt = new Date(`${b.date} ${b.time}`);
      return aDt.getTime() - bDt.getTime();
    });

    let totalEnergyKWh = 0;

    // Energy calculation: sum over consecutive readings
    for (let i = 0; i < group.rawReadings.length - 1; i++) {
      const curr = group.rawReadings[i];
      const next = group.rawReadings[i + 1];

      const currDt = new Date(`${curr.date} ${curr.time}`);
      const nextDt = new Date(`${next.date} ${next.time}`);

      const hoursDiff = (nextDt.getTime() - currDt.getTime()) / (1000 * 60 * 60);

      const currPower = extractPower(curr);
      const nextPower = extractPower(next);

      const avgPower = (currPower + nextPower) / 2;
      const partialEnergy = avgPower * hoursDiff;
      totalEnergyKWh += partialEnergy;
    }

    // Calculate cost
    const cost = totalEnergyKWh * 0.24;

    group.energy = parseFloat(totalEnergyKWh.toFixed(3));
    group.cost = parseFloat(cost.toFixed(2));

    // Process temperature, humidity, and occupancy
    group.rawReadings.forEach((reading) => {
      // Temperature
      const tVals = Object.values(reading.Lorawan_Readings || {})
        .map((dev: any) => dev.temperature)
        .filter((temp: any) => typeof temp === "number");

      if (tVals.length > 0) {
        const sumT = tVals.reduce((acc, v) => acc + v, 0);
        group.temperatureSum += sumT;
        group.temperatureCount += tVals.length;
      }

      // Humidity
      const hVals = Object.values(reading.Lorawan_Readings || {})
        .map((dev: any) => dev.humidity)
        .filter((h: any) => typeof h === "number");

      if (hVals.length > 0) {
        const sumH = hVals.reduce((acc, v) => acc + v, 0);
        group.humiditySum += sumH;
        group.humidityCount += hVals.length;
      }

      // Occupancy
      const occupancyValue = calculateOccupancy(reading.Lorawan_Readings || {});
      group.occupancy = occupancyValue; // store the *latest* reading's occupancy
    });
  });

  // 3) Convert aggregator to array, calculate final averages
  const result = Object.values(aggregator).map((g) => {
    // sort the real dates so we can pick the earliest date in the group
    g.realDates.sort((a, b) => a.getTime() - b.getTime());
    const earliestDate = g.realDates[0];

    const avgTemp =
      g.temperatureCount > 0 ? g.temperatureSum / g.temperatureCount : 0;
    const avgHum =
      g.humidityCount > 0 ? g.humiditySum / g.humidityCount : 0;

    return {
      // The label you want to display
      timestamp: g.timestamp, 

      // Keep the earliest real date in this group for correct sorting
      sortDate: earliestDate,

      energy: g.energy,
      cost: g.cost,
      temperature: parseFloat(avgTemp.toFixed(1)),
      humidity: parseFloat(avgHum.toFixed(1)),
      occupancy: g.occupancy,
    };
  });

  // 4) Sort results by the actual Date object
  sortResults(result);

  return result;
}

/**
 * Calculate occupancy by summing the difference of line_1_total_in/out for each sensor
 */
function calculateOccupancy(lorawanReadings: Record<string, any>): number {
  let totalIn = 0;
  let totalOut = 0;

  Object.values(lorawanReadings).forEach((device: any) => {
    if (typeof device.line_1_total_in === "number") {
      totalIn += device.line_1_total_in;
    }
    if (typeof device.line_1_total_out === "number") {
      totalOut += device.line_1_total_out;
    }
  });

  let totalOccupancy = totalIn - totalOut;
  if (totalOccupancy < 0) {
    totalOccupancy = 0;
  }
  return totalOccupancy;
}

/** 
 * Extract total power (in kW) from a single reading object
 */
function extractPower(reading: any): number {
  const sumPower: any = Object.values(reading.Energy_Readings || {}).reduce(
    (acc: number, sensor: any) => acc + (sensor.Power || 0),
    0
  );
  return sumPower;
}

/** 
 * Sort results purely by the real date we stored
 */
function sortResults(results: any[]) {
  results.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
}