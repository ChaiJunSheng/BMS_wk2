import { addEventController } from "../controllers/web/addEvent";
import { editFloorPlanController } from "../controllers/web/editFloorPlan";
import { editZoneTempController } from "../controllers/web/editZoneTemp";
import { getAirconStatusController } from "../controllers/web/getAirconStatus";
import { getBuildingController } from "../controllers/web/getBuilding";
import { getEnergyReadingsController } from "../controllers/web/getEnergyReadings";
import { getEventsController } from "../controllers/web/getEvents";
import { getFloorPlanByIdController } from "../controllers/web/getFloorPlanById";
import { getFloorPlanReadingsController } from "../controllers/web/getFloorPlanReadings";
import { getFloorPlansController } from "../controllers/web/getFloorPlans";
import { getHistoricalEnergyReadingsController } from "../controllers/web/getHistoricalEnergyReadings";
import { getLatestEnergyReadingController } from "../controllers/web/getLatestEnergyReadings";
import { getSensorReadingsController } from "../controllers/web/getSensorReadings";
import { getSettingsController } from "../controllers/web/getSettings";
import { saveBuildingController } from "../controllers/web/saveBuilding";
import { saveFeedbackController } from "../controllers/web/saveFeedback";
import { saveFloorPlanController } from "../controllers/web/saveFloorPlan";
import { saveSettingsController } from "../controllers/web/saveSettings";

const express = require('express');
const router = express.Router();

require("dotenv").config();

const API_KEY = process.env.REST_API_KEY;

console.log('Use Web route');

function apiKeyMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (apiKey && apiKey === API_KEY) {
    next(); // API key is valid
  } else {
    const now = new Date();
    console.log(`Failed attempt : ${now.toLocaleTimeString()}`);

    res.status(401).json({ message: 'Unauthorized' }); // API key is invalid
  }
}

router.use(apiKeyMiddleware);

// Define all routes on 'router'
router.post('/save-floor-plan', saveFloorPlanController);
router.post('/save-feedback', saveFeedbackController);
router.get('/get-energy-readings', getEnergyReadingsController);
router.get('/get-latest-energy-reading/:buildingId/:floorPlanId', getLatestEnergyReadingController);
router.get('/get-historical-energy-readings/:buildingId/:floorPlanId', getHistoricalEnergyReadingsController);
router.get('/get-floor-plan/:buildingId', getFloorPlansController);
router.post('/save-settings/:buildingId/:floorPlanId', saveSettingsController);
router.get("/get-settings/:buildingId/:floorPlanId", getSettingsController);
router.put('/edit-zone-temp/:zoneId', (req, res) => {
  console.log('Request received for zone:', req.params.zoneId);
  editZoneTempController(req, res, req.io);
});
router.get('/floorplan/:floorPlanId', getFloorPlanByIdController);
router.get('/get-floor-plan-readings/:buildingId/:floorPlanId', getFloorPlanReadingsController);
router.put('/edit-floor-plan/:floorPlanId', editFloorPlanController);
router.post('/save-event/:buildingId', addEventController);
router.get('/get-events/:buildingId', getEventsController);
router.get('/get-aircon-status', getAirconStatusController);
router.post('/save-building', saveBuildingController);
router.get('/get-building/:userId', getBuildingController);
router.get('/get-sensor-readings/:buildingId/:floorPlanId', getSensorReadingsController);

module.exports = router;