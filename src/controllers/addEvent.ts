export async function addEventController(req: any, res: any) {
    console.log("addEventController called");
    try {
        console.log("Request body: ", req.body);
        const { db } = req.app;
        const { userId, floorPlanId, title, action, date, startTime, endTime } = req.body;

        if (!userId || !floorPlanId || !title || !action || !date || !startTime || !endTime) {
            console.log("Invalid data received");
            return res.status(400).json({ message: 'User ID, floorPlanId, action, date, startTime and endTime are required' });
        }

        console.log("Saving event to database...");
        const result = await db.collection('events').insertOne({
            userId: userId,
            floorPlanId: floorPlanId,
            title: title,
            action: action,
            date: date,
            startTime: startTime,
            endTime: endTime,
        });

        const eventId = result.insertedId;

        console.log("Event saved: ", result);
        res.status(200).json({
            message: 'Event saved',
            eventId,
            result
        });
    } catch (error) {
        console.error("Error in saving event: ", error);
        res.status(500).json({ error: error.toString() });
    }
}