export async function getEventsController(req: any, res: any) {
    console.log("getEventsController called");
    try {
        console.log("Request body: ", req.body);
        const { db } = req.app;
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required '});
        }

        const events = await db.collection('events').find({ userId }).toArray();

        if (!events || events.length === 0) {
            return res.status(404).json({ message: 'No events found for this user' });
        }

        res.status(200).json({ events });
    } catch (error) {
        console.error("Error fetching events: ", error);
        res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
    }
}