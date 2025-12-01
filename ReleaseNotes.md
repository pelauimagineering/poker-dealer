# Release Notes - Poker Dealer

## 2025-12-01 - feature/reset-phrase-env-variable

### Enhancement

#### Configurable Reset Challenge Phrase
- **Environment Variable Configuration**: Reset challenge phrase is now configurable via environment variable
  - Game reset functionality previously used hardcoded challenge phrase "milliken mills posse"
  - Now reads from `RESET_PHRASE` environment variable for flexibility
  - Maintains backward compatibility with default value if environment variable is not set
  - Allows production deployments to use custom reset phrase via Digital Ocean App Platform
  - Improves security by allowing different phrases per environment

### Technical Details

#### Backend Changes
- Modified `server/routes/game.js`:
  - Line 6: Changed from hardcoded string to `process.env.RESET_PHRASE || 'milliken mills posse'`
  - Maintains same case-insensitive validation logic
  - No breaking changes to API endpoint behavior

#### Environment Configuration
- Updated `.env` file:
  - Added `RESET_PHRASE` environment variable under "Game Reset Configuration" section
  - Default value: "milliken mills posse" for local development
  - Production deployments should set this via Digital Ocean App Platform dashboard

### Usage
- **Local Development**: Set `RESET_PHRASE` in `.env` file
- **Production**: Configure via Digital Ocean App Platform environment variables dashboard
- **Default Behavior**: If not configured, falls back to "milliken mills posse"

---

## 2025-11-27 - feature/video-toggle-control

### New Feature

#### Video Section Toggle
- **Show/Hide Video Control**: Added toggle checkbox to show/hide the Jitsi video conference section
  - Video section is hidden by default when the page loads
  - "Show Video" checkbox in the header controls visibility
  - When checked, the video conference section appears
  - When unchecked, the video section is hidden
  - Improves page performance by allowing users to hide video when not needed

### Technical Details

#### Frontend Changes
- Modified `public/css/game.css`:
  - Added `display: none` to `.game-room-section` to hide by default
  - Added `.game-room-section.visible` class to show when toggled
  - Updated comment from "Join Game Section" to "Video Room Section"

- Modified `public/js/game.js`:
  - Added `setupVideoToggle()` function to handle checkbox changes
  - Listens for changes on `#toggle-video` checkbox
  - Toggles `.visible` class on `.game-room-section` element
  - Added console logging for debugging
  - Integrated into main `init()` function

### Usage
1. Load the game page
2. Video section is hidden by default
3. Click "Show Video" checkbox to reveal the Jitsi video conference
4. Uncheck to hide the video section again

---

## 2025-11-27 - feature/logout-player-removal-and-dealer-selection

### New Features

#### Player Removal on Logout
- **Automatic Player Cleanup**: When a user logs out, they are automatically removed from the active game
  - Prevents logged-out users from being accidentally selected as dealer
  - Game state updates in real-time for all remaining players
  - Ensures player list accurately reflects currently active players

#### Manual Dealer Selection
- **"Choose Dealer" Button**: Added new UI control for manual dealer selection
  - Located in the Players section of the game interface
  - Randomly selects the first dealer from all currently logged-in players
  - Button is enabled only when:
    * At least one player has joined the game
    * No dealer has been selected yet
    * No cards have been dealt
  - Once clicked, the button becomes permanently disabled
  - Button remains disabled for all subsequent hands until server restart with `--reset` flag
  - Automatic dealer rotation for subsequent hands continues to work as before

### Technical Details

#### Backend Changes
- Modified `server/routes/auth.js`:
  - Updated logout endpoint to validate session before deletion
  - Added call to `removePlayerFromGame()` during logout process

- Modified `server/websocket.js`:
  - Added `removePlayerFromGame()` function to handle player removal
  - Added `handleChooseDealer()` WebSocket message handler
  - Added validation to prevent re-selection of dealer after initial choice
  - Added 'choose-dealer' message type to WebSocket switch
  - Broadcasts game state updates when players leave or dealer is selected

- Modified `server/game-manager.js`:
  - Removed automatic dealer selection when first player joins
  - Allows manual dealer selection via "Choose Dealer" button

#### Frontend Changes
- Modified `public/game.html`:
  - Added "Choose Dealer" button in Players section
  - Added hint text explaining button functionality

- Modified `public/css/game.css`:
  - Added `.choose-dealer-section` styling with proper spacing and borders
  - Added `.choose-dealer-hint` styling for instructional text
  - Added disabled state styling for the button

- Modified `public/js/game.js`:
  - Added `chooseDealer()` function to send WebSocket message
  - Added `updateChooseDealerButton()` function to manage button state
  - Added event listener for button clicks
  - Added 'dealer-selected' WebSocket message handler
  - Integrated button state updates into main `updateUI()` flow

### What Gets Updated
- **Player List**: Automatically updated when players log out
- **Dealer Selection**: Manual control for first dealer, automatic rotation thereafter
- **Game State**: Real-time synchronization across all connected clients

### Usage
1. Start server normally or with `--reset` flag for clean state
2. Players login and join the game
3. Any player can click "Choose Dealer" to randomly select first dealer
4. Button becomes disabled after selection
5. Game proceeds with automatic dealer rotation for subsequent hands

---

## 2025-11-27 - feature/colored-suit-symbols

### Enhancement
- **Colored Suit Symbols**: Card suit symbols (♥ ♦ ♣ ♠) now display in their appropriate colors
  - Hearts and Diamonds: Red (#e74c3c)
  - Clubs and Spades: Black (#2c3e50)
  - Applies to all card displays including:
    - Player hole cards
    - Community cards on game view
    - Public community cards display

### Technical Details
- Modified `public/css/cards.css` to apply suit-specific colors to both rank and suit symbols
- Leverages existing CSS variable system for consistent theming
- No changes required to JavaScript card rendering logic
## 2025-11-27 - feature/reset-game-parameter

### New Feature
- **Reset Command Line Flag**: Added `--reset` parameter for clean server startup
  - Clears all game state (players, cards, dealer position, game phase)
  - Logs out all users by clearing all active sessions
  - Useful for starting fresh game sessions or testing scenarios

### Usage
```bash
# Using npm script
npm run start:reset

# Direct node command
node server/index.js --reset
```

### What Gets Reset
- **Game State**: All players removed, cards cleared, dealer position reset, phase set to 'waiting'
- **User Sessions**: All active sessions deleted, forcing all users to log in again
- **Database**: Only sessions and game_state tables affected; user accounts remain intact

### Technical Details
- Added `deleteAll()` method to session operations in `server/db.js`
- Modified `server/index.js` to detect `--reset` flag via `process.argv`
- Reset operations execute before server starts listening
- Added `start:reset` npm script in `package.json`
- Updated README.md with reset documentation

---

## 2025-11-26 - feature/poker-dealer-app

### Initial Release
Complete Texas Hold'em digital dealer application with the following features:

#### Core Functionality
- Support for up to 10 simultaneous players
- Real-time WebSocket communication for instant updates
- Automatic dealer rotation after each hand
- Mobile-responsive design for phones and tablets
- Public community cards display (no authentication required)

#### Authentication & Sessions
- Simple email/password authentication
- 10 pre-configured test accounts
- httpOnly session cookies for security
- 24-hour session duration

#### Game Features
- Deal hole cards (2 per player, visible only to owner)
- Deal community cards (5 cards, revealed progressively)
- Dealer controls for card dealing and revealing
- Phases: Pre-Flop → Flop (3 cards) → Turn (1 card) → River (1 card)
- Player order based on join sequence
- Random initial dealer selection

#### Bug Fixes Applied
- Fixed cookie path issue preventing session persistence
- Fixed httpOnly cookie access for WebSocket authentication
- Fixed login infinite loop caused by automatic redirects
- Added proper fetch credentials for cookie support
- Changed sameSite policy from 'strict' to 'lax'

### Technology Stack
- Backend: Node.js with Express
- WebSocket: ws library
- Database: SQLite (embedded)
- Frontend: Vanilla HTML, CSS, and JavaScript
- Deployment: Docker containerization
