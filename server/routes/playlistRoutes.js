const express = require('express');
const router = express.Router();
const Playlist = require('../models/playlist');
const auth = require('../middleware/authMiddleware');

// POST /api/playlists  ← app.js createPlaylistOnDB calls this
router.post('/', auth, async (req, res) => {
    try {
        const { name } = req.body;
        if(!name || !name.trim())
            return res.status(400).json({ msg: 'Playlist name is required' });

        const existing = await Playlist.findOne({ name: name.trim(), user: req.user.id });
        if(existing)
            return res.status(400).json({ msg: 'Playlist with this name already exists' });

        const newPlaylist = new Playlist({ name: name.trim(), user: req.user.id });
        await newPlaylist.save();
        res.status(201).json(newPlaylist);
    } catch(err) {
        console.error("Create playlist error:", err);
        res.status(500).json({ msg: 'Server error creating playlist' });
    }
});

// GET /api/playlists/all  ← app.js fetch(`${API_BASE_URL}/playlists/all`)
router.get('/all', auth, async (req, res) => {
    try {
        const playlists = await Playlist.find({ user: req.user.id }).lean();

        // Return tracks as string arrays so app.js can compare with song IDs directly
        const formatted = playlists.map(p => ({
            ...p,
            tracks: (p.tracks || []).map(id => id.toString())
        }));

        res.json(formatted);
    } catch(err) {
        console.error("Get playlists error:", err);
        res.status(500).json({ msg: 'Server error fetching playlists' });
    }
});

// PUT /api/playlists/add  ← app.js addTrackToPlaylistOnDB calls this
router.put('/add', auth, async (req, res) => {
    try {
        const { playlistName, trackId } = req.body;

        if (!playlistName || !trackId)
            return res.status(400).json({ msg: 'playlistName and trackId are required' });

        const playlist = await Playlist.findOne({ name: playlistName, user: req.user.id });
        if(!playlist)
            return res.status(404).json({ msg: 'Playlist not found' });

        const alreadyAdded = playlist.tracks.some(id => id.toString() === trackId);
        if(alreadyAdded)
            return res.status(400).json({ msg: 'Track already in playlist' });

        playlist.tracks.push(trackId);
        await playlist.save();

        res.json({ msg: 'Track added', playlist });
    } catch(err) {
        console.error("Add track error:", err);
        res.status(500).json({ msg: 'Server error adding track' });
    }
});

// DELETE /api/playlists/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const playlist = await Playlist.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        if(!playlist)
            return res.status(404).json({ msg: 'Playlist not found or unauthorized' });
        res.json({ msg: 'Playlist deleted' });
    } catch(err) {
        console.error("Delete playlist error:", err);
        res.status(500).json({ msg: 'Server error deleting playlist' });
    }
});

module.exports = router;