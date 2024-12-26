export async function getFloorPlansController(req, res) {
    try {
        const { db } = req.app;
        const { buildingId } = req.params;

        if (!buildingId) {
            return res.status(400).json({ message: 'BuildingId is required' });
        }

        const floorPlans = await db.collection('floorplans').find({ buildingId }).toArray();

        res.status(200).json({
            message: 'Floor plans fetched',
            floorPlans: floorPlans.map(plan => ({
                _id: plan._id,
                floorPlan: plan.floorPlan,
                imageUrl: plan.imageUrl,
                qrCodeUrl: plan.qrCodeUrl || '',  // Provide a default if qrCodeUrl is not set
                zones: plan.zones.map(zone => ({
                    id: zone.id,
                    name: zone.name,
                    shape: zone.shape,
                    points: zone.points,
                    temp: zone.temp,
                    sensors: zone.sensors.map(sensor => ({
                        id: sensor.id,
                        type: sensor.type,
                        x: sensor.x,
                        y: sensor.y,
                        zoneId: sensor.zoneId,
                        uid: sensor.uid,
                    })),
                })),
            })),
        });
    } catch (error) {
        console.error("Error fetching floor plans: ", error);
        res.status(500).json({ error: error.toString() });
    }
}