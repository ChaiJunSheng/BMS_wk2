export async function addEventController(req: any, res: any) {
  console.log("addEventController called");
  try {
    console.log("Request body: ", req.body);
    const { db } = req.app;
    const {
      userId,
      floorPlanId,
      title,
      date,
      startTime,
      endTime,
      zoneId,
      acUnitId,
      setPointTemp,
      fanSpeed,
      isOn,
    } = req.body;

    if (
      !userId ||
      !floorPlanId ||
      !title ||
      !date ||
      !startTime ||
      !endTime ||
      !zoneId ||
      !acUnitId ||
      isOn === undefined
    ) {
      console.log("Invalid data received");
      return res
        .status(400)
        .json({
          message:
            "User ID, floorPlanId, action, date, startTime, endTime and isOn are required",
        });
    }

    if (isOn) {
      if (setPointTemp === undefined || !fanSpeed) {
        console.log("setPointTemp and fanSpeed are required when isOn is true");
        return res
          .status(400)
          .json({
            message:
              "setPointTemp and fanSpeed are required when AC is turned on",
          });
      }
    }

    console.log("Saving event to database...");
    const result = await db.collection("events").insertOne({
      userId,
      floorPlanId,
      title,
      date,
      startTime,
      endTime,
      zoneId,
      acUnitId,
      isOn,
      ...(isOn && {
        setPointTemp,
        fanSpeed,
      }),
    });

    const eventId = result.insertedId;

    console.log("Event saved: ", result);
    res.status(200).json({
      message: "Event saved",
      eventId,
      result,
    });
  } catch (error) {
    console.error("Error in saving event: ", error);
    res.status(500).json({ error: error.toString() });
  }
}
