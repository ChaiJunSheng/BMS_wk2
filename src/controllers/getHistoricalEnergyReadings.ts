import { Request, Response } from "express";

interface EnergyReading {
  date: string;
  time: string;
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

export async function getHistoricalEnergyReadingsController(req: Request, res: Response) {
  console.log("getHistoricalEnergyReadingsController called");
  try {
    const { db } = req.app as any;
    const { buildingId, floorPlanId } = req.params;
    const { timeRange = "today" } = req.query;

    console.log("BuildingId:", buildingId);
    console.log("FloorPlanId:", floorPlanId);
    console.log("TimeRange:", timeRange);

    if (!buildingId || !floorPlanId) {
      return res.status(400).json({ message: "BuildingId and FloorPlanId are required" });
    }

    const now = new Date();
    let startDate: string;

    switch (timeRange) {
      case "today":
        startDate = now.toDateString(); // Today's date
        break;
      case "week":
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = weekAgo.toDateString(); // 7 days ago
        break;
      case "month":
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = monthAgo.toDateString(); // 1 month ago
        break;
      default:
        startDate = now.toDateString();
    }

    console.log("StartDate:", startDate);

    const readings: EnergyReading[] = await db
      .collection("readings")
      .find({
        buildingId,
        floorPlanId,
        date: { $gte: startDate, $lte: now.toDateString() },
      })
      .toArray();

    console.log("Total Readings Found:", readings.length);

    if (readings.length === 0) {
      return res.status(404).json({
        message: "No readings found",
        details: {
          buildingId,
          floorPlanId,
          startDate,
          currentDate: now.toDateString(),
        },
      });
    }

    const processedData = processEnergyReadings(readings, timeRange as string);

    return res.status(200).json({ data: processedData });
  } catch (error) {
    console.error("Error in getHistoricalEnergyReadingsController:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function processEnergyReadings(readings: EnergyReading[], timeRange: string): any[] {
    const aggregation: { [key: string]: any } = {};
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
    // Pre-initialize weekly data if time range is 'week'
    if (timeRange === "week") {
      daysOfWeek.forEach((day) => {
        aggregation[day] = {
          timestamp: day,
          totalEnergy: 0,
          totalPower: 0,
          totalCurrent: 0,
          count: 0,
        };
      });
    }
  
    readings.forEach((reading) => {
      // Parse date and time properly
      const dateString = reading.date + " " + reading.time;
      const dateTime = new Date(dateString);
  
      if (isNaN(dateTime.getTime())) {
        console.warn(`Invalid date: ${dateString}`);
        return;
      }
  
      const aggregationKey =
        timeRange === "week"
          ? dateTime.toLocaleDateString("en-US", { weekday: "short" }) // Get day name (e.g., "Sun")
          : timeRange === "month"
          ? `Week ${Math.ceil(dateTime.getDate() / 7)}` // Weekly aggregation for the month
          : `${dateTime.getHours().toString().padStart(2, "0")}:00`; // Hourly for today
  
      // Ensure the aggregationKey exists in the weekly range
      if (!aggregation[aggregationKey]) {
        aggregation[aggregationKey] = {
          timestamp: aggregationKey,
          totalEnergy: 0,
          totalPower: 0,
          totalCurrent: 0,
          count: 0,
        };
      }
  
      // Add data for each sensor
      Object.values(reading.Energy_Readings).forEach((sensorData) => {
        aggregation[aggregationKey].totalEnergy += sensorData.Energy || 0;
        aggregation[aggregationKey].totalPower += sensorData.Power || 0;
        aggregation[aggregationKey].totalCurrent += sensorData.Current || 0;
      });
  
      aggregation[aggregationKey].count++;
    });
  
    console.log("Aggregation Debug (After Processing):", aggregation);
  
    const aggregatedData = Object.entries(aggregation).map(([key, value]) => ({
      timestamp: key,
      energy: value.count > 0 ? parseFloat((value.totalEnergy / value.count).toFixed(2)) : 0,
      power: value.count > 0 ? parseFloat((value.totalPower / value.count).toFixed(4)) : 0,
      current: value.count > 0 ? parseFloat((value.totalCurrent / value.count).toFixed(2)) : 0,
    }));
  
    if (timeRange === "week") {
      return daysOfWeek.map((day) => {
        const existingData = aggregatedData.find((item) => item.timestamp === day);
        return (
          existingData || {
            timestamp: day,
            energy: 0,
            power: 0,
            current: 0,
          }
        );
      });
    }
  
    return aggregatedData;
  }