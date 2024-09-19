import { createCustomerController } from "../controllers/createCustomer";
import { getCustomerController } from "../controllers/getCustomer";
import { getCustomersController } from "../controllers/getCustomers";
import { getFloorPlansController } from "../controllers/getFloorPlans";
import { saveFloorPlanController } from "../controllers/saveFloorPlan";

const express  = require('express');

const router = express.Router();
const app = express();

require("dotenv").config();

const API_KEY = process.env.REST_API_KEY ;

console.log('Use Web route');

function apiKeyMiddleware(req, res, next) {
    const apiKey = req.headers['x-api-key'];
  
    if (apiKey && apiKey === API_KEY) {
      next();  // API key is valid
    } else {
        const now = new Date();
        console.log(`Failed attempt : ${now.toLocaleTimeString()}`);

      res.status(401).json({ message: 'Unauthorized' });  // API key is invalid

    }
  }

router.use(apiKeyMiddleware);
router.get('/', getCustomersController);
router.post('/', createCustomerController);
router.get('/:id', getCustomerController);
router.post('/save-floor-plan', saveFloorPlanController);
router.get('/get-floor-plan/:userId', getFloorPlansController)
module.exports = router;
