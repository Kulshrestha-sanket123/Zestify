const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/user');

// POST /api/user/like  ← app.js calls this exact path
router.post('/like', auth, async(req, res) => {
    try {
        const { songId, isAdding } = req.body;

        if(!songId)
            return res.status(400).json({ msg: 'songId is required' });

        const user = await User.findById(req.user.id);
        if(!user)
            return res.status(404).json({ msg: 'User not found' });

        const alreadyLiked = user.likedSongs.some(id => id.toString() === songId);

        if(isAdding && !alreadyLiked) {
            user.likedSongs.push(songId);
        } else if(!isAdding && alreadyLiked) {
            user.likedSongs = user.likedSongs.filter(id => id.toString() !== songId);
        }

        await user.save();

        // Return updated liked songs as string array
        res.json({ likedSongs: user.likedSongs.map(id => id.toString()) });
    } catch(err) {
        console.error("Like/unlike error:", err);
        res.status(500).json({ msg: 'Server error updating liked songs' });
    }
});

module.exports = router;