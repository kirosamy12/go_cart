# Google OAuth Integration Guide

## Setup Instructions

1. The Google OAuth credentials need to be added to the `.env` file:
   - GOOGLE_CLIENT_ID: Your Google OAuth Client ID
   - GOOGLE_CLIENT_SECRET: Your Google OAuth Client Secret
   - GOOGLE_CALLBACK_URL: http://localhost:4000/api/auth/google/callback

## How It Works

### Backend Implementation

1. **Passport Configuration**: The `googleAuth.js` file configures the Google OAuth strategy
2. **User Handling**: 
   - Checks if user exists with Google ID
   - If not, checks if user exists with same email
   - Creates new user if neither exists
3. **Token Generation**: Generates JWT token after successful Google authentication

### API Endpoints

1. **Initiate Google Auth**: `GET /api/auth/google`
2. **Callback URL**: `GET /api/auth/google/callback`

## Frontend Integration

### Option 1: Redirect to Google Auth

```javascript
// On button click
window.location.href = 'http://localhost:4000/api/auth/google';
```

### Option 2: Popup Window

```javascript
// Open popup window
const popup = window.open(
  'http://localhost:4000/api/auth/google',
  'Google Login',
  'width=500,height=600'
);

// Listen for token message
window.addEventListener('message', (event) => {
  if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
    const token = event.data.token;
    // Store token in localStorage
    localStorage.setItem('token', token);
    // Redirect user or update UI
  }
});
```

## Security Notes

1. The session secret is stored in `.env` file
2. JWT secret is stored in `.env` file
3. All sensitive credentials should be kept secure

## Testing

1. Start the server: `npm start`
2. Navigate to `http://localhost:4000/api/auth/google`
3. Complete Google authentication
4. You should be redirected with a JWT token