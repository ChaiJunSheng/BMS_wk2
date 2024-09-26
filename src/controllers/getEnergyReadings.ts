export async function getEnergyReadingsController(req, res) {
    try {
        const { db } = req.app;
        const { range } = req.query;
        const sensorCollections = ['sensor_1', 'sensor_2', 'sensor_3', 'sensor_4', 'sensor_5', 'sensor_6'];

        const energyReadings = [];
        let timeLimit;

        // Determine time limit based on range
        const now = new Date();
        if (range === '24h') {
            timeLimit = new Date(now.getTime() - 24 * 60 * 60 * 1000);  // Last 24 hours
        } else if (range === '7d') {
            timeLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);  // Last 7 days
        } else if (range === '30d') {
            timeLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);  // Last 30 days
        } else {
            timeLimit = new Date(now.getTime() - 24 * 60 * 60 * 1000);  // Default to last 24 hours
        }

        console.log("Using time limit: ", timeLimit);

        const parseDateAndTime = (dateStr, timeStr) => {
            const formattedDateStr = new Date(dateStr).toLocaleDateString('en-US'); // Convert to valid date format

            const timeParts = timeStr.match(/(\d+):(\d+):(\d+) (AM|PM)/);
            if (timeParts) {
                let hours = parseInt(timeParts[1], 10);
                const minutes = parseInt(timeParts[2], 10);
                const seconds = parseInt(timeParts[3], 10);
                const meridiem = timeParts[4];

                if (meridiem === "PM" && hours !== 12) {
                    hours += 12; 
                } else if (meridiem === "AM" && hours === 12) {
                    hours = 0; 
                }

                timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
            }

            const dateTimeStr = `${formattedDateStr} ${timeStr}`;
            return new Date(dateTimeStr);
        };

        // Loop through all the sensor collections
        for (let sensor of sensorCollections) {
            console.log(`Fetching data from sensor collection: ${sensor}`);

            // Fetch data from the sensor collection
            const readings = await db.collection(sensor).find({}).toArray();

            const filteredReadings = readings
                .filter(reading => {
                    const readingDate = parseDateAndTime(reading.date, reading.time);
                    return readingDate.getTime() >= timeLimit.getTime();  // Compare the parsed date to the time limit
                })
                .sort((a, b) => {
                    const dateA = parseDateAndTime(a.date, a.time).getTime();
                    const dateB = parseDateAndTime(b.date, b.time).getTime();
                    return dateB - dateA;  // Sort in descending order by date
                })
                .slice(0, 20);  // Limit the results to the most recent 20 entries

            if (filteredReadings.length === 0) {
                console.log(`No data found for ${sensor} in the given range.`);
            } else {
                console.log(`Found data for ${sensor}: `, filteredReadings);
            }

            // Process each reading and push the data to the energyReadings array
            filteredReadings.forEach(reading => {
                const sensorNumber = sensor.split('_')[1];  // Extract the sensor number (e.g., 1, 2, 3...)
                energyReadings.push({
                    time: reading.time,  // Keep the original 'time' field
                    [`Sensor_${sensorNumber}_Energy`]: reading[`Sensor_${sensorNumber}_Energy`] || 0,
                    [`Sensor_${sensorNumber}_Current`]: reading[`Sensor_${sensorNumber}_Current`] || 0,
                    [`Sensor_${sensorNumber}_Voltage`]: reading[`Sensor_${sensorNumber}_Voltage`] || 0
                });
            });
        }

        console.log("Final energy readings array: ", energyReadings);

        return res.status(200).json({
            message: 'Energy readings retrieved successfully',
            energyReadings: energyReadings
        });
    } catch (error) {
        console.error("Error retrieving energy readings:", error);
        return res.status(500).json({ error: "Failed to retrieve energy readings" });
    }
}