import { ObjectId } from "mongodb";

export async function saveSettingsController(req, res) {
  console.log("saveSettingsController called");
  try {
    const { db } = req.app;
    const { buildingId, floorPlanId } = req.params;
    const settingsData = req.body; // The form data from the client

    // Validate required parameters
    if (!buildingId || !floorPlanId) {
      return res.status(400).json({
        message: "BuildingId and FloorPlanId are required",
      });
    }

    // Upsert (create/update) the settings document
    // This will create a new doc if it doesn't exist, or update the existing one
    const result = await db.collection("settings").updateOne(
      {
        buildingId: buildingId,
        floorPlanId: floorPlanId,
      },
      {
        $set: {
          // We store buildingId & floorPlanId in the doc for future lookups
          buildingId: buildingId,
          floorPlanId: floorPlanId,
          settings: settingsData,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // You can inspect result.upsertedId, result.modifiedCount, etc. if needed
    // For a simple response, just confirm success:
    return res.status(200).json({
      message: "Settings saved successfully",
      // Optionally return extra info: result, upsertedId, etc.
    });
  } catch (error) {
    console.error("Error in saving settings: ", error);
    return res.status(500).json({
      message: "Error in saving settings",
      error: error.message,
    });
  }
}