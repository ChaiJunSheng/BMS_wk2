import { dynamo_getAllItems, dynamo_searchByAttribute, dynamo_searchByMultipleAttributes } from "../../functions/dynamo";

export async function getBuildingController(req, res) {
    console.log("getBuildingController called");
    try {
        console.log("Request body: ", req.body);
        const { db } = req.app;
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const buildings = await db.collection('buildings').find({ userId }).toArray();

        dynamo_searchByMultipleAttributes('buildings', {userId});

        const userBuildings = buildings.map(building => ({
            id: building._id.toString(),
            name: building.buildingName,
            location: building.location,
            address: building.address,
            floors: building.floors || [],
            userId: building.userId
        }));

        console.log(`Found ${userBuildings.length} buildings for user ${userId}`);
        res.status(200).json(userBuildings);
    } catch (error) {
        console.error("Error fetching buildings: ", error);
        res.status(500).json({ error: error.toString() });
    }
}