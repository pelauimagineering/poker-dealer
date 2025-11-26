const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const auth = require('./auth');
const authRoutes = require('./routes/auth');
const { initWebSocketServer } = require('./websocket');

const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve login page as default
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Serve game page (requires authentication)
app.get('/game', (req, res) => {
    const token = req.cookies.sessionToken;

    if (!token) {
        return res.redirect('/');
    }

    auth.validateSession(token, (err, session) => {
        if (err || !session) {
            return res.redirect('/');
        }

        res.sendFile(path.join(__dirname, '..', 'public', 'game.html'));
    });
});

// Serve public community cards display (no authentication required)
app.get('/community', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'community.html'));
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
initWebSocketServer(server);

// Cleanup expired sessions periodically (every hour)
setInterval(() => {
    console.log('Cleaning up expired sessions...');
    auth.cleanupExpiredSessions();
}, 60 * 60 * 1000);

// Start server
server.listen(PORT, () => {
    console.log(`\n===========================================`);
    console.log(`Poker Dealer Server Started`);
    console.log(`===========================================`);
    console.log(`Server running on: http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`===========================================\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        const db = require('./db');
        db.close();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        const db = require('./db');
        db.close();
        process.exit(0);
    });
});
