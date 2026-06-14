const Song = require('../models/song');

// cover field normalize karo — purana coverPath ya naya cover, dono kaam karein
function normalizeSong(song) {
    const s = song.toObject ? song.toObject() : { ...song };
    s.cover = s.cover || s.coverPath || '';
    return s;
}

// GET /api/songs
exports.getAllSongs = async(req, res) => {
    try {
        const songs = await Song.find().lean();
        // Normalize cover field for every song
        const normalized = songs.map(s => ({ ...s, cover: s.cover || s.coverPath || '' }));
        res.status(200).json(normalized);
    } catch(err) {
        console.error("Error fetching songs:", err);
        res.status(500).json({ message: "Failed to fetch songs" });
    }
};

// GET /api/songs/:id
exports.getSongById = async(req, res) => {
    try {
        const song = await Song.findById(req.params.id).lean();
        if(!song) return res.status(404).json({ message: "Song not found" });
        res.status(200).json({ ...song, cover: song.cover || song.coverPath || '' });
    } catch(err) {
        console.error("Error fetching song:", err);
        res.status(500).json({ message: "Failed to fetch song" });
    }
};

// POST /api/songs
exports.addSong = async(req, res) => {
    try {
        const newSong = new Song(req.body);
        await newSong.save();
        res.status(201).json(normalizeSong(newSong));
    } catch(err) {
        console.error("Error adding song:", err);
        res.status(400).json({ message: err.message });
    }
};

// DELETE /api/songs/:id
exports.deleteSong = async(req, res) => {
    try {
        const deleted = await Song.findByIdAndDelete(req.params.id);
        if(!deleted) return res.status(404).json({ message: "Song not found" });
        res.status(200).json({ message: "Song deleted successfully" });
    } catch(err) {
        console.error("Error deleting song:", err);
        res.status(500).json({ message: "Failed to delete song" });
    }
};