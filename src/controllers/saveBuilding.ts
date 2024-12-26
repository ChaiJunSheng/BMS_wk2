export async function saveBuildingController(req, res) {
    console.log('saveBuildingController called');
    try {
        console.log("Request body: ", req.body);
        const { db } = req.app;
        const { userId, buildingName, location, address } = req.body;

        if (!userId || !buildingName || !location) {
            console.log("Invalid data received");
            return res.status(400).json({
                message: 'Building name, userId, location and address are required'
            })
        }

        if (!Array.isArray(location) || 
            location.length !== 2 || 
            typeof location[0] !== 'number' || 
            typeof location[1] !== 'number') {
            console.log("Invalid location format");
            return res.status(400).json({ 
                message: 'Location must be an array of two numbers [latitude, longitude]' 
            });
        }

        const buildingDoc = {
            userId: String(userId),
            buildingName,
            location,
            address,
            floors: [], // Initialize empty floors array
        };

        console.log("Saving building to database...");
        const result = await db.collection('buildings').insertOne(buildingDoc);

        console.log("Building saved: ", result);
        res.status(200).json({
            message: 'Building saved successfully',
            buildingId: result.insertedId,
            building: {
                id: result.insertedId,
                ...buildingDoc
            }
        });
    } catch (error) {
        console.error("Error saving building: ", error);
        res.status(500).json({ error: error.toString() });
    }
}