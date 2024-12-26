// backend/controllers/sensorReadingsController.ts

import { Request, Response } from 'express';

/**
 * Controller to fetch sensor readings based on buildingId, floorPlanId, and timeRange.
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 */
export async function getSensorReadingsController(req, res) {
    console.log("getSensorReadingsController called");
    try {
        const { db } = req.app;
        const { buildingId, floorPlanId } = req.params;
        const { timeRange = 'today' } = req.query;

        // Validate input
        if (!buildingId || !floorPlanId) {
            return res.status(400).json({ message: "BuildingId and FloorPlanId are required" });
        }

        // Define date range based on timeRange
        const now = new Date();
        let startDate: Date;

        switch (timeRange) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1); // Start of the year
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }

        // Fetch all readings for the specified building and floor plan
        const allReadings = await db.collection('readings').find({
            buildingId: buildingId,
            floorPlanId: floorPlanId
            // Ideally, use a Date object field like 'dateTime' for efficient querying
            // dateTime: { $gte: startDate, $lte: now }
        }).toArray();

        if (!allReadings || allReadings.length === 0) {
            return res.status(404).json({ message: "No sensor readings found for the specified BuildingId and FloorPlanId" });
        }

        // Filter readings based on timeRange by parsing date and time
        const filteredReadings = allReadings.filter(reading => {
            const dateTimeString = `${reading.date} ${reading.time}`;
            const dateTime = new Date(dateTimeString);
            return dateTime >= startDate && dateTime <= now;
        });

        if (filteredReadings.length === 0) {
            return res.status(404).json({ message: "No sensor readings found for the specified time range." });
        }

        // Process sensor readings to aggregate data
        const processedData = processSensorReadings(filteredReadings, timeRange as string);

        return res.status(200).json({ data: processedData });
    } catch (error) {
        console.error("Error in getSensorReadingsController:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

/**
 * Function to process and aggregate sensor readings based on timeRange.
 * @param {Array} readings - Array of sensor readings.
 * @param {string} timeRange - The time range for aggregation ('today', 'week', 'month', 'year').
 * @returns {Array} - Aggregated sensor data.
 */
function processSensorReadings(readings: any[], timeRange: string) {
    const aggregation: { [key: string]: any } = {};

    readings.forEach(reading => {
        const dateTime = new Date(`${reading.date} ${reading.time}`);
        let aggregationKey: string;

        switch (timeRange) {
            case 'today':
                // Group by hour (e.g., "10:00")
                aggregationKey = `${dateTime.getHours().toString().padStart(2, '0')}:00`;
                break;
            case 'week':
                // Group by day of the week (e.g., "Mon", "Tue")
                aggregationKey = dateTime.toLocaleDateString('en-US', { weekday: 'short' });
                break;
            case 'month':
                // Group by week number in the month (e.g., "Week 1", "Week 2")
                const weekOfMonth = Math.ceil(dateTime.getDate() / 7);
                aggregationKey = `Week ${weekOfMonth}`;
                break;
            case 'year':
                // Group by month (e.g., "Jan", "Feb")
                aggregationKey = dateTime.toLocaleDateString('en-US', { month: 'short' });
                break;
            default:
                // Default to grouping by hour
                aggregationKey = `${dateTime.getHours().toString().padStart(2, '0')}:00`;
        }

        if (!aggregation[aggregationKey]) {
            aggregation[aggregationKey] = {
                timestamp: aggregationKey,
                power: 0,
                temperature: 0,
                humidity: 0, // Added humidity
                occupancy: 0,
                count: 0
            };
        }

        // Sum Power from Energy_Readings across all sensors
        const powerSum = Object.values(reading.Energy_Readings || {}).reduce((acc, sensor: any) => acc + (sensor.Power || 0), 0);
        aggregation[aggregationKey].power += powerSum;

        // Calculate average Temperature from Lorawan_Readings
        const temperatureValues = Object.values(reading.Lorawan_Readings || {})
            .map((device: any) => device.temperature)
            .filter((temp: any) => typeof temp === 'number');

        const temperatureSum = temperatureValues.reduce((acc, temp) => acc + temp, 0);
        const temperatureCount = temperatureValues.length;
        const averageTemperature = temperatureCount > 0 ? temperatureSum / temperatureCount : 0;

        aggregation[aggregationKey].temperature += averageTemperature;

        // Calculate average Humidity from Lorawan_Readings (assuming similar structure)
        const humidityValues = Object.values(reading.Lorawan_Readings || {})
            .map((device: any) => device.humidity)
            .filter((humidity: any) => typeof humidity === 'number');

        const humiditySum = humidityValues.reduce((acc, humidity) => acc + humidity, 0);
        const humidityCount = humidityValues.length;
        const averageHumidity = humidityCount > 0 ? humiditySum / humidityCount : 0;

        aggregation[aggregationKey].humidity += averageHumidity;

        // Handle Occupancy
        // Set occupancy to 0 if no data is available
        const occupancyValue = reading.Occupancy || 0; // Changed from 50 to 0
        aggregation[aggregationKey].occupancy += occupancyValue;

        aggregation[aggregationKey].count++;
    });

    const aggregatedData = Object.values(aggregation).map(entry => ({
        timestamp: entry.timestamp,
        power: parseFloat((entry.power / entry.count).toFixed(2)),
        temperature: parseFloat((entry.temperature / entry.count).toFixed(1)),
        humidity: parseFloat((entry.humidity / entry.count).toFixed(1)), // Added humidity
        occupancy: Math.round(entry.occupancy / entry.count),
    }));

    // Sort aggregated data based on timeRange
    if (timeRange === 'today') {
        aggregatedData.sort((a, b) => {
            const [aHour] = a.timestamp.split(':').map(Number);
            const [bHour] = b.timestamp.split(':').map(Number);
            return aHour - bHour;
        });
    } else if (timeRange === 'week') {
        // Define order of days
        const daysOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        aggregatedData.sort((a, b) => {
            return daysOrder.indexOf(a.timestamp) - daysOrder.indexOf(b.timestamp);
        });
    } else if (timeRange === 'month') {
        // Sort by week number
        aggregatedData.sort((a, b) => {
            const weekA = parseInt(a.timestamp.replace('Week ', ''));
            const weekB = parseInt(b.timestamp.replace('Week ', ''));
            return weekA - weekB;
        });
    } else if (timeRange === 'year') {
        // Define order of months
        const monthsOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        aggregatedData.sort((a, b) => {
            return monthsOrder.indexOf(a.timestamp) - monthsOrder.indexOf(b.timestamp);
        });
    }

    return aggregatedData;
}