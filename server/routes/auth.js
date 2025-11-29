const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../auth');

// Get all users endpoint
router.get('/users', (req, res) => {
    console.log('Fetching all users');

    db.users.getAll((err, users) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // Get logged in user IDs
        db.sessions.getLoggedInUserIds((err, loggedInUserIds) => {
            if (err) {
                console.error('Error fetching logged in users:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            console.log('Users fetched:', users.length, 'Logged in:', loggedInUserIds.length);

            res.json({
                success: true,
                users: users,
                loggedInUsers: loggedInUserIds
            });
        });
    });
});

// Login endpoint
router.post('/login', (req, res) => {
    console.log('Login attempt for user ID:', req.body.userId);

    const { userId, displayName } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    if (!displayName || !displayName.trim()) {
        return res.status(400).json({ error: 'Display name is required' });
    }

    // Find user by ID
    db.users.findById(userId, (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update display name if changed
        const trimmedDisplayName = displayName.trim();
        if (user.display_name !== trimmedDisplayName) {
            db.users.updateDisplayName(userId, trimmedDisplayName, (err) => {
                if (err) {
                    console.error('Error updating display name:', err);
                    // Continue with login even if display name update fails
                }
            });
        }

        // Create session (allow multiple sessions for same user)
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
                sameSite: 'lax',
                path: '/'
            });

            console.log(`User ${trimmedDisplayName} (${user.user_name}) logged in successfully with token: ${session.token.substring(0, 8)}...`);

            res.json({
                success: true,
                user: {
                    id: user.id,
                    display_name: trimmedDisplayName,
                    user_name: user.user_name
                }
            });
        });
    });
});

// Logout endpoint
router.post('/logout', (req, res) => {
    const token = req.cookies.sessionToken;

    if (token) {
        // Validate session to get user ID before deleting
        auth.validateSession(token, (err, session) => {
            if (!err && session) {
                const userId = session.user_id;
                const displayName = session.display_name;

                // Remove player from active game
                const { removePlayerFromGame } = require('../websocket');
                removePlayerFromGame(userId, displayName);

                console.log(`User ${displayName} logged out and removed from game`);
            }

            // Delete session
            auth.logout(token, () => {
                console.log('Session deleted');
            });
        });
    }

    res.clearCookie('sessionToken', { path: '/' });
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
            res.clearCookie('sessionToken', { path: '/' });
            return res.json({ authenticated: false });
        }

        console.log('Session valid for user:', session.display_name);
        res.json({
            authenticated: true,
            token: token,
            user: {
                id: session.user_id,
                display_name: session.display_name,
                user_name: session.user_name
            }
        });
    });
});

module.exports = router;
