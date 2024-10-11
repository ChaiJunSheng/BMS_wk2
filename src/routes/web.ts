import { createCustomerController } from "../controllers/createCustomer";
import { editZoneTempController } from "../controllers/editZoneTemp";
import { getCustomerController } from "../controllers/getCustomer";
import { getCustomersController } from "../controllers/getCustomers";
import { getEnergyReadingsController } from "../controllers/getEnergyReadings";
import { getFloorPlanByIdController } from "../controllers/getFloorPlanById";
import { getFloorPlansController } from "../controllers/getFloorPlans";
import { getLatestEnergyReadingController } from "../controllers/getLatestEnergyReadings";
import { saveFeedbackController } from "../controllers/saveFeedback";
import { saveFloorPlanController } from "../controllers/saveFloorPlan";

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
router.get('/get-latest-energy-reading', getLatestEnergyReadingController);
router.get('/get-floor-plan/:userId', getFloorPlansController);
router.put('/edit-zone-temp/:zoneId', (req, res) => {
  console.log('Request received for zone:', req.params.zoneId);
  editZoneTempController(req, res, req.io);
});
router.get('/floorplan/:floorPlanId', getFloorPlanByIdController);

module.exports = router;