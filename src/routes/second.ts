import { ssController } from "../controllers/second_control";

const express  = require('express');

const router = express.Router();

console.log('second route');

router.post('/', ssController);

module.exports = router;