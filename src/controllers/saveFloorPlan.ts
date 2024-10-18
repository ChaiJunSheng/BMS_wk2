import QRCode from "qrcode";

export async function saveFloorPlanController(req: any, res: any) {
    console.log('saveFloorPlanController called');
    try {
        console.log("Request body: ", req.body);
        const { db } = req.app;
        const { userId, floorPlan, imageUrl, zones } = req.body;

        if (!userId || !floorPlan || !imageUrl || !zones) {
            console.log("Invalid data received");
            return res.status(400).json({ message: 'User ID, Floor plan, imageUrl, and zones are required' });
        }

        for (let zone of zones) {
            if (!zone.id || !zone.name || !zone.shape || !Array.isArray(zone.points) || !Array.isArray(zone.aircons)) {
                console.log("Invalid zone data received");
                return res.status(400).json({ message: 'Each zone must have an id, name, shape, points array, and aircon array'});
            }

            for (let aircon of zone.aircons) {
                if (!aircon.name || typeof aircon.setPointTemp != 'number' || typeof aircon.status !== 'boolean') {
                    console.log("Invalid aircon data in zone");
                    return res.status(400).json({ message: 'Each aircon must have a name, setPointTemp (number), and status (boolean).'})
                }
            }
        }

        console.log("Saving floor plan to database...")
        const result = await db.collection('floorplans').insertOne({
            userId: userId,
            floorPlan: floorPlan,
            imageUrl: imageUrl,
            zones: zones,
        });

        const floorPlanId = result.insertedId;

        const feedbackUrl = `http://3.25.195.46:3000/feedback?floorPlanId=${floorPlanId}`;
        const qrCodeDataUrl = await QRCode.toDataURL(feedbackUrl);

        await db.collection('floorplans').updateOne(
            { _id: floorPlanId },
            { $set: { qrCodeUrl: qrCodeDataUrl }}
        )

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