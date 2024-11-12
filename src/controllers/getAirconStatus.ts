export async function getAirconStatusController(req, res) {
    console.log("getAirconStatusController called");
    try {
        console.log("Request body: ", req.body);
        const { db } = req.app;
        
        const aircons = await db
            .collection('lorawan')
            .find({ FC_FullStatus_Readings: { $exists: true } })
            .sort({ date: -1, time: -1 })
            .limit(1)
            .toArray();

        if (!aircons || aircons.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No aircon status data found"
            });
        }

        const latestReading = aircons[0];
        const fcUnits = [];

        if (!latestReading.FC_FullStatus_Readings) {
            return res.status(404).json({
                success: false,
                message: "No FC status readings found in the latest data"
            });
        }

        for (let i = 1; i <= 8; i++) {
            const unitKey = `FC_Unit_${i}`;
            const unit = latestReading.FC_FullStatus_Readings[unitKey];

            if (unit) {
                fcUnits.push({
                    id: i,
                    name: `AC${i}`,
                    isOn: unit.Status === "ON",
                    temp: parseInt(unit.Set_Point),
                    fanSpeed: getFanSpeedValue(unit.Fan_Status),
                    slave_id: (i - 1).toString()
                })
            }
        }

        return res.status(200).json({
            success: true,
            data: fcUnits
        })
    } catch (error) {
        console.error("Error in getAirconStatusController: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        })
    }
}

function getFanSpeedValue(fanStatus) {
    switch (fanStatus.toUpperCase()) {
        case "LOW":
            return 1;
        case "MID":
        case "MEDIUM":
            return 2;
        case "HIGH":
            return 3;
        default:
            return 1;
    }
}