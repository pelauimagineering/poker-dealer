const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../auth');

// Login endpoint
router.post('/login', (req, res) => {
    console.log('Login attempt for:', req.body.email);

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    db.users.findByEmail(email, (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify password
        if (!auth.verifyPassword(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Create session
        const session = auth.createSession(user.id, (err) => {
            if (err) {
                console.error('Session creation error:', err);
                return res.status(500).json({ error: 'Failed to create session' });
            }

            // Set cookie
            res.cookie('sessionToken', session.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                sameSite: 'lax' // Changed from 'strict' to allow cookies on navigation redirects
            });

            console.log(`User ${user.name} logged in successfully with token: ${session.token.substring(0, 8)}...`);

            res.json({
                success: true,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            });
        });
    });
});

// Logout endpoint
router.post('/logout', (req, res) => {
    const token = req.cookies.sessionToken;

    if (token) {
        auth.logout(token, () => {
            console.log('User logged out');
        });
    }

    res.clearCookie('sessionToken');
    res.json({ success: true });
});

// Check session endpoint
router.get('/session', (req, res) => {
    const token = req.cookies.sessionToken;

    console.log('GET /api/auth/session - Cookie present:', !!token);

    if (!token) {
        return res.json({ authenticated: false });
    }

    auth.validateSession(token, (err, session) => {
        if (err || !session) {
            console.log('Session validation failed:', err?.message || 'Session not found');
            res.clearCookie('sessionToken');
            return res.json({ authenticated: false });
        }

        console.log('Session valid for user:', session.name);
        res.json({
            authenticated: true,
            user: {
                id: session.user_id,
                name: session.name,
                email: session.email
            }
        });
    });
});

module.exports = router;
