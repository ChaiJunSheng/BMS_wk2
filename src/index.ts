import { MongoClient } from 'mongodb';

const express = require('express');
const body = require('body-parser');
const PORT = 8080;

async function start() {
  try {

    const app = express();
    

    //Link to instance 
    //database_1 is the database name
    const mongo = await MongoClient.connect('mongodb://ec2-100-26-45-153.compute-1.amazonaws.com:27017/database_1');

    await mongo.connect();
    app.db = mongo.db();

    // body parser, limit the data sent through one request
    app.use(body.json({
      limit: '500kb'
    }));

    // Routes
    app.use('/customers', require('./routes/customers'));
    app.use('/second', require('./routes/second'));

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