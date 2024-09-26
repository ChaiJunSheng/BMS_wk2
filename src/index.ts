import { MongoClient } from 'mongodb';

const express = require('express');
const body = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const PORT = 8080;

async function start() {
  try {

    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server, {
      cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
        credentials: true,
      },
    });

    require("dotenv").config();
    const API_KEY = process.env.REST_API_KEY ;

    //Connection to mongodb
    //database_1 is the database name
    const username = process.env.DB_USERNAME ;
    const password = process.env.DB_PASSWORD ;
    const host_ip  = process.env.HOST_IP ;

    const mongo = await MongoClient.connect(`mongodb://${username}:${password}@${host_ip}:27017/database_1`);

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

    app.use((req, res, next) => {
      req.io = io;
      next();
    })

    // Routes
    app.use('/web', require('./routes/web'));

    io.on('connection', (socket) => {
      console.log('New client connected');

      socket.on('disconnect', () => {
        console.log('Client disconnected')
      })
    });

    // Start server
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

  }
  catch(error) {
    console.log(error);
  }
}

start();