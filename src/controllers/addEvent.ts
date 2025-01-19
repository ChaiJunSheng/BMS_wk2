export async function addEventController(req: any, res: any) {
  console.log("addEventController called");
  try {
    console.log("Request body: ", req.body);
    const { db } = req.app;
    const {
      buildingId,
      floorPlanId,
      title,
      date,
      startTime,
      endTime,
      temp,
    } = req.body;

    // Validate required fields
    if (
      !buildingId ||
      !floorPlanId ||
      !title ||
      !date ||
      !startTime ||
      !endTime ||
      temp === undefined
    ) {
      console.log("Invalid data received");
      return res.status(400).json({
        message:
          "User ID, Building ID, Floor Plan ID, Title, Date, Start Time, End Time, and Temp are required",
      });
    }

    // Optional: Validate temperature range
    if (temp < 16 || temp > 30) { // Assuming 16°C to 30°C is the acceptable range
      console.log("Invalid temperature received");
      return res.status(400).json({
        message: "Temperature must be between 16°C and 30°C",
      });
    }

    console.log("Saving event to database...");
    const result = await db.collection("events").insertOne({
      buildingId,
      floorPlanId,
      title,
      date,
      startTime,
      endTime,
      temp,
      finished: false, // Initialize as not finished
    });

    const eventId = result.insertedId;

    console.log("Event saved: ", result);
    res.status(200).json({
      message: "Event saved successfully",
      eventId,
      result,
    });
  } catch (error) {
    console.error("Error in saving event: ", error);
    res.status(500).json({ error: error.toString() });
  }
}