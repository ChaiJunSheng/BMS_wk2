import { MongoClient } from 'mongodb';

const express = require('express');
const body = require('body-parser');
const cors = require('cors');
const PORT = 8080;

async function start() {
  try {

    const app = express();

    require("dotenv").config();
    const API_KEY = process.env.REST_API_KEY ;

    //Connection to mongodb
    //database_1 is the database name
    const username = process.env.DB_USERNAME ;
    const password = process.env.DB_PASSWORD ;
    const host_ip  = process.env.HOST_IP ;

    const mongo = await MongoClient.connect(`mongodb://${username}:${password}@${host_ip}:27017/database_1`);

    await mongo.connect();
    app.db = mongo.db();

    app.use(cors(
      {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
      }
    ));

    // body parser, limit the data sent through one request
    app.use(body.json({
      limit: '10mb'
    }));

    // Routes
    app.use('/web', require('./routes/web'));

    // Start server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

  }
  catch(error) {
    console.log(error);
  }
}

start();