const mongoose = require('mongoose');

const PlaylistSchema = new mongoose.Schema({
    name: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tracks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }]   // renamed songs → tracks (matches app.js)
}, { timestamps: true });

module.exports = mongoose.model('Playlist', PlaylistSchema);