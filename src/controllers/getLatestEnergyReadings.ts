export async function getLatestEnergyReadingController(req, res) {
    try {
        const db = req.app.db;
        const { buildingId, floorPlanId } = req.params;

        const latestReading = await db
            .collection('readings')
            .find({ buildingId: buildingId, floorPlanId: floorPlanId })
            .sort({ _id: -1 })
            .limit(1)
            .toArray();

        if (!latestReading || latestReading.length === 0) {
            return res.status(404).json({
                message: 'No energy readings found for the specified building and floor plan'
            });
        }

        const reading = latestReading[0];

        // Initialize the response object
        const latestEnergyReading = {
            time: reading.time,
            date: reading.date
        };

        if (reading.Energy_Readings && typeof reading.Energy_Readings === 'object') {
            // Dynamically iterate over the sensor keys in Energy_Readings
            Object.keys(reading.Energy_Readings)
                .filter(key => key.startsWith('Sensor_'))
                .forEach(sensorKey => {
                    const sensorData = reading.Energy_Readings[sensorKey] || {};
                    // For example: Sensor_1_Energy, Sensor_1_Current, Sensor_1_Power
                    // This allows the frontend to pick them up as `${sensor}_Energy`, etc.
                    latestEnergyReading[`${sensorKey}_Energy`] = sensorData.Energy || 0;
                    latestEnergyReading[`${sensorKey}_Current`] = sensorData.Current || 0;
                    latestEnergyReading[`${sensorKey}_Power`] = sensorData.Power || 0;
                });
        }

        return res.status(200).json({
            message: 'Latest energy reading retrieved successfully',
            latestEnergyReading: latestEnergyReading,
        });
    } catch (error) {
        console.error('Error retrieving latest energy reading:', error);
        return res.status(500).json({ error: 'Failed to retrieve latest energy reading' });
    }
}