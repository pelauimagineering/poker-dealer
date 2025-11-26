let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 2000;

function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log('Connecting to WebSocket:', wsUrl);

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts = 0;
        updateConnectionStatus(true);

        // Send public auth message (no token needed for community view)
        ws.send(JSON.stringify({
            type: 'auth-public',
            view: 'community'
        }));

        // Request initial game state
        ws.send(JSON.stringify({
            type: 'get-community-state'
        }));
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log('WebSocket message received:', message.type);
            handleMessage(message);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed');
        updateConnectionStatus(false);

        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);

            setTimeout(() => {
                connect();
            }, reconnectDelay);
        }
    };
}

function handleMessage(message) {
    switch (message.type) {
        case 'community-state':
            updateCommunityCards(message.data);
            break;

        case 'game-state':
            updateCommunityCards(message.data);
            break;

        case 'cards-dealt':
            console.log('Cards dealt!');
            break;

        case 'community-revealed':
            console.log('Community card revealed:', message.phase);
            break;

        case 'error':
            console.error('Server error:', message.message);
            break;
    }
}

function updateCommunityCards(state) {
    if (!state) {
        return;
    }

    console.log('Updating community cards with state:', state);

    // Update community cards
    const communityCards = document.getElementById('communityCards');

    if (!state.communityCards || state.communityCards.length === 0) {
        communityCards.innerHTML = '<div class="no-cards-message">Waiting for cards to be dealt...</div>';
    } else {
        communityCards.innerHTML = '';

        state.communityCards.forEach(card => {
            const cardElement = createCardElement(card);
            communityCards.appendChild(cardElement);
        });
    }

    // Update phase indicator
    updatePhaseIndicator(state.phase || 'waiting');
}

function updatePhaseIndicator(phase) {
    const phaseIndicator = document.getElementById('phaseIndicator');

    const phaseNames = {
        'waiting': 'Waiting for game to start',
        'pre-flop': 'Pre-Flop - Cards Dealt',
        'flop': 'Flop',
        'turn': 'Turn',
        'river': 'River',
        'complete': 'Hand Complete'
    };

    phaseIndicator.textContent = phaseNames[phase] || phase;
}

function createCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';

    if (!card.visible) {
        cardDiv.classList.add('card-back');
        return cardDiv;
    }

    cardDiv.classList.add(card.suit);

    const cardContent = document.createElement('div');
    cardContent.className = 'card-content';

    const rankSpan = document.createElement('span');
    rankSpan.className = 'card-rank';
    rankSpan.textContent = card.rank;

    const suitSpan = document.createElement('span');
    suitSpan.className = 'card-suit';
    suitSpan.textContent = getSuitSymbol(card.suit);

    cardContent.appendChild(rankSpan);
    cardContent.appendChild(suitSpan);
    cardDiv.appendChild(cardContent);

    // Add flip animation
    cardDiv.classList.add('flipping');
    setTimeout(() => {
        cardDiv.classList.remove('flipping');
    }, 500);

    return cardDiv;
}

function getSuitSymbol(suit) {
    const symbols = {
        'hearts': '♥',
        'diamonds': '♦',
        'clubs': '♣',
        'spades': '♠'
    };
    return symbols[suit] || suit;
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');

    if (indicator && text) {
        if (connected) {
            indicator.classList.add('connected');
            text.textContent = 'Connected';
        } else {
            indicator.classList.remove('connected');
            text.textContent = 'Disconnected';
        }
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    console.log('Initializing community display...');
    connect();
});
