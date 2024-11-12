export async function getLatestEnergyReadingController(req, res) {
    try {
        const db = req.app.db;

        // Define latestEnergyReading with an index signature
        const latestReading = await db
            .collection('lorawan')
            .find({})
            .sort({ _id: - 1 })
            .limit(1)
            .toArray();

        if (!latestReading || latestReading.length === 0) {
            return res.status(404).json({
                message: 'No energy readings found'
            });
        }

        const reading = latestReading[0];

        // initialise the response object
        const latestEnergyReading: { [key: string]: any } = {
            time: reading.time,
            data: reading.date
        };

        if (reading.Energy_Readings) {
            for (let i = 1; i <= 6; i++) {
                const sensorKey = `Sensor_${i}`;
                const sensorData = reading.Energy_Readings[sensorKey];

                if (sensorData) {
                    latestEnergyReading[`${sensorKey}_Energy`] = sensorData.Energy || 0;
                    latestEnergyReading[`${sensorKey}_Current`] = sensorData.Current || 0;
                    latestEnergyReading[`${sensorKey}_Power`] = sensorData.Power || 0;
                } else {
                    latestEnergyReading[`${sensorKey}_Energy`] = 0;
                    latestEnergyReading[`${sensorKey}_Current`] = 0;
                    latestEnergyReading[`${sensorKey}_Power`] = 0;
                }
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