// // app.js
// const express = require('express');
// const path = require('path');
// const cors = require('cors');

// const app = express(); 

// const dataRoutes = require('./backend/routes/data');
// app.use(cors());
// app.use(express.json());

// // serve frontend static files
// app.use('/', express.static(path.join(__dirname, 'frontend')));

// // API routes
// app.use('/api', dataRoutes);

// // fallback to index (for direct browser open)
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
// });

// //app.get()

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));

// const express = require('express');

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express(); // ✅ create app FIRST

// ✅ import routes (correct path)
const dataRoutes = require('./backend/routes/data');

// middlewares
app.use(cors());
app.use(express.json());

// ✅ serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend')));

// ✅ API routes
app.use('/api', dataRoutes);

// ✅ fallback route (optional but good)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});