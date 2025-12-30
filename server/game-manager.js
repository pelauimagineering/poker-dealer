const { PokerGame } = require('./game/poker-game');
const db = require('./db');

const TIMER_DURATION_SECONDS = 420; // 7 minutes

class GameManager {
    constructor() {
        this.game = new PokerGame();
        this.timerStartTime = null;
        this.timerDurationSeconds = TIMER_DURATION_SECONDS;
        this.blindsWillIncrease = false;
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

                // Load timer state
                this.timerStartTime = gameState.timer_start_time || null;
                this.timerDurationSeconds = gameState.timer_duration_seconds || TIMER_DURATION_SECONDS;
                this.blindsWillIncrease = gameState.blinds_will_increase || false;
                console.log(`Timer state: startTime=${this.timerStartTime}, blindsWillIncrease=${this.blindsWillIncrease}`);
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
            cards_dealt: this.game.cardsDealt,
            timer_start_time: this.timerStartTime,
            timer_duration_seconds: this.timerDurationSeconds,
            blinds_will_increase: this.blindsWillIncrease
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

        // Start timer on first deal if not already running
        if (!this.timerStartTime) {
            this.timerStartTime = new Date().toISOString();
            console.log(`Timer started at: ${this.timerStartTime}`);
        }

        // Reset blinds_will_increase flag on new deal
        if (this.blindsWillIncrease) {
            console.log('Blinds have increased for this hand');
            this.blindsWillIncrease = false;
        }

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
        const state = this.game.getGameState(forUserId);

        // Add timer state to game state
        state.timerState = this.getTimerState();

        return state;
    }

    getTimerState() {
        if (!this.timerStartTime) {
            return {
                isRunning: false,
                startTime: null,
                durationSeconds: this.timerDurationSeconds,
                remainingSeconds: this.timerDurationSeconds,
                expired: false,
                blindsWillIncrease: this.blindsWillIncrease
            };
        }

        const startTime = new Date(this.timerStartTime);
        const now = new Date();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const remainingSeconds = Math.max(0, this.timerDurationSeconds - elapsedSeconds);
        const expired = remainingSeconds === 0;

        return {
            isRunning: true,
            startTime: this.timerStartTime,
            durationSeconds: this.timerDurationSeconds,
            remainingSeconds: remainingSeconds,
            expired: expired,
            blindsWillIncrease: this.blindsWillIncrease
        };
    }

    checkAndUpdateTimerExpiration() {
        const timerState = this.getTimerState();

        if (timerState.expired && !this.blindsWillIncrease) {
            console.log('Timer expired! Blinds will increase on next deal.');
            this.blindsWillIncrease = true;
            this.saveGameState();
            return true; // Timer just expired
        }

        return false;
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

        // Reset timer state
        this.timerStartTime = null;
        this.timerDurationSeconds = TIMER_DURATION_SECONDS;
        this.blindsWillIncrease = false;

        db.gameState.reset((err) => {
            if (err) {
                console.error('Error resetting game state:', err);
            }
        });
    }
}

module.exports = { GameManager };
