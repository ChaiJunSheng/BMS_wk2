import { createCustomerController } from "../controllers/createCustomer";
import { getCustomerController } from "../controllers/getCustomer";
import { getCustomersController } from "../controllers/getCustomers";

const express  = require('express');

const router = express.Router();
const app = express();
const API_KEY = '123';

console.log('Use Web route');

function apiKeyMiddleware(req, res, next) {
    const apiKey = req.headers['x-api-key'];
  
    if (apiKey && apiKey === API_KEY) {
      next();  // API key is valid
    } else {
        console.log("Failed attempt")
      res.status(401).json({ message: 'Unauthorized' });  // API key is invalid
    }
  }

router.use(apiKeyMiddleware);
router.get('/', getCustomersController);
router.post('/', createCustomerController);
router.get('/:id', getCustomerController);

module.exports = router;
