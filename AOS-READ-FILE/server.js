const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 9102;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const connectionConfigsController = require('./modules/connection-configs/connection-configs.controller');
app.use('/api/connection-configs', connectionConfigsController);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 API Server is running on http://localhost:${PORT}`);
    console.log(`📡 Connection Configs API: http://localhost:${PORT}/api/connection-configs`);
});
