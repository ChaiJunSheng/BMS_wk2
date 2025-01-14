import { Request, Response } from "express";

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
      return res.status(400).json({ message: "BuildingId and FloorPlanId are required" });
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
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); 
          break;
        case "week":
          // Last 7 days
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          break;
        case "month":
          // ~ Last 30 days
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
          break;
        case "year":
          // Last 365 days
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 365);
          break;
        default:
          // fallback: 'today'
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
    }

    // 2) Fetch all readings from DB
    const allReadings = await db.collection("readings").find({
      buildingId,
      floorPlanId,
      // If you have a dateTime field: dateTime: { $gte: startDate, $lte: now },
    }).toArray();

    if (!allReadings || allReadings.length === 0) {
      return res.status(404).json({ message: "No sensor readings found." });
    }

    // 3) Filter by date range (if we only have date/time fields, do local filter)
    const filtered = allReadings.filter((r) => {
      const dateTime = new Date(`${r.date} ${r.time}`);
      return dateTime >= startDate && dateTime <= now;
    });

    if (filtered.length === 0) {
      return res.status(404).json({ message: "No sensor readings found for the specified range." });
    }

    // 4) Process them using a more accurate method for energy
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
  const aggregator: Record<string, {
    timestamp: string;
    energy: number;      // total kWh
    cost: number;        // S$ cost
    temperatureSum: number;
    temperatureCount: number;
    humiditySum: number;
    humidityCount: number;
    occupancy: number;   // Current occupancy value
    rawReadings: any[];  // we'll store the actual readings to do pairwise calc
  }> = {};

  // Decide grouping key
  const getGroupKey = (dt: Date) => {
    switch (timeRange) {
      case "today":
        // group by hour
        return dt.getHours().toString().padStart(2, "0") + ":00";
      case "week":
        // group by actual date, e.g., "Oct 25"
        return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      case "month":
        // group by "Week 1", "Week 2", etc.
        const weekOfMonth = Math.ceil(dt.getDate() / 7);
        return `Week ${weekOfMonth}`;
      case "year":
        // group by month, e.g. "Jan"
        return dt.toLocaleDateString("en-US", { month: "short" });
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
        energy: 0,
        cost: 0,
        temperatureSum: 0,
        temperatureCount: 0,
        humiditySum: 0,
        humidityCount: 0,
        occupancy: 0,    // Initialize occupancy
        rawReadings: [],
      };
    }
    aggregator[key].rawReadings.push(r);
  }

  // 2) Process each group
  Object.values(aggregator).forEach((group) => {
    // Sort the group's rawReadings by dateTime
    group.rawReadings.sort((a, b) => {
      const aDt = new Date(`${a.date} ${a.time}`);
      const bDt = new Date(`${b.date} ${b.time}`);
      return aDt.getTime() - bDt.getTime();
    });

    let totalEnergyKWh = 0;

    // Energy calculation
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
      // Temperature processing
      const tVals = Object.values(reading.Lorawan_Readings || {})
        .map((dev: any) => dev.temperature)
        .filter((temp: any) => typeof temp === "number");

      if (tVals.length > 0) {
        const sumT = tVals.reduce((acc, v) => acc + v, 0);
        group.temperatureSum += sumT;
        group.temperatureCount += tVals.length;
      }

      // Humidity processing
      const hVals = Object.values(reading.Lorawan_Readings || {})
        .map((dev: any) => dev.humidity)
        .filter((h: any) => typeof h === "number");

      if (hVals.length > 0) {
        const sumH = hVals.reduce((acc, v) => acc + v, 0);
        group.humiditySum += sumH;
        group.humidityCount += hVals.length;
      }

      // Occupancy processing
      const occupancyValue = calculateOccupancy(reading.Lorawan_Readings || {});
      group.occupancy = occupancyValue; // Store the latest occupancy value
    });
  });

  // 3) Convert aggregator to array, calculate final averages
  const result = Object.values(aggregator).map((g) => {
    const avgTemp = g.temperatureCount > 0 ? g.temperatureSum / g.temperatureCount : 0;
    const avgHum = g.humidityCount > 0 ? g.humiditySum / g.humidityCount : 0;

    return {
      timestamp: g.timestamp,
      energy: g.energy,
      cost: g.cost,
      temperature: parseFloat(avgTemp.toFixed(1)),
      humidity: parseFloat(avgHum.toFixed(1)),
      occupancy: g.occupancy,
    };
  });

  // 4) Sort results
  sortResults(result, timeRange);

  return result;
}

/**
 * Calculate occupancy from Lorawan readings by summing the absolute differences
 * between line_1_total_in and line_1_total_out for each sensor
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

  // If you'd like to avoid negative values, you could return Math.max(0, totalIn - totalOut).
  // If you want the absolute difference, do Math.abs(totalIn - totalOut)
  var totalOccupancy = totalIn - totalOut;
  if (totalOccupancy < 0) {
    totalOccupancy = 0;
  }

  return totalOccupancy
}

/** 
 * Utility to extract the power in kW from a single reading object.
 */
function extractPower(reading: any): number {
  const sumPower: any = Object.values(reading.Energy_Readings || {}).reduce(
    (acc: number, sensor: any) => acc + (sensor.Power || 0),
    0
  );
  return sumPower;
}

/** 
 * Sort results based on timeRange 
 */
function sortResults(results: any[], timeRange: string) {
  if (timeRange === "today") {
    // sort by hour
    results.sort((a, b) => {
      const aHour = parseInt(a.timestamp, 10);
      const bHour = parseInt(b.timestamp, 10);
      return aHour - bHour;
    });
  } else if (timeRange === "week") {
    // e.g. "Oct 25", "Oct 26"
    results.sort((a, b) => {
      const dateA = new Date(`${a.timestamp} ${new Date().getFullYear()}`);
      const dateB = new Date(`${b.timestamp} ${new Date().getFullYear()}`);
      return dateA.getTime() - dateB.getTime();
    });
  } else if (timeRange === "month") {
    // "Week 1", "Week 2", ...
    results.sort((a, b) => {
      const wA = parseInt(a.timestamp.replace("Week ", ""), 10);
      const wB = parseInt(b.timestamp.replace("Week ", ""), 10);
      return wA - wB;
    });
  } else if (timeRange === "year") {
    // sort by month order
    const monthsOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    results.sort((a, b) => {
      return monthsOrder.indexOf(a.timestamp) - monthsOrder.indexOf(b.timestamp);
    });
  }
}