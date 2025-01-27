import { Request, Response } from "express";
import { dynamo_searchByMultipleAttributes } from "../../functions/dynamo";

interface EnergyReading {
  date: string;   // e.g. "Fri Nov 15 2024"
  time: string;   // e.g. "4:25:07 PM"
  Energy_Readings: {
    [sensorName: string]: {
      Current: number;
      Energy: number;
      Power: number;
    };
  };
  buildingId: string;
  floorPlanId: string;
}

/**
 * GET /web/get-historical-energy-readings/:buildingId/:floorPlanId
 *   ?timeRange=today|week|month|year
 *   &customStart=YYYY-MM-DD
 *   &customEnd=YYYY-MM-DD
 *
 * If `customStart` and `customEnd` are provided, we respect them over `timeRange`.
 */
export async function getHistoricalEnergyReadingsController(req: Request, res: Response) {
  console.log("getHistoricalEnergyReadingsController called");
  try {
    const { db } = req.app as any;  // from app.locals
    const { buildingId, floorPlanId } = req.params;
    const { timeRange = "today", customStart, customEnd } = req.query;

    if (!buildingId || !floorPlanId) {
      return res.status(400).json({ message: "BuildingId and FloorPlanId are required" });
    }

    // 1) Determine date range
    let now = new Date();
    let startDate: Date;

    if (customStart && customEnd) {
      // If the user passed a custom date range
      startDate = new Date(customStart as string);
      now = new Date(customEnd as string);
    } else {
      // Otherwise, use the timeRange logic
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
          // ~ Last 365 days
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 365);
          break;
        default:
          // fallback: 'today'
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
    }

    console.log("Date Range:", { startDate, endDate: now });

    // 2) Fetch all readings from DB
    //    We do a broad query by building/floor; then we filter in JS by parsed date/time.
    const allReadings = await db.collection("readings").find({
      buildingId,
      floorPlanId,
      // If you stored dateTime as an actual Date in the DB, you could do:
      //   dateTime: { $gte: startDate, $lte: now },
    }).toArray();

    dynamo_searchByMultipleAttributes('readings' , {buildingId,floorPlanId,})

    if (!allReadings || allReadings.length === 0) {
      return res.status(404).json({ message: "No energy readings found." });
    }

    // 3) Locally filter to keep only readings whose date/time is within [startDate, now]
    const filtered = allReadings.filter((reading: EnergyReading) => {
      const dateTime = new Date(`${reading.date} ${reading.time}`);
      if (isNaN(dateTime.getTime())) {
        return false; // skip invalid or unparseable
      }
      return dateTime >= startDate && dateTime <= now;
    });

    if (filtered.length === 0) {
      return res
        .status(404)
        .json({ message: "No energy readings found for the specified range." });
    }

    // 4) Aggregate & process
    const processedData = processEnergyReadings(filtered, timeRange as string);

    return res.status(200).json({ data: processedData });
  } catch (error) {
    console.error("Error in getHistoricalEnergyReadingsController:", error);
    return res.status(500).json({ message: "Internal Server Error", error: String(error) });
  }
}

/**
 * Aggregates energy readings based on the requested `timeRange`.
 *  - "today": group by hour
 *  - "week" : group by actual date string (e.g. "Oct 25")
 *  - "month": group by "Week 1", "Week 2", etc.
 *  - "year" : group by month name (e.g. "Jan")
 *
 * Returns array of:
 *    {
 *      timestamp: string,  // e.g. "08:00" or "Oct 25" or "Week 2" or "Jan"
 *      energy:   number,
 *      power:    number,
 *      current:  number
 *    }
 */
function processEnergyReadings(readings: EnergyReading[], timeRange: string): any[] {
  const aggregator: Record<string, {
    timestamp: string;
    totalEnergy: number;
    totalPower: number;
    totalCurrent: number;
    count: number;
  }> = {};

  // Helper function to decide the grouping key for a Date
  const getGroupKey = (dt: Date) => {
    switch (timeRange) {
      case "today":
        // group by hour
        return dt.getHours().toString().padStart(2, "0") + ":00";
      case "week":
        // group by actual date, e.g., "Oct 25"
        return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      case "month":
        // group by "Week 1", "Week 2", ...
        const weekOfMonth = Math.ceil(dt.getDate() / 7);
        return `Week ${weekOfMonth}`;
      case "year":
        // group by month name, e.g. "Jan"
        return dt.toLocaleDateString("en-US", { month: "short" });
      default:
        // fallback is same as "today": group by hour
        return dt.getHours().toString().padStart(2, "0") + ":00";
    }
  };

  // 1) Group them
  for (const r of readings) {
    const dt = new Date(`${r.date} ${r.time}`);
    if (isNaN(dt.getTime())) continue; // skip invalid

    const key = getGroupKey(dt);
    if (!aggregator[key]) {
      aggregator[key] = {
        timestamp: key,
        totalEnergy: 0,
        totalPower: 0,
        totalCurrent: 0,
        count: 0,
      };
    }

    // Sum over all sensors for this reading
    for (const sensor of Object.values(r.Energy_Readings || {})) {
      aggregator[key].totalEnergy += sensor.Energy || 0;
      aggregator[key].totalPower += sensor.Power || 0;
      aggregator[key].totalCurrent += sensor.Current || 0;
    }
    aggregator[key].count += 1;
  }

  // 2) Convert aggregator to final array, computing average
  const result = Object.values(aggregator).map((group) => {
    const avgEnergy = group.count > 0 ? group.totalEnergy / group.count : 0;
    const avgPower = group.count > 0 ? group.totalPower / group.count : 0;
    const avgCurrent = group.count > 0 ? group.totalCurrent / group.count : 0;

    return {
      timestamp: group.timestamp,
      energy: +avgEnergy.toFixed(2),
      power: +avgPower.toFixed(4),
      current: +avgCurrent.toFixed(2),
    };
  });

  // 3) Sort for consistent time order
  sortResults(result, timeRange);
  return result;
}

/**
 * Sort results so the final array is in ascending order of time.
 */
function sortResults(results: any[], timeRange: string) {
  if (timeRange === "today") {
    // e.g. "00:00", "01:00", ...
    results.sort((a, b) => {
      const hA = parseInt(a.timestamp, 10);
      const hB = parseInt(b.timestamp, 10);
      return hA - hB;
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
    // e.g. "Jan", "Feb", "Mar", ...
    const monthsOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                         "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    results.sort((a, b) => {
      return monthsOrder.indexOf(a.timestamp) - monthsOrder.indexOf(b.timestamp);
    });
  }
}