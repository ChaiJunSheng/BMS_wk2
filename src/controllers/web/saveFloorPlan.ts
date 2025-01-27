import { ObjectId } from "mongodb";
import QRCode from "qrcode";

export async function saveFloorPlanController(req, res) {
    console.log('saveFloorPlanController called');
    try {
        console.log("Request body: ", req.body);
        const { db } = req.app;
        const { buildingId, floorPlan, imageUrl, zones } = req.body;

        if (!buildingId || !floorPlan || !imageUrl || !zones) {
            console.log("Invalid data received");
            return res.status(400).json({ message: 'User ID, Floor plan, imageUrl, and zones are required' });
        }

        for (let zone of zones) {
            if (!zone.id || !zone.name || !zone.shape || !Array.isArray(zone.points) || !Array.isArray(zone.sensors)) {
                console.log("Invalid zone data received");
                return res.status(400).json({ message: 'Each zone must have an id, name, shape, points array, and sensors array' });
            }

            for (let sensor of zone.sensors) {
                if (!sensor.id || !sensor.type || typeof sensor.x !== 'number' || typeof sensor.y !== 'number' || !sensor.zoneId || !sensor.uid) {
                    console.log("Invalid sensor data in zone");
                    return res.status(400).json({ message: 'Each sensor must have an id, type, x, y, zoneId, and uid' });
                }
            }
        }

        console.log("Saving floor plan to database...");
        const result = await db.collection('floorplans').insertOne({
            buildingId: buildingId,
            floorPlan: floorPlan,
            imageUrl: imageUrl,
            zones: zones,
        });

        const floorPlanId = result.insertedId;

        await db.collection('buildings').updateOne(
            { _id: new ObjectId(buildingId) },
            { $push: { floors: floorPlanId }}
        )

        const feedbackUrl = `http://3.25.195.46:3000/feedback?floorPlanId=${floorPlanId}`;
        const qrCodeDataUrl = await QRCode.toDataURL(feedbackUrl);

        await db.collection('floorplans').updateOne(
            { _id: floorPlanId },
            { $set: { qrCodeUrl: qrCodeDataUrl }}
        );

        console.log("Floor plan saved and QR code generated: ", result);
        res.status(200).json({
            message: 'Floor plan saved',
            floorPlanId,
            qrCodeUrl: qrCodeDataUrl,
            result
        });
    }
    catch(error) {
        console.error("Error saving floor plan: ", error);
        res.status(500).json({ error: error.toString() });
    }
}