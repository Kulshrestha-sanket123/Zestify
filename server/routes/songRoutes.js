const express = require('express');
const router = express.Router();
const { getAllSongs, getSongById, addSong, deleteSong } = require('../controllers/songController');
const auth = require('../middleware/authMiddleware');

// GET /api/songs  ← app.js fetch(`${API_BASE_URL}/songs`) — no /all suffix
router.get('/', getAllSongs);

// GET /api/songs/:id
router.get('/:id', getSongById);

// POST /api/songs  (admin use)
router.post('/', auth, addSong);

// DELETE /api/songs/:id  (admin use)
router.delete('/:id', auth, deleteSong);

module.exports = router;