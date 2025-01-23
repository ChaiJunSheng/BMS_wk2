import { dynamo_searchByMultipleAttributes } from "../../functions/dynamo";

export async function getSettingsController(req, res) {
    console.log("getSettingsController called");
    try {
        const { db } = req.app;
        const { buildingId, floorPlanId } = req.params;

        if (!buildingId || !floorPlanId) {
            return res.status(400).json({
                message: "buildingId and floorPlanId are required",
            });
        }

        const settingsDoc = await db.collection("settings").findOne({
            buildingId,
            floorPlanId
        });

        dynamo_searchByMultipleAttributes('settings' , {buildingId,floorPlanId})

        if (!settingsDoc) {
            return res.status(404).json({ message: "Settings not found" });
        }

        return res.status(200).json({
            message: "Settings fetched successfully",
            settings: settingsDoc.settings,
        });
    } catch (error) {
        console.error("Error in fetching settings: ", error);
        return res.status(500).json({
            message: "Error in fetching settings",
            error: error.message
        });
    }
}