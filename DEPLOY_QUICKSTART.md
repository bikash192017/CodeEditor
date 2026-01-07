# Quick Start Deployment Guide

## Backend on Render (5 minutes)

### 1. Set up MongoDB Atlas
- Create account at https://www.mongodb.com/cloud/atlas
- Create free cluster (M0)
- Add IP: 0.0.0.0/0 (allow all)
- Create database user
- Get connection string: `mongodb+srv://user:pass@cluster.xxxxx.mongodb.net/codeeditor`

### 2. Deploy to Render
1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your Git repo
4. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add environment variables:
   ```
   PORT=10000
   MONGODB_URI=<your-mongodb-atlas-url>
   JWT_SECRET=<generate-random-32-char-string>
   CLIENT_URLS=https://your-app.vercel.app
   GEMINI_API_KEY=<your-gemini-key>
   NODE_ENV=production
   ```
6. Click "Create Web Service"
7. **Save your backend URL**: `https://your-service.onrender.com`

---

## Frontend on Vercel (3 minutes)

### 1. Deploy to Vercel
1. Go to https://vercel.com
2. Click "Add New..." → "Project"
3. Import your Git repo
4. Configure:
   - **Root Directory**: `client`
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add environment variables:
   ```
   VITE_API_URL=https://your-backend.onrender.com
   VITE_SOCKET_URL=https://your-backend.onrender.com
   ```
6. Click "Deploy"
7. **Save your frontend URL**: `https://your-app.vercel.app`

### 2. Update Backend CORS
1. Go back to Render
2. Update `CLIENT_URLS` environment variable:
   ```
   https://your-app.vercel.app,https://your-app-git-main.vercel.app
   ```
3. Service will auto-redeploy

---

## Test Your Deployment

1. Visit your Vercel URL
2. Create an account
3. Create a room
4. Test real-time collaboration (open in 2 tabs)

**Done! 🎉**

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)
