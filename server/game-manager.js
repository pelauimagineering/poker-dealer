const { PokerGame } = require('./game/poker-game');
const db = require('./db');

class GameManager {
    constructor() {
        this.game = new PokerGame();
        this.loadGameState();
    }

    loadGameState() {
        console.log('Loading game state from database...');

        db.gameState.get((err, gameState) => {
            if (err) {
                console.error('Error loading game state:', err);
                return;
            }

            if (gameState && gameState.deck_state) {
                this.game = PokerGame.fromJSON(gameState.deck_state);
                console.log(`Loaded game state: ${this.game.players.length} players, phase: ${this.game.phase}`);
            } else {
                console.log('No saved game state, starting fresh');
            }
        });
    }

    saveGameState() {
        console.log('Saving game state to database...');

        const gameState = {
            current_dealer_index: this.game.dealerIndex,
            player_order: this.game.players.map(p => p.id),
            deck_state: this.game,
            community_cards: this.game.communityCards,
            phase: this.game.phase,
            cards_dealt: this.game.cardsDealt
        };

        db.gameState.update(gameState, (err) => {
            if (err) {
                console.error('Error saving game state:', err);
            }
        });
    }

    addPlayer(userId, userName) {
        const added = this.game.addPlayer(userId, userName);

        if (added) {
            // Don't automatically select dealer - let users choose manually
            // Dealer rotation happens automatically after each hand completes
            this.saveGameState();
        }

        return added;
    }

    removePlayer(userId) {
        this.game.removePlayer(userId);
        this.saveGameState();
    }

    dealCards() {
        this.game.dealCards();
        this.saveGameState();
    }

    flipCommunityCard() {
        console.log(`Flipping community card, current phase: ${this.game.phase}`);

        switch (this.game.phase) {
            case 'pre-flop':
                this.game.revealFlop();
                break;
            case 'flop':
                this.game.revealTurn();
                break;
            case 'turn':
                this.game.revealRiver();
                break;
            case 'river':
                this.game.completeHand();
                break;
            default:
                throw new Error(`Cannot flip card in phase: ${this.game.phase}`);
        }

        this.saveGameState();
    }

    getGameState(forUserId = null) {
        return this.game.getGameState(forUserId);
    }

    canJoinGame() {
        return !this.game.cardsDealt && this.game.players.length < 10;
    }

    isDealer(userId) {
        const dealer = this.game.getCurrentDealer();
        return dealer && dealer.id === userId;
    }

    resetGame() {
        console.log('Resetting game...');
        this.game = new PokerGame();
        db.gameState.reset((err) => {
            if (err) {
                console.error('Error resetting game state:', err);
            }
        });
    }
}

module.exports = { GameManager };
