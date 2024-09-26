export async function editZoneTempController(req, res, io) {
    const { zoneId } = req.params; // Get zoneId from params
    const { newTemp } = req.body; // Get the new temperature from the body

    if (typeof newTemp !== "number") {
        return res.status(400).json({ message: "Invalid temperature value" });
    }

    try {
        const { db } = req.app;

        // Step 1: Log the input data
        console.log("Zone ID:", zoneId, "New Temp:", newTemp);

        // Step 2: Look for the floor plan containing the zone
        const floorPlan = await db.collection('floorplans').findOne({
            "zones.id": zoneId
        });

        if (!floorPlan) {
            console.log("Zone not found during lookup");
            return res.status(404).json({ message: "Zone not found" });
        }

        console.log("Floor plan found:", floorPlan);

        // Step 3: Check if the zone is inside the floor plan
        const zoneIndex = floorPlan.zones.findIndex((z) => z.id === zoneId);
        if (zoneIndex === -1) {
            console.log("Zone not found inside the zones array.");
            return res.status(404).json({ message: "Zone not found inside zones array" });
        }

        console.log("Zone found at index:", zoneIndex);

        // Step 4: Manually update the specific zone's temperature
        floorPlan.zones[zoneIndex].temp = newTemp;

        const updateResult = await db.collection('floorplans').updateOne(
            { _id: floorPlan._id },  // Find the document by its _id
            { $set: { zones: floorPlan.zones } }  // Update the entire zones array
        );

        console.log('Update result:', updateResult);

        if (!updateResult || updateResult.matchedCount === 0) {
            console.log("Zone update failed");
            return res.status(404).json({ message: "Zone update failed" });
        }

        console.log('Updated Database result:', updateResult);

        // Emit only the updated zone instead of the entire floor plan
        const updatedZone = floorPlan.zones[zoneIndex];
        io.emit('temperatureUpdate', updatedZone);

        return res.status(200).json({
            message: 'Temperature updated successfully',
            updatedZone: updatedZone  // Send only the updated zone in the response
        });
    } catch (error) {
        console.error("Error updating temperature:", error);
        return res.status(500).json({ error: "Failed to update temperature" });
    }
}