console.log('Auth.js loaded');

// Initialize function
function initAuth() {
    console.log('Initializing auth');

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    console.log('loginForm element:', loginForm);
    console.log('errorMessage element:', errorMessage);

    if (!loginForm) {
        console.error('ERROR: loginForm element not found!');
        return;
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault(); // MUST be first!
        e.stopPropagation();
        console.log('Form submit event fired');
        console.log('Default prevented and propagation stopped');

        // Call async login function
        handleLogin();

        return false; // Extra safeguard
    });

    async function handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        console.log('Attempting login for:', email);

        try {
            console.log('About to fetch /api/auth/login');
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({ email, password })
            });

            console.log('Fetch complete, status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);

            if (response.ok) {
                console.log('Login successful, redirecting to /game');
                // Redirect to game page
                //window.location.href = 'http://pelau.com'; // '/game';
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
