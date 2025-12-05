let currentUser = null;
let gameState = null;

// Initialize app
async function init() {
    console.log('Initializing game app...');

    // Check session
    try {
        const response = await fetch('/api/auth/session', {
            credentials: 'same-origin'
        });
        const data = await response.json();

        if (!data.authenticated) {
            console.log('Not authenticated, redirecting to login');
            window.location.href = '/';
            return;
        }

        currentUser = data.user;
        const token = data.token;  // Get token from response instead of cookie
        document.getElementById('userName').textContent = currentUser.name;

        console.log('User authenticated:', currentUser.name);

        // Connect WebSocket
        if (token) {
            wsClient.connect(token);
            setupWebSocketHandlers();
        } else {
            console.error('No session token found');
            window.location.href = '/';
        }

    } catch (error) {
        console.error('Session check error:', error);
        window.location.href = '/';
    }

    // Setup logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Setup join game
    document.getElementById('joinGameBtn').addEventListener('click', joinGame);

    // Setup choose dealer
    document.getElementById('chooseDealerBtn').addEventListener('click', chooseDealer);

    // Setup reset game
    document.getElementById('resetGameBtn').addEventListener('click', resetGame);

    // Setup video toggle
    setupVideoToggle();
}

function setupVideoToggle() {
    const toggleCheckbox = document.getElementById('toggle-video');
    const videoSection = document.querySelector('.game-room-section');

    if (!toggleCheckbox || !videoSection) {
        console.warn('Video toggle elements not found');
        return;
    }

    // Add event listener for checkbox changes
    toggleCheckbox.addEventListener('change', function() {
        if (this.checked) {
            videoSection.classList.add('visible');
            console.log('Video section shown');
        } else {
            videoSection.classList.remove('visible');
            console.log('Video section hidden');
        }
    });

    console.log('Video toggle initialized');
}

function setupWebSocketHandlers() {
    // Handle authentication confirmation
    wsClient.on('authenticated', (message) => {
        console.log('WebSocket authenticated');
    });

    // Handle game state updates
    wsClient.on('game-state', (message) => {
        console.log('Game state updated');
        gameState = message.data;
        updateUI();
    });

    // Handle cards dealt
    wsClient.on('cards-dealt', (message) => {
        console.log('Cards dealt!');
        showSuccess('Cards have been dealt!');
    });

    // Handle community card revealed
    wsClient.on('community-revealed', (message) => {
        console.log('Community card revealed:', message.phase);
        showSuccess(`${message.phase} revealed!`);
    });

    // Handle join accepted
    wsClient.on('join-accepted', (message) => {
        console.log('Join accepted');
        showSuccess('Successfully joined the game!');
    });

    // Handle join rejected
    wsClient.on('join-rejected', (message) => {
        console.log('Join rejected:', message.message);
        showError(message.message);
    });

    // Handle errors
    wsClient.on('error', (message) => {
        console.error('WebSocket error:', message.message);
        showError(message.message);
    });

    // Handle dealer selected
    wsClient.on('dealer-selected', (message) => {
        console.log('Dealer selected:', message.dealer.name);
        showSuccess(`${message.dealer.name} has been selected as the dealer!`);
    });

    // Handle game reset
    wsClient.on('game-reset', (message) => {
        console.log('Game has been reset');
        showSuccess(message.message);
        // Redirect to login after a short delay
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    });
}

function updateUI() {
    if (!gameState) {
        return;
    }

    console.log('Updating UI with game state:', gameState);

    // Update players list
    updatePlayersList();

    // Update community cards
    updateCommunityCards();

    // Update hole cards
    updateHoleCards();

    // Update phase indicator
    updatePhaseIndicator();

    // Show/hide join game section
    updateJoinGameSection();

    // Update choose dealer button state
    updateChooseDealerButton();
}

function updatePlayersList() {
    const playersList = document.getElementById('playersList');

    if (!gameState.players || gameState.players.length === 0) {
        playersList.innerHTML = '<div class="no-cards-message">No players yet</div>';
        return;
    }

    playersList.innerHTML = '';

    // Check if current user is the dealer and cards haven't been dealt
    const currentDealer = gameState.players.find(p => p.isDealer);
    const isCurrentUserDealer = currentDealer && currentDealer.id === currentUser.id;
    const canReorder = isCurrentUserDealer && !gameState.cardsDealt;

    console.log('updatePlayersList - Can reorder:', canReorder, 'isDealer:', isCurrentUserDealer, 'cardsDealt:', gameState.cardsDealt);

    gameState.players.forEach((player, index) => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.dataset.playerId = player.id;
        playerItem.dataset.playerIndex = index;

        if (player.isDealer) {
            playerItem.classList.add('is-dealer');
        }

        // Make draggable only if dealer and cards haven't been dealt
        if (canReorder) {
            playerItem.setAttribute('draggable', 'true');
            playerItem.classList.add('draggable');
            setupDragAndDrop(playerItem);
        }

        const playerName = document.createElement('span');
        playerName.className = 'player-name';
        playerName.textContent = player.name;

        playerItem.appendChild(playerName);

        if (player.isDealer) {
            const badge = document.createElement('span');
            badge.className = 'player-dealer-badge';
            badge.textContent = 'DEALER';
            playerItem.appendChild(badge);
        }

        // Add drag handle indicator if draggable
        if (canReorder) {
            const dragHandle = document.createElement('span');
            dragHandle.className = 'drag-handle';
            dragHandle.textContent = '☰';
            playerItem.insertBefore(dragHandle, playerItem.firstChild);
        }

        playersList.appendChild(playerItem);
    });
}

let draggedElement = null;

function setupDragAndDrop(element) {
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);
    element.addEventListener('dragend', handleDragEnd);
    element.addEventListener('dragenter', handleDragEnter);
    element.addEventListener('dragleave', handleDragLeave);
}

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    console.log('Drag started for player:', this.dataset.playerId);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (draggedElement !== this) {
        const playersList = document.getElementById('playersList');
        const allItems = Array.from(playersList.querySelectorAll('.player-item'));

        const draggedIndex = allItems.indexOf(draggedElement);
        const targetIndex = allItems.indexOf(this);

        console.log('Drop - moving from index', draggedIndex, 'to', targetIndex);

        // Reorder DOM elements
        if (draggedIndex < targetIndex) {
            this.parentNode.insertBefore(draggedElement, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedElement, this);
        }

        // Send new order to server
        sendPlayerOrder();
    }

    this.classList.remove('drag-over');
    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');

    // Remove all drag-over classes
    const playersList = document.getElementById('playersList');
    const allItems = playersList.querySelectorAll('.player-item');
    allItems.forEach(item => {
        item.classList.remove('drag-over');
    });

    draggedElement = null;
}

function sendPlayerOrder() {
    const playersList = document.getElementById('playersList');
    const allItems = Array.from(playersList.querySelectorAll('.player-item'));
    const playerIds = allItems.map(item => item.dataset.playerId);

    console.log('Sending new player order to server:', playerIds);

    wsClient.send('reorder-players', { playerIds: playerIds });
}

function updateCommunityCards() {
    const communityCards = document.getElementById('communityCards');

    if (!gameState.communityCards || gameState.communityCards.length === 0) {
        communityCards.innerHTML = '<div class="no-cards-message">Waiting for cards to be dealt...</div>';
        return;
    }

    communityCards.innerHTML = '';

    gameState.communityCards.forEach(card => {
        const cardElement = createCardElement(card);
        communityCards.appendChild(cardElement);
    });
}

let isViewingHoleCards = false;

function updateHoleCards() {
    const holeCardsContainer = document.getElementById('holeCards');

    if (!gameState.holeCards || gameState.holeCards.length === 0) {
        holeCardsContainer.innerHTML = '<div class="no-cards-message">No cards yet</div>';
        return;
    }

    holeCardsContainer.innerHTML = '';

    // Create cards (they will be shown as card-backs initially)
    gameState.holeCards.forEach(card => {
        const cardElement = createHoleCardElement(card);
        holeCardsContainer.appendChild(cardElement);
    });

    // Setup peek functionality
    setupHoleCardsPeek();
}

function createHoleCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card hole-card';

    // Store the card data for peeking
    cardDiv.dataset.suit = card.suit;
    cardDiv.dataset.rank = card.rank;

    // Initially show as card back
    cardDiv.classList.add('card-back');

    return cardDiv;
}

function setupHoleCardsPeek() {
    const holeCardsContainer = document.getElementById('holeCards');

    // Remove any existing event listeners
    const newContainer = holeCardsContainer.cloneNode(true);
    holeCardsContainer.parentNode.replaceChild(newContainer, holeCardsContainer);

    const holeCards = document.getElementById('holeCards');

    // Mouse events for desktop
    holeCards.addEventListener('mousedown', startPeekingHoleCards);
    holeCards.addEventListener('mouseup', stopPeekingHoleCards);
    holeCards.addEventListener('mouseleave', stopPeekingHoleCards);

    // Touch events for mobile
    holeCards.addEventListener('touchstart', startPeekingHoleCards);
    holeCards.addEventListener('touchend', stopPeekingHoleCards);
    holeCards.addEventListener('touchcancel', stopPeekingHoleCards);
}

function startPeekingHoleCards(e) {
    e.preventDefault();
    if (isViewingHoleCards) return;

    isViewingHoleCards = true;
    const holeCardsContainer = document.getElementById('holeCards');
    holeCardsContainer.classList.add('peeking');

    // Reveal all hole cards
    const cards = holeCardsContainer.querySelectorAll('.hole-card');
    cards.forEach(card => {
        revealHoleCard(card);
    });

    console.log('Peeking at hole cards');
}

function stopPeekingHoleCards(e) {
    if (!isViewingHoleCards) return;

    isViewingHoleCards = false;
    const holeCardsContainer = document.getElementById('holeCards');
    holeCardsContainer.classList.remove('peeking');

    // Hide all hole cards
    const cards = holeCardsContainer.querySelectorAll('.hole-card');
    cards.forEach(card => {
        hideHoleCard(card);
    });

    console.log('Stopped peeking at hole cards');
}

function revealHoleCard(cardDiv) {
    // Remove card back styling
    cardDiv.classList.remove('card-back');

    // Add suit class for coloring
    cardDiv.classList.add(cardDiv.dataset.suit);

    // Create and add card content
    const cardContent = document.createElement('div');
    cardContent.className = 'card-content';

    const rankSpan = document.createElement('span');
    rankSpan.className = 'card-rank';
    rankSpan.textContent = cardDiv.dataset.rank;

    const suitSpan = document.createElement('span');
    suitSpan.className = 'card-suit';
    suitSpan.textContent = getSuitSymbol(cardDiv.dataset.suit);

    cardContent.appendChild(rankSpan);
    cardContent.appendChild(suitSpan);
    cardDiv.appendChild(cardContent);
}

function hideHoleCard(cardDiv) {
    // Remove card content
    cardDiv.innerHTML = '';

    // Remove suit class
    cardDiv.classList.remove(cardDiv.dataset.suit);

    // Add card back styling
    cardDiv.classList.add('card-back');
}

function updatePhaseIndicator() {
    const phaseIndicator = document.getElementById('phaseIndicator');
    phaseIndicator.textContent = `Phase: ${gameState.phase}`;
}

function updateJoinGameSection() {
    const joinGameSection = document.getElementById('joinGameSection');

    // Check if current user is in the players list
    const isInGame = gameState.players && gameState.players.some(p => p.id === currentUser.id);

    if (!isInGame && !gameState.cardsDealt) {
        joinGameSection.classList.remove('hidden');
    } else {
        joinGameSection.classList.add('hidden');
    }
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

function joinGame() {
    console.log('Attempting to join game');
    wsClient.send('join-game');
}

function chooseDealer() {
    console.log('Attempting to choose dealer');
    wsClient.send('choose-dealer');
}

async function resetGame() {
    console.log('Reset game button clicked');

    // Prompt for challenge phrase
    const challengePhrase = prompt('Enter the challenge phrase to reset the game:');

    if (!challengePhrase) {
        console.log('Reset cancelled - no phrase entered');
        return;
    }

    // Confirm the action
    const confirmed = confirm('Are you sure you want to reset the game? This will log out all players and clear the game state.');

    if (!confirmed) {
        console.log('Reset cancelled by user');
        return;
    }

    console.log('Attempting to reset game...');

    try {
        const response = await fetch('/api/game/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({ challengePhrase })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Game reset successful');
            showSuccess(data.message);
            // Redirect to login after a short delay
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            console.error('Reset failed:', data.error);
            showError(data.error || 'Failed to reset game');
        }
    } catch (error) {
        console.error('Reset error:', error);
        showError('Network error. Please try again.');
    }
}

function updateChooseDealerButton() {
    const chooseDealerBtn = document.getElementById('chooseDealerBtn');

    // Enable button only if:
    // - There are players in the game
    // - No dealer has been selected yet
    // - Cards have not been dealt
    const hasPlayers = gameState.players && gameState.players.length > 0;
    const noDealerSelected = !gameState.players || !gameState.players.some(p => p.isDealer);
    const noCardsDealt = !gameState.cardsDealt;

    const shouldEnable = hasPlayers && noDealerSelected && noCardsDealt;

    chooseDealerBtn.disabled = !shouldEnable;

    console.log('Choose dealer button state:', {
        hasPlayers,
        noDealerSelected,
        noCardsDealt,
        shouldEnable
    });
}

async function logout() {
    console.log('Logging out...');

    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin'
        });
        wsClient.close();
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');

    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 5000);
}

function showSuccess(message) {
    // Create success message if it doesn't exist
    let successDiv = document.getElementById('successMessage');

    if (!successDiv) {
        successDiv = document.createElement('div');
        successDiv.id = 'successMessage';
        successDiv.className = 'success-message';
        document.body.appendChild(successDiv);
    }

    successDiv.textContent = message;
    successDiv.classList.add('show');

    setTimeout(() => {
        successDiv.classList.remove('show');
    }, 3000);
}

// Initialize when page loads
window.addEventListener('load', init);
