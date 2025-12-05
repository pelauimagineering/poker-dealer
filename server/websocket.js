const WebSocket = require('ws');
const auth = require('./auth');
const { GameManager } = require('./game-manager');

const clients = new Map(); // userId -> WebSocket
const publicClients = new Set(); // WebSocket connections for public views

let gameManager = null;

function initWebSocketServer(server) {
    console.log('Initializing WebSocket server...');

    gameManager = new GameManager();

    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        console.log('New WebSocket connection');

        let userId = null;
        let userName = null;

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log('Received message:', data.type);

                handleMessage(ws, data, (newUserId, newUserName) => {
                    userId = newUserId;
                    userName = newUserName;
                });
            } catch (error) {
                console.error('Error handling message:', error);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: error.message
                }));
            }
        });

        ws.on('close', () => {
            console.log(`WebSocket connection closed for user: ${userName || 'public'}`);

            if (userId) {
                clients.delete(userId);
            } else {
                publicClients.delete(ws);
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    console.log('WebSocket server initialized');

    return wss;
}

function handleMessage(ws, data, setUser) {
    const { type, token } = data;

    // Handle public authentication for community display
    if (type === 'auth-public') {
        console.log('Public WebSocket connection established');
        publicClients.add(ws);

        // Send initial community state including revealed hands
        const gameState = gameManager.getGameState(); // Get full state including revealed hands
        const communityState = {
            communityCards: gameState.communityCards,
            phase: gameState.phase,
            cardsDealt: gameState.cardsDealt,
            revealedHands: gameState.revealedHands
        };

        ws.send(JSON.stringify({
            type: 'community-state',
            data: communityState
        }));

        return;
    }

    // Handle public community state request
    if (type === 'get-community-state') {
        const gameState = gameManager.getGameState(); // Get full state including revealed hands
        const communityState = {
            communityCards: gameState.communityCards,
            phase: gameState.phase,
            cardsDealt: gameState.cardsDealt,
            revealedHands: gameState.revealedHands
        };

        ws.send(JSON.stringify({
            type: 'community-state',
            data: communityState
        }));

        return;
    }

    // Authenticate WebSocket connection
    if (type === 'auth') {
        auth.validateSession(token, (err, session) => {
            if (err || !session) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Invalid or expired session'
                }));
                return;
            }

            const userId = session.user_id;
            const userName = session.display_name;

            setUser(userId, userName);
            clients.set(userId, ws);

            console.log(`User authenticated via WebSocket: ${userName} (${userId})`);

            // Send authentication confirmation
            ws.send(JSON.stringify({
                type: 'authenticated',
                user: {
                    id: userId,
                    display_name: userName,
                    user_name: session.user_name
                }
            }));

            // Send current game state
            const gameState = gameManager.getGameState(userId);
            ws.send(JSON.stringify({
                type: 'game-state',
                data: gameState
            }));
        });

        return;
    }

    // All other messages require authentication
    auth.validateSession(token, (err, session) => {
        if (err || !session) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Not authenticated'
            }));
            return;
        }

        const userId = session.user_id;
        const userName = session.display_name;

        // Handle different message types
        switch (type) {
            case 'join-game':
                handleJoinGame(userId, userName, ws);
                break;

            case 'deal-cards':
                handleDealCards(userId, ws);
                break;

            case 'flip-community-card':
                handleFlipCommunityCard(userId, ws);
                break;

            case 'choose-dealer':
                handleChooseDealer(userId, ws);
                break;

            case 'reorder-players':
                handleReorderPlayers(userId, data.playerIds, ws);
                break;

            case 'show-my-cards':
                handleShowMyCards(userId, ws);
                break;

            case 'get-state':
                const gameState = gameManager.getGameState(userId);
                ws.send(JSON.stringify({
                    type: 'game-state',
                    data: gameState
                }));
                break;

            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `Unknown message type: ${type}`
                }));
        }
    });
}

function handleJoinGame(userId, userName, ws) {
    console.log(`User ${userName} attempting to join game`);

    if (!gameManager.canJoinGame()) {
        ws.send(JSON.stringify({
            type: 'join-rejected',
            message: 'Cannot join game - cards already dealt or game is full'
        }));
        return;
    }

    const added = gameManager.addPlayer(userId, userName);

    if (added) {
        console.log(`User ${userName} joined the game`);

        // Broadcast updated game state to all clients
        broadcastGameState();

        ws.send(JSON.stringify({
            type: 'join-accepted',
            message: 'Successfully joined the game'
        }));
    } else {
        ws.send(JSON.stringify({
            type: 'join-rejected',
            message: 'Already in game'
        }));
    }
}

function handleDealCards(userId, ws) {
    console.log(`User ${userId} attempting to deal cards`);

    if (!gameManager.isDealer(userId)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Only the dealer can deal cards'
        }));
        return;
    }

    try {
        gameManager.dealCards();
        console.log('Cards dealt successfully');

        // Broadcast to all clients
        broadcastGameState();

        // Send specific notification
        broadcast({
            type: 'cards-dealt',
            message: 'Cards have been dealt'
        });
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

function handleFlipCommunityCard(userId, ws) {
    console.log(`User ${userId} attempting to flip community card`);

    if (!gameManager.isDealer(userId)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Only the dealer can flip community cards'
        }));
        return;
    }

    try {
        const phaseBefore = gameManager.game.phase;
        gameManager.flipCommunityCard();
        const phaseAfter = gameManager.game.phase;

        console.log(`Community card flipped: ${phaseBefore} -> ${phaseAfter}`);

        // Broadcast to all clients
        broadcastGameState();

        // Send specific notification
        broadcast({
            type: 'community-revealed',
            phase: phaseAfter
        });
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

function handleChooseDealer(userId, ws) {
    console.log(`User ${userId} attempting to choose dealer`);

    // Check if dealer has already been chosen (game has started)
    if (gameManager.game.cardsDealt || (gameManager.game.dealerIndex >= 0 && gameManager.game.players.length > 0)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Dealer has already been selected for this game session'
        }));
        return;
    }

    // Check if there are players to choose from
    if (gameManager.game.players.length === 0) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'No players in game to select as dealer'
        }));
        return;
    }

    try {
        gameManager.game.selectRandomDealer();
        gameManager.saveGameState();

        const dealer = gameManager.game.getCurrentDealer();
        console.log(`Dealer selected: ${dealer.name}`);

        // Broadcast to all clients
        broadcastGameState();

        // Send specific notification
        broadcast({
            type: 'dealer-selected',
            dealer: {
                id: dealer.id,
                name: dealer.name
            }
        });
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

function handleReorderPlayers(userId, playerIds, ws) {
    console.log(`User ${userId} attempting to reorder players`);
    console.log('Received playerIds:', playerIds);

    // Check if current user is the dealer
    if (!gameManager.isDealer(userId)) {
        console.log('User is not the dealer, rejecting request');
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Only the dealer can reorder players'
        }));
        return;
    }

    try {
        console.log('User is dealer, proceeding with reorder');
        gameManager.game.reorderPlayers(playerIds);

        console.log('Saving game state to database...');
        gameManager.saveGameState();

        console.log('Players reordered successfully, broadcasting to all clients');

        // Broadcast updated game state to all clients
        broadcastGameState();

        ws.send(JSON.stringify({
            type: 'players-reordered',
            message: 'Players reordered successfully'
        }));
    } catch (error) {
        console.error('Error reordering players:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

function handleShowMyCards(userId, ws) {
    console.log(`User ${userId} attempting to show their cards`);

    try {
        const revealed = gameManager.game.revealPlayerCards(userId);

        if (revealed) {
            console.log(`Player ${userId} revealed their cards successfully`);
            gameManager.saveGameState();

            // Broadcast updated game state to all clients
            broadcastGameState();

            ws.send(JSON.stringify({
                type: 'cards-revealed',
                message: 'Your cards have been revealed to all players'
            }));
        } else {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Your cards are already revealed'
            }));
        }
    } catch (error) {
        console.error('Error revealing cards:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

function broadcastGameState() {
    console.log(`Broadcasting game state to ${clients.size} authenticated clients and ${publicClients.size} public clients`);

    // Broadcast to authenticated clients with their specific game state
    for (const [userId, client] of clients.entries()) {
        if (client.readyState === WebSocket.OPEN) {
            const gameState = gameManager.getGameState(userId);
            client.send(JSON.stringify({
                type: 'game-state',
                data: gameState
            }));
        }
    }

    // Broadcast community cards and revealed hands to public clients
    const gameState = gameManager.getGameState(); // Get full state including revealed hands
    const communityState = {
        communityCards: gameState.communityCards,
        phase: gameState.phase,
        cardsDealt: gameState.cardsDealt,
        revealedHands: gameState.revealedHands
    };

    for (const client of publicClients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'community-state',
                data: communityState
            }));
        }
    }
}

function broadcast(message) {
    const messageStr = JSON.stringify(message);

    for (const [userId, client] of clients.entries()) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    }
}

function removePlayerFromGame(userId, userName) {
    if (gameManager) {
        console.log(`Removing player ${userName} (${userId}) from game`);
        gameManager.removePlayer(userId);
        broadcastGameState();
    }
}

function selectRandomDealer() {
    if (gameManager && gameManager.game.players.length > 0) {
        console.log('Selecting random dealer from current players');
        gameManager.game.selectRandomDealer();
        gameManager.saveGameState();
        broadcastGameState();
        return true;
    }
    return false;
}

function notifyGameReset() {
    console.log('Notifying all clients that game has been reset');

    // Notify all authenticated clients
    broadcast({
        type: 'game-reset',
        message: 'The game has been reset. Please log in again.'
    });

    // Notify all public clients
    for (const client of publicClients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'game-reset',
                message: 'The game has been reset.'
            }));
        }
    }

    // Reset the game manager
    if (gameManager) {
        gameManager.resetGame();
    }
}

module.exports = {
    initWebSocketServer,
    broadcastGameState,
    broadcast,
    removePlayerFromGame,
    selectRandomDealer,
    notifyGameReset
};
