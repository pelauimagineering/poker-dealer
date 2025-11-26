const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    console.log('Attempting login for:', email);

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Login successful');
            // Redirect to game page
            window.location.href = '/game';
        } else {
            showError(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Network error. Please try again.');
    }
});

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');

    setTimeout(() => {
        errorMessage.classList.remove('show');
    }, 5000);
}

// Check if already logged in
async function checkSession() {
    try {
        const response = await fetch('/api/auth/session', {
            credentials: 'same-origin'
        });
        const data = await response.json();

        if (data.authenticated) {
            console.log('Already authenticated, redirecting to game');
            window.location.href = '/game';
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
}

// Don't auto-redirect authenticated users on login page
// This was causing an infinite redirect loop
// checkSession();
