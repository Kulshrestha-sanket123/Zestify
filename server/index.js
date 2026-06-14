const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/songs', require('./routes/songRoutes'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/playlists', require('./routes/playlistRoutes'));
app.use('/api/user', require('./routes/userRoutes'));   // ← was missing, app.js calls /api/user/like

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// 404 fallback
app.use((req, res) => res.status(404).json({ msg: `Route ${req.method} ${req.path} not found` }));

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ msg: 'Internal server error' });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected");
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch(err => {
        console.error("MongoDB Connection Error:", err);
        process.exit(1);
    });