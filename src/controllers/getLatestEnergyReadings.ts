export async function getLatestEnergyReadingController(req, res) {
    try {
        const db = req.app.db;
        const sensorCollections = ['sensor_1', 'sensor_2', 'sensor_3', 'sensor_4', 'sensor_5', 'sensor_6'];

        // Define latestEnergyReading with an index signature
        const latestEnergyReading: { [key: string]: any } = {};

        for (let sensor of sensorCollections) {
            const sensorNumber = sensor.split('_')[1];
            const readings = await db
                .collection(sensor)
                .find({})
                .sort({ _id: -1 })
                .limit(1)
                .toArray();

            if (readings.length > 0) {
                const reading = readings[0];
                latestEnergyReading.time = reading.time;
                latestEnergyReading[`Sensor_${sensorNumber}_Energy`] = reading[`Sensor_${sensorNumber}_Energy`] || 0;
                latestEnergyReading[`Sensor_${sensorNumber}_Current`] = reading[`Sensor_${sensorNumber}_Current`] || 0;
                latestEnergyReading[`Sensor_${sensorNumber}_Power`] = reading[`Sensor_${sensorNumber}_Power`] || 0;
            }
        }

        return res.status(200).json({
            message: 'Latest energy reading retrieved successfully',
            latestEnergyReading: latestEnergyReading,
        });
    } catch (error) {
        console.error('Error retrieving latest energy reading:', error);
        res.status(500).json({ error: 'Failed to retrieve latest energy reading' });
    }
}