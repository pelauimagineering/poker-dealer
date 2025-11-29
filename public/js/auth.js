console.log('Auth.js loaded');

// Initialize function
function initAuth() {
    console.log('Initializing auth');

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const userSelect = document.getElementById('userSelect');
    const displayNameInput = document.getElementById('displayName');

    console.log('loginForm element:', loginForm);
    console.log('errorMessage element:', errorMessage);
    console.log('userSelect element:', userSelect);

    if (!loginForm) {
        console.error('ERROR: loginForm element not found!');
        return;
    }

    // Load available users
    loadUsers();

    // Update display name when user is selected
    userSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const displayName = selectedOption.getAttribute('data-display-name');
        const isLoggedIn = selectedOption.getAttribute('data-logged-in') === 'true';

        console.log('User selected:', selectedOption.value, 'Display name:', displayName, 'Logged in:', isLoggedIn);

        if (displayName) {
            displayNameInput.value = displayName;
        }

        // Disable the select option if user is already logged in
        if (isLoggedIn) {
            selectedOption.disabled = true;
            userSelect.value = '';
            displayNameInput.value = '';
            showError('This user is already logged in');
        }
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault(); // MUST be first!
        e.stopPropagation();
        console.log('Form submit event fired');
        console.log('Default prevented and propagation stopped');

        // Call async login function
        handleLogin();

        return false; // Extra safeguard
    });

    async function loadUsers() {
        console.log('Loading users list');

        try {
            const response = await fetch('/api/auth/users', {
                credentials: 'same-origin'
            });

            console.log('Users fetch complete, status:', response.status);
            const data = await response.json();
            console.log('Users data:', data);

            if (response.ok && data.users) {
                populateUserDropdown(data.users, data.loggedInUsers || []);
            } else {
                console.error('Failed to load users:', data.error);
                showError('Failed to load users list');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            showError('Network error loading users');
        }
    }

    function populateUserDropdown(users, loggedInUsers) {
        console.log('Populating dropdown with users:', users);
        console.log('Logged in users:', loggedInUsers);

        // Clear existing options except the first one
        while (userSelect.options.length > 1) {
            userSelect.remove(1);
        }

        // Add all users to dropdown
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.display_name} (${user.user_name})`;
            option.setAttribute('data-display-name', user.display_name);
            option.setAttribute('data-logged-in', loggedInUsers.includes(user.id) ? 'true' : 'false');

            // Style logged-in users differently
            if (loggedInUsers.includes(user.id)) {
                option.style.color = '#999';
                option.textContent += ' - Already logged in';
            }

            userSelect.appendChild(option);
        });
    }

    async function handleLogin() {
        const userId = userSelect.value;
        const displayName = displayNameInput.value.trim();

        console.log('Attempting login for user ID:', userId, 'with display name:', displayName);

        if (!userId) {
            showError('Please select a user');
            return;
        }

        if (!displayName) {
            showError('Please enter a display name');
            return;
        }

        try {
            console.log('About to fetch /api/auth/login');
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({ userId, displayName })
            });

            console.log('Fetch complete, status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);

            if (response.ok) {
                console.log('Login successful, redirecting to /game');
                window.location.href = '/game';
            } else {
                console.log('Login failed:', data.error);
                showError(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Network error. Please try again.');
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');

        setTimeout(() => {
            errorMessage.classList.remove('show');
        }, 5000);
    }
}

// Run immediately if DOM is already loaded, otherwise wait for DOMContentLoaded
if (document.readyState === 'loading') {
    console.log('DOM still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    console.log('DOM already loaded, initializing immediately');
    initAuth();
}

// Check if already logged in (not currently used to prevent infinite loop)
// async function checkSession() {
//     try {
//         const response = await fetch('/api/auth/session', {
//             credentials: 'same-origin'
//         });
//         const data = await response.json();
//
//         if (data.authenticated) {
//             console.log('Already authenticated, redirecting to game');
//             window.location.href = '/game';
//         }
//     } catch (error) {
//         console.error('Session check error:', error);
//     }
// }
