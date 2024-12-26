import { ObjectId } from "mongodb";

/**
 * Example Express controller that retrieves:
 *  1) The floor plan document
 *  2) The latest "readings" document
 *  3) The latest "aircon_status" document
 *  4) Combines them into a final response
 */
export async function getFloorPlanReadingsController(req, res) {
  console.log("getFloorPlanReadingsController called");
  try {
    const { db } = req.app; // or however you access Mongo
    const { buildingId, floorPlanId } = req.params;

    if (!buildingId || !floorPlanId) {
      return res.status(400).json({
        message: "BuildingId and FloorPlanId are required",
      });
    }

    // Convert floorPlanId to ObjectId if it's stored as ObjectId in Mongo
    let floorPlanObjId;
    try {
      floorPlanObjId = new ObjectId(floorPlanId);
    } catch (err) {
      return res.status(400).json({ message: "Invalid floorPlanId format" });
    }

    // 1) Fetch the floor plan
    const floorPlan = await db.collection("floorplans").findOne({
      buildingId,
      _id: floorPlanObjId,
    });

    if (!floorPlan) {
      return res.status(404).json({ message: "Floor plan not found" });
    }

    // 2) Get the latest LoraWan readings
    const latestLoraWanReadings = await db.collection("readings").findOne(
      { buildingId, floorPlanId },
      { sort: { $natural: -1 } }
    );
    console.log("latestLoraWanReading:", latestLoraWanReadings);

    const lorawanReadings = latestLoraWanReadings?.Lorawan_Readings || {};
    console.log("lorawanReadings keys:", Object.keys(lorawanReadings));

    // 3) Get the latest aircon + lights status
    const latestAirconStatus = await db.collection("aircon_status").findOne(
      { buildingId, floorPlanId },
      { sort: { $natural: -1 } }
    );
    console.log("latestAirconReadings:", latestAirconStatus);

    const airconReadings = latestAirconStatus?.FC_FullStatus_Readings || {};
    console.log("airconReadings keys:", Object.keys(airconReadings));

    // 4) Attach the Lorawan and AC data to each sensor in the floor plan
    const updatedZones = floorPlan.zones.map((zone) => {
      const updatedSensors = zone.sensors.map((sensor) => {
        // Attempt to attach lorawan readings based on sensor.uid
        let sensorReading = {};
        if (sensor.uid && sensor.uid !== "null" && lorawanReadings[sensor.uid]) {
          sensorReading = lorawanReadings[sensor.uid];
        }

        // Attempt to attach "AC" info if relevant
        // Example: if sensor.uid is "2", then the airconReadings might be at "FC_Unit_2"
        let airconUnitReading = {};
        const maybeAirconKey = `FC_Unit_${sensor.uid}`;
        if (airconReadings[maybeAirconKey]) {
          airconUnitReading = airconReadings[maybeAirconKey];
        }

        return {
          ...sensor,
          readings: {
            lorwan: sensorReading,
            aircon: airconUnitReading,
          },
        };
      });

      return {
        ...zone,
        sensors: updatedSensors,
      };
    });

    // 5) Construct final response
    const response = {
      _id: floorPlan._id,
      buildingId: floorPlan.buildingId,
      floorPlan: floorPlan.floorPlan,
      imageUrl: floorPlan.imageUrl,
      qrCodeUrl: floorPlan.qrCodeUrl || "",
      zones: updatedZones,
      airconStatus: {
        date: latestAirconStatus?.date || null,
        time: latestAirconStatus?.time || null,
        readings: airconReadings, // includes both AC units and Lights
      },
    };

    return res.status(200).json({
      message: "Floor plan readings retrieved successfully",
      data: response,
    });
  } catch (error) {
    console.error("Error retrieving floor plan readings:", error);
    return res
      .status(500)
      .json({ error: "Failed to retrieve floor plan readings" });
  }
}