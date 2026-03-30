// app.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const dataRoutes = require('./routes/data');
app.use('/api', dataRoutes);

const dataRouter = require(path.join(__dirname, 'backend', 'routes', 'data'));

const app = express();
app.use(cors());
app.use(express.json());

// serve frontend static files
app.use('/', express.static(path.join(__dirname, 'frontend')));

// API routes
app.use('/api', dataRoutes);

// fallback to index (for direct browser open)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
