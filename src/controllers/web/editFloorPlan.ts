import QRCode from "qrcode";
import { ObjectId } from "mongodb"; // Import MongoDB ObjectId for converting floorPlanId

export async function editFloorPlanController(req: any, res: any) {
  console.log("editFloorPlanController called");
  try {
    console.log("Request body: ", JSON.stringify(req.body, null, 2));
    const { db } = req.app;
    const { floorPlanId, floorPlan, imageUrl, zones } = req.body;

    // Check if required data is present
    if (!floorPlanId || !floorPlan || !imageUrl || !zones) {
      console.log("Invalid data received");
      return res.status(400).json({
        message: "FloorPlan ID, FloorPlan name, imageUrl, and zones are required",
      });
    }

    // Validate zones data
    for (let zone of zones) {
      if (!zone.id || !zone.name || !zone.shape || !Array.isArray(zone.points) || !Array.isArray(zone.aircons)) {
        console.log("Invalid zone data received");
        return res.status(400).json({
          message: "Each zone must have an id, name, shape, points array, and aircon array",
        });
      }

      for (let aircon of zone.aircons) {
        if (!aircon.name || typeof aircon.setPointTemp !== "number" || typeof aircon.status !== "boolean") {
          console.log("Invalid aircon data in zone");
          return res.status(400).json({
            message: "Each aircon must have a name, setPointTemp (number), and status (boolean).",
          });
        }
      }
    }

    // Convert the floorPlanId to ObjectId for MongoDB query
    const objectId = new ObjectId(floorPlanId);

    console.log("Updating floor plan in the database...");
    const result = await db.collection("floorplans").updateOne(
      { _id: objectId }, // Use ObjectId for matching the document
      {
        $set: {
          floorPlan: floorPlan,
          imageUrl: imageUrl,
          zones: zones,
        },
      }
    );

    // Handle no matching floor plan
    if (result.modifiedCount === 0) {
      console.log("No matching floor plan found to update");
      return res.status(404).json({ message: "Floor plan not found or not modified" });
    }

    // Generate feedback URL and QR Code
    const feedbackUrl = `http://3.25.195.46:3000/feedback?floorPlanId=${floorPlanId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(feedbackUrl);

    // Update the floor plan with the generated QR Code URL
    await db.collection("floorplans").updateOne(
      { _id: objectId },
      { $set: { qrCodeUrl: qrCodeDataUrl } }
    );

    console.log("Floor plan updated and QR code generated: ", result);
    res.status(200).json({
      message: "Floor plan updated",
      floorPlanId,
      qrCodeUrl: qrCodeDataUrl,
      result,
    });
  } catch (error) {
    console.error("Error updating floor plan: ", error);
    res.status(500).json({ error: error.toString() });
  }
}