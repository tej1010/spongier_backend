require('dotenv').config(); // Load environment variables
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const http = require('http');
const config = require('./config/config'); // Ensure you have a config file for your PORT
const app = express(); // Initialize Express
const server = http.createServer(app); // Create an HTTP server for WebSocket support if needed

// Set the global root path
global.appRootPath = __dirname;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS for all origins (adjust based on your requirements)
app.use(cors());

// Enable compression for response payloads
app.use(compression());

// Set the view engine to EJS
app.set('view engine', 'ejs');

// Load middlewares
require('./middlewares/index')(app);

// Load routes
require('./middlewares/routes')(app);

// Initialize SMS Worker
require('./helper/sms.worker');

// Start the server
server.listen(config.PORT || 3000, () => {
  console.log(`🚀 Server is running on port: ${config.PORT || 3000}`);
});
