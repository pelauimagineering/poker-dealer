const { Deck } = require('./deck');

class PokerGame {
    constructor() {
        this.players = [];
        this.dealerIndex = -1; // -1 indicates no dealer selected yet
        this.deck = new Deck();
        this.communityCards = [];
        this.playerHands = new Map(); // userId -> [card1, card2]
        this.revealedHands = new Set(); // Set of userIds who have revealed their cards
        this.phase = 'waiting'; // waiting, pre-flop, flop, turn, river, complete
        this.cardsDealt = false;
    }

    addPlayer(userId, userName) {
        console.log(`Adding player: ${userName} (${userId})`);

        if (this.cardsDealt) {
            throw new Error('Cannot add players once cards have been dealt');
        }

        if (this.players.length >= 10) {
            throw new Error('Maximum 10 players allowed');
        }

        const existingPlayer = this.players.find(p => p.id === userId);
        if (existingPlayer) {
            console.log(`Player ${userName} already in game`);
            return false;
        }

        this.players.push({
            id: userId,
            name: userName
        });

        return true;
    }

    removePlayer(userId) {
        const index = this.players.findIndex(p => p.id === userId);
        if (index !== -1) {
            const wasDealer = index === this.dealerIndex;

            this.players.splice(index, 1);
            this.playerHands.delete(userId);

            // If the dealer was removed, reset to no dealer
            if (wasDealer) {
                this.dealerIndex = -1;
            }
            // Adjust dealer index if it's now out of bounds
            else if (this.dealerIndex >= this.players.length) {
                this.dealerIndex = this.players.length > 0 ? 0 : -1;
            }
            // Adjust dealer index if a player before the dealer was removed
            else if (index < this.dealerIndex) {
                this.dealerIndex--;
            }
        }
    }

    selectRandomDealer() {
        if (this.players.length === 0) {
            this.dealerIndex = -1;
            return;
        }

        this.dealerIndex = Math.floor(Math.random() * this.players.length);
        console.log(`Random dealer selected: ${this.players[this.dealerIndex].name} (index ${this.dealerIndex})`);
    }

    selectDealerById(playerId) {
        if (this.players.length === 0) {
            throw new Error('No players in game to select as dealer');
        }

        // Normalize playerId to number
        const normalizedId = typeof playerId === 'string' ? parseInt(playerId, 10) : playerId;

        const playerIndex = this.players.findIndex(p => p.id === normalizedId);
        if (playerIndex === -1) {
            throw new Error('Player not found in game');
        }

        this.dealerIndex = playerIndex;
        console.log(`Dealer manually selected: ${this.players[this.dealerIndex].name} (index ${this.dealerIndex})`);
    }

    reorderPlayers(playerIds) {
        console.log('Reordering players with IDs:', playerIds);
        console.log('Current player order:', this.players.map(p => `${p.name}(${p.id})`));

        if (this.cardsDealt) {
            throw new Error('Cannot reorder players once cards have been dealt');
        }

        if (this.dealerIndex === -1) {
            throw new Error('Cannot reorder players before dealer is selected');
        }

        // Convert playerIds to numbers if they're strings (they come from HTML dataset as strings)
        const normalizedPlayerIds = playerIds.map(id => typeof id === 'string' ? parseInt(id, 10) : id);
        console.log('Normalized player IDs:', normalizedPlayerIds);

        // Validate that all player IDs match current players
        if (normalizedPlayerIds.length !== this.players.length) {
            throw new Error('Player count mismatch');
        }

        const currentPlayerIds = this.players.map(p => p.id);
        console.log('Current player IDs in game:', currentPlayerIds);
        const hasAllPlayers = normalizedPlayerIds.every(id => currentPlayerIds.includes(id));

        if (!hasAllPlayers) {
            throw new Error('Invalid player IDs provided');
        }

        // Store the current dealer's ID
        const currentDealerId = this.players[this.dealerIndex].id;
        console.log(`Current dealer: ${this.players[this.dealerIndex].name} (${currentDealerId}) at index ${this.dealerIndex}`);

        // Reorder players array based on provided IDs
        const reorderedPlayers = normalizedPlayerIds.map(id => {
            return this.players.find(p => p.id === id);
        });

        this.players = reorderedPlayers;

        // Update dealer index to match the reordered array
        this.dealerIndex = this.players.findIndex(p => p.id === currentDealerId);

        console.log(`Players reordered successfully. New order:`, this.players.map(p => `${p.name}(${p.id})`));
        console.log(`New dealer index: ${this.dealerIndex} (${this.players[this.dealerIndex].name})`);
    }

    rotateDealer() {
        if (this.players.length === 0) {
            this.dealerIndex = -1;
            return;
        }

        // If no dealer was set, start with the first player
        if (this.dealerIndex === -1) {
            this.dealerIndex = 0;
        } else {
            this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
        }
        console.log(`Dealer rotated to: ${this.players[this.dealerIndex].name} (index ${this.dealerIndex})`);
    }

    dealCards() {
        console.log('Dealing cards...');

        if (this.players.length < 2) {
            throw new Error('Need at least 2 players to deal');
        }

        if (this.cardsDealt) {
            throw new Error('Cards already dealt for this hand');
        }

        // Reset and shuffle deck
        this.deck.reset();
        this.deck.shuffle();

        // Clear previous hands
        this.playerHands.clear();
        this.communityCards = [];

        // Deal 2 hole cards to each player
        for (const player of this.players) {
            const holeCards = this.deck.deal(2);
            // Hole cards are visible to the player
            holeCards.forEach(card => card.visible = true);
            this.playerHands.set(player.id, holeCards);
        }

        // Deal 5 community cards (face down)
        this.communityCards = this.deck.deal(5);
        this.communityCards.forEach(card => card.visible = false);

        this.phase = 'pre-flop';
        this.cardsDealt = true;

        console.log(`Dealt cards to ${this.players.length} players`);
    }

    revealFlop() {
        console.log('Revealing flop...');

        if (this.phase !== 'pre-flop') {
            throw new Error('Can only reveal flop from pre-flop phase');
        }

        // Reveal first 3 community cards
        this.communityCards[0].visible = true;
        this.communityCards[1].visible = true;
        this.communityCards[2].visible = true;

        this.phase = 'flop';
    }

    revealTurn() {
        console.log('Revealing turn...');

        if (this.phase !== 'flop') {
            throw new Error('Can only reveal turn from flop phase');
        }

        // Reveal 4th community card
        this.communityCards[3].visible = true;

        this.phase = 'turn';
    }

    revealRiver() {
        console.log('Revealing river...');

        if (this.phase !== 'turn') {
            throw new Error('Can only reveal river from turn phase');
        }

        // Reveal 5th community card
        this.communityCards[4].visible = true;

        this.phase = 'river';
    }

    completeHand() {
        console.log('Completing hand...');

        this.phase = 'complete';
        this.cardsDealt = false;
        this.playerHands.clear();
        this.communityCards = [];
        this.revealedHands.clear(); // Clear revealed cards when hand completes
        this.rotateDealer();
        this.phase = 'waiting';
    }

    revealPlayerCards(userId) {
        console.log(`Player ${userId} revealing their cards`);

        if (!this.cardsDealt) {
            throw new Error('Cannot reveal cards before they are dealt');
        }

        if (!this.playerHands.has(userId)) {
            throw new Error('Player does not have cards to reveal');
        }

        if (this.revealedHands.has(userId)) {
            console.log(`Player ${userId} cards already revealed`);
            return false; // Already revealed
        }

        this.revealedHands.add(userId);
        console.log(`Player ${userId} cards revealed successfully. Total revealed: ${this.revealedHands.size}`);
        return true;
    }

    getPlayerHand(userId) {
        return this.playerHands.get(userId) || [];
    }

    getCurrentDealer() {
        if (this.players.length === 0 || this.dealerIndex === -1) {
            return null;
        }
        return this.players[this.dealerIndex];
    }

    getSmallBlindIndex() {
        if (this.players.length === 0 || this.dealerIndex === -1) {
            return -1;
        }

        // In heads-up (2 players), dealer is small blind
        if (this.players.length === 2) {
            return this.dealerIndex;
        }

        // With 3+ players, SB is to the left of dealer (dealer + 1)
        return (this.dealerIndex + 1) % this.players.length;
    }

    getBigBlindIndex() {
        if (this.players.length === 0 || this.dealerIndex === -1) {
            return -1;
        }

        // In heads-up (2 players), non-dealer is big blind
        if (this.players.length === 2) {
            return (this.dealerIndex + 1) % this.players.length;
        }

        // With 3+ players, BB is two to the left of dealer (dealer + 2)
        return (this.dealerIndex + 2) % this.players.length;
    }

    getGameState(forUserId = null) {
        const smallBlindIndex = this.getSmallBlindIndex();
        const bigBlindIndex = this.getBigBlindIndex();

        const state = {
            players: this.players.map((p, index) => ({
                id: p.id,
                name: p.name,
                isDealer: this.dealerIndex !== -1 && index === this.dealerIndex,
                isSmallBlind: smallBlindIndex !== -1 && index === smallBlindIndex,
                isBigBlind: bigBlindIndex !== -1 && index === bigBlindIndex
            })),
            dealerIndex: this.dealerIndex,
            smallBlindIndex: smallBlindIndex,
            bigBlindIndex: bigBlindIndex,
            communityCards: this.communityCards.map(card => card.toJSON()),
            phase: this.phase,
            cardsDealt: this.cardsDealt
        };

        // Include player-specific hole cards if userId is provided
        if (forUserId) {
            const holeCards = this.getPlayerHand(forUserId);
            state.holeCards = holeCards.map(card => card.toJSON());
        }

        // Include revealed hands for all players
        state.revealedHands = [];
        for (const userId of this.revealedHands) {
            const player = this.players.find(p => p.id === userId);
            const cards = this.getPlayerHand(userId);
            if (player && cards.length > 0) {
                state.revealedHands.push({
                    userId: userId,
                    playerName: player.name,
                    cards: cards.map(card => card.toJSON())
                });
            }
        }

        return state;
    }

    toJSON() {
        return {
            players: this.players,
            dealerIndex: this.dealerIndex,
            deck: this.deck.toJSON(),
            communityCards: this.communityCards.map(card => card.toJSON()),
            playerHands: Array.from(this.playerHands.entries()).map(([userId, cards]) => ({
                userId,
                cards: cards.map(card => card.toJSON())
            })),
            revealedHands: Array.from(this.revealedHands),
            phase: this.phase,
            cardsDealt: this.cardsDealt
        };
    }

    static fromJSON(data) {
        const game = new PokerGame();

        if (!data) {
            return game;
        }

        game.players = data.players || [];
        game.dealerIndex = data.dealerIndex !== undefined ? data.dealerIndex : -1;
        game.deck = data.deck ? Deck.fromJSON(data.deck) : new Deck();
        game.phase = data.phase || 'waiting';
        game.cardsDealt = data.cardsDealt || false;

        // Restore community cards
        if (data.communityCards) {
            const { Card } = require('./deck');
            game.communityCards = data.communityCards.map(cardData => {
                const card = new Card(cardData.suit, cardData.rank);
                card.visible = cardData.visible;
                return card;
            });
        }

        // Restore player hands
        if (data.playerHands) {
            const { Card } = require('./deck');
            game.playerHands.clear();
            for (const handData of data.playerHands) {
                const cards = handData.cards.map(cardData => {
                    const card = new Card(cardData.suit, cardData.rank);
                    card.visible = cardData.visible;
                    return card;
                });
                game.playerHands.set(handData.userId, cards);
            }
        }

        // Restore revealed hands
        if (data.revealedHands) {
            game.revealedHands.clear();
            for (const userId of data.revealedHands) {
                game.revealedHands.add(userId);
            }
        }

        return game;
    }
}

module.exports = { PokerGame };
