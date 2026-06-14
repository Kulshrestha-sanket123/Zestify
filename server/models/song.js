const mongoose = require("mongoose");

const songSchema = new mongoose.Schema({
    songName: { type: String, required: true },
    artistName: { type: String, required: true },
    filePath: { type: String, required: true },
    // cover aur coverPath dono rakhe hain — purani documents kaam karengi, nayi bhi
    cover: { type: String, default: '' },
    coverPath: { type: String, default: '' },
    album: { type: String, default: 'Single' },
    category: { type: String, default: 'trending' }
}, { timestamps: true });

// Virtual — jo bhi field filled ho, woh return karo
songSchema.virtual('coverUrl').get(function () {
    return this.cover || this.coverPath || '';
});

module.exports = mongoose.model('Song', songSchema);