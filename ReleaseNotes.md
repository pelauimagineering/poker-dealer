# Release Notes - Poker Dealer

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
