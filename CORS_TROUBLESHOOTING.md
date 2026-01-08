# CORS and WebSocket Troubleshooting Guide

## Quick Fix: Configure CLIENT_URLS on Render

### Step-by-Step Instructions

1. **Go to Render Dashboard**
   - Navigate to [https://dashboard.render.com](https://dashboard.render.com)
   - Sign in to your account

2. **Select Your Backend Service**
   - Find and click on your backend service: `codeeditor-1-yo0a`

3. **Navigate to Environment Tab**
   - Click on "Environment" in the left sidebar

4. **Add CLIENT_URLS Environment Variable**
   - Click "Add Environment Variable"
   - **Key**: `CLIENT_URLS`
   - **Value**: `https://codeeditor-woad-psi.vercel.app,http://localhost:5173,http://localhost:5174`
   - Click "Save Changes"

5. **Redeploy the Service**
   - Render will automatically redeploy your service
   - Wait for the deployment to complete (usually 2-5 minutes)

6. **Verify the Fix**
   - Open your Vercel frontend: `https://codeeditor-woad-psi.vercel.app`
   - Open browser DevTools (F12)
   - Try to login
   - Check the Console tab - CORS errors should be gone

---

## Common Error Messages

### CORS Error
```
Access to XMLHttpRequest at 'https://codeeditor-1-yo0a.onrender.com/api/auth/login' 
from origin 'https://codeeditor-woad-psi.vercel.app' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Cause**: Backend is not configured to accept requests from your frontend domain.

**Solution**: Add `CLIENT_URLS` environment variable on Render (see above).

---

### WebSocket Connection Failed
```
WebSocket connection to 'wss://codeeditor-1-yo0a.onrender.com/socket.io/?EIO=4&transport=websocket' failed
⚠️ Socket connect error: websocket error
```

**Cause**: WebSocket upgrade is failing, possibly due to:
- CORS not configured (primary cause)
- Reverse proxy not configured for WebSocket
- Firewall blocking WebSocket traffic

**Solution**: 
1. First, fix CORS by adding `CLIENT_URLS` (see above)
2. Socket.IO will automatically fall back to HTTP long-polling if WebSocket fails

---

## Verification Steps

### 1. Check Backend Health
Open in browser: `https://codeeditor-1-yo0a.onrender.com/api/health`

Expected response:
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2026-01-08T..."
}
```

### 2. Check CORS Headers
Open browser DevTools → Network tab → Try to login → Check the failed request:

**Response Headers should include:**
```
Access-Control-Allow-Origin: https://codeeditor-woad-psi.vercel.app
Access-Control-Allow-Credentials: true
```

If these headers are missing, the `CLIENT_URLS` environment variable is not set correctly.

### 3. Check Socket.IO Connection
Open browser DevTools → Console tab → Look for:

**Success:**
```
✅ Socket connected
```

**Failure:**
```
⚠️ Socket connect error: websocket error
```

---

## Environment Variable Format

### For Render Backend

**Variable Name:** `CLIENT_URLS`

**Format:** Comma-separated list of allowed origins (no spaces after commas)

**Examples:**

Single origin:
```
https://codeeditor-woad-psi.vercel.app
```

Multiple origins:
```
https://codeeditor-woad-psi.vercel.app,http://localhost:5173,http://localhost:5174
```

**Important Notes:**
- No trailing slashes on URLs
- Include protocol (`https://` or `http://`)
- No spaces around commas
- Include both production and development URLs

---

## Testing Checklist

After configuring `CLIENT_URLS` and redeploying:

- [ ] Backend health endpoint responds: `https://codeeditor-1-yo0a.onrender.com/api/health`
- [ ] No CORS errors in browser console when attempting login
- [ ] Login succeeds and returns JWT token
- [ ] Socket.IO connection establishes successfully
- [ ] Can create a new room
- [ ] Can join an existing room
- [ ] Real-time code editing works
- [ ] Chat messages sync across clients
- [ ] Code execution works

---

## Advanced Debugging

### Check Render Logs

1. Go to Render Dashboard → Your Service
2. Click "Logs" tab
3. Look for the startup message:
   ```
   ⚡ Socket.IO initialized with allowed origins: [ 'https://codeeditor-woad-psi.vercel.app', ... ]
   ```
4. Verify your Vercel URL is in the list

### Check Environment Variables

1. Go to Render Dashboard → Your Service → Environment
2. Verify `CLIENT_URLS` is set correctly
3. Check for typos in the URL

### Force Redeploy

If changes don't take effect:
1. Go to Render Dashboard → Your Service
2. Click "Manual Deploy" → "Deploy latest commit"
3. Wait for deployment to complete

---

## Need More Help?

If you're still experiencing issues after following this guide:

1. **Check Render logs** for any error messages
2. **Verify environment variables** are set correctly
3. **Clear browser cache** and try again
4. **Try a different browser** to rule out browser-specific issues
5. **Check if Render service is running** (not sleeping/crashed)
