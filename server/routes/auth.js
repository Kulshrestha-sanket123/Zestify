const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const auth = require('../middleware/authMiddleware');

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if(!username || !email || !password)
            return res.status(400).json({ msg: 'All fields are required' });

        const existing = await User.findOne({ email });
        if(existing)
            return res.status(400).json({ msg: 'Email already registered' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({ username, email, password: hashedPassword });
        await user.save();

        res.status(201).json({ msg: 'Account created successfully' });
    } catch(err) {
        console.error("Signup error:", err);
        res.status(500).json({ msg: 'Server error during signup' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if(!email || !password)
            return res.status(400).json({ msg: 'Email and password required' });

        const user = await User.findOne({ email });
        if(!user)
            return res.status(400).json({ msg: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch)
            return res.status(400).json({ msg: 'Invalid credentials' });

        const token = jwt.sign(
            { user: { id: user._id } },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        // Return token + profile + likedSongs as string array for app.js
        res.json({
            token,
            profile: {
                name: user.username,
                plan: 'Premium Plus',
                minutesStreamed: user.minutesStreamed || 0
            },
            likedSongs: user.likedSongs.map(id => id.toString())
        });
    } catch(err) {
        console.error("Login error:", err);
        res.status(500).json({ msg: 'Server error during login' });
    }
});

// GET /api/auth/profile  ← was completely missing, app.js calls this
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password').lean();
        if(!user)
            return res.status(404).json({ msg: 'User not found' });

        res.json({
            profile: {
                name: user.username,
                plan: 'Premium Plus',
                minutesStreamed: user.minutesStreamed || 0
            },
            likedSongs: user.likedSongs.map(id => id.toString())
        });
    } catch(err) {
        console.error("Profile fetch error:", err);
        res.status(500).json({ msg: 'Server error fetching profile' });
    }
});

module.exports = router;