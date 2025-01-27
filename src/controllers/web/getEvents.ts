import { dynamo_searchByMultipleAttributes } from "../../functions/dynamo";

export async function getEventsController(req: any, res: any) {
    console.log("getEventsController called");
    try {
        // Extract userId from route parameters and buildingId from query parameters
        const { buildingId } = req.params;

        // Validate required fields
        if (!buildingId) {
            return res.status(400).json({ message: 'Building ID is required' });
        }

        const { db } = req.app;

        // Fetch events based on userId and buildingId
        const events = await db.collection('events').find({ buildingId }).toArray();

        dynamo_searchByMultipleAttributes('events', {buildingId});

        if (!events || events.length === 0) {
            return res.status(404).json({ message: 'No events found for this user in the specified building' });
        }

        // Optional: Format dates or perform any additional processing if necessary

        res.status(200).json({ events });
    } catch (error) {
        console.error("Error fetching events: ", error);
        res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
    }
}