# Deployment Guide

This guide will walk you through deploying the CodeEditor application with the backend on Render and the frontend on Vercel.

---

## Part 1: Backend Deployment on Render

### Prerequisites
- A [Render](https://render.com) account (free tier available)
- A MongoDB Atlas account for production database
- Your Gemini API key

### Step 1: Prepare Your Backend Code

1. **Ensure your code is in a Git repository** (GitHub, GitLab, or Bitbucket)
   ```bash
   cd c:\Users\bikas\OneDrive\Desktop\CodeEditor
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Verify your `package.json` scripts** (already configured):
   - ✅ `build`: Compiles TypeScript to JavaScript
   - ✅ `start`: Runs the compiled code
   - ✅ `dev`: Development mode

### Step 2: Set Up MongoDB Atlas (Production Database)

1. **Create a MongoDB Atlas account** at https://www.mongodb.com/cloud/atlas
2. **Create a new cluster** (free M0 tier is sufficient to start)
3. **Configure network access**:
   - Go to "Network Access" in Atlas
   - Click "Add IP Address"
   - Select "Allow Access from Anywhere" (0.0.0.0/0) for Render
4. **Create a database user**:
   - Go to "Database Access"
   - Click "Add New Database User"
   - Create username and password (save these!)
   - Grant "Read and write to any database" permissions
5. **Get your connection string**:
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string (looks like: `mongodb+srv://username:<password>@cluster.xxxxx.mongodb.net/`)
   - Replace `<password>` with your actual password
   - Add database name at the end: `mongodb+srv://username:password@cluster.xxxxx.mongodb.net/codeeditor`

### Step 3: Create Web Service on Render

1. **Log in to Render** at https://render.com
2. **Click "New +" → "Web Service"**
3. **Connect your Git repository**:
   - Authorize Render to access your GitHub/GitLab/Bitbucket
   - Select the CodeEditor repository
4. **Configure the service**:

   | Field | Value |
   |-------|-------|
   | **Name** | `codeeditor-backend` (or your preferred name) |
   | **Region** | Choose closest to your users |
   | **Branch** | `main` (or your default branch) |
   | **Root Directory** | `server` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install --include=dev && npm run build` |
   | **Start Command** | `npm start` |
   | **Instance Type** | `Free` (or paid for better performance) |

> [!IMPORTANT]
> The build command uses `--include=dev` to install devDependencies (TypeScript, type definitions) needed for compilation.

### Step 4: Configure Environment Variables on Render

In the "Environment" section, add these environment variables:

| Key | Value | Notes |
|-----|-------|-------|
| `PORT` | `10000` | Render uses port 10000 by default |
| `MONGODB_URI` | `mongodb+srv://...` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | `your-secure-random-string` | Generate a strong secret (use a password generator) |
| `CLIENT_URLS` | `https://your-app.vercel.app` | Will update after deploying frontend |
| `GEMINI_API_KEY` | `your-gemini-api-key` | Your actual Gemini API key |
| `NODE_ENV` | `production` | Sets Node environment to production |

> [!IMPORTANT]
> - For `JWT_SECRET`, use a strong random string (at least 32 characters)
> - For `CLIENT_URLS`, you'll update this after deploying the frontend
> - Keep your `GEMINI_API_KEY` secure and never commit it to Git

### Step 5: Deploy Backend

1. **Click "Create Web Service"**
2. **Wait for deployment** (usually 2-5 minutes)
3. **Monitor the logs** for any errors
4. **Note your backend URL**: `https://codeeditor-backend.onrender.com` (or similar)

### Step 6: Test Backend Deployment

Once deployed, test your backend:

```bash
# Test health endpoint
curl https://your-backend-url.onrender.com/api/health
```

Expected response:
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2026-01-07T..."
}
```

> [!WARNING]
> **Free tier limitations on Render:**
> - Services spin down after 15 minutes of inactivity
> - First request after spin-down may take 30-60 seconds
> - Consider upgrading to a paid plan for production use

---

## Part 2: Frontend Deployment on Vercel

### Prerequisites
- A [Vercel](https://vercel.com) account (free tier available)
- Your backend URL from Render

### Step 1: Prepare Frontend Code

1. **Verify your frontend build configuration**:
   - Check `vite.config.ts` (already configured)
   - Ensure `package.json` has correct build script

### Step 2: Create Project on Vercel

1. **Log in to Vercel** at https://vercel.com
2. **Click "Add New..." → "Project"**
3. **Import your Git repository**:
   - Connect your GitHub/GitLab/Bitbucket account
   - Select the CodeEditor repository
4. **Configure the project**:

   | Field | Value |
   |-------|-------|
   | **Project Name** | `codeeditor` (or your preferred name) |
   | **Framework Preset** | `Vite` |
   | **Root Directory** | `client` |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `dist` |
   | **Install Command** | `npm install` |

### Step 3: Configure Environment Variables on Vercel

In the "Environment Variables" section, add:

| Key | Value | Notes |
|-----|-------|-------|
| `VITE_API_URL` | `https://your-backend-url.onrender.com` | Your Render backend URL |
| `VITE_SOCKET_URL` | `https://your-backend-url.onrender.com` | Same as API URL |
| `VITE_OPENAI_KEY` | `your-openai-key` | If you're using OpenAI features |

> [!IMPORTANT]
> - Replace `your-backend-url.onrender.com` with your actual Render URL
> - All Vite environment variables must start with `VITE_`
> - These variables are embedded at build time

### Step 4: Deploy Frontend

1. **Click "Deploy"**
2. **Wait for deployment** (usually 1-2 minutes)
3. **Note your frontend URL**: `https://your-app.vercel.app`

### Step 5: Update Backend CORS Settings

Now that you have your frontend URL, update the backend:

1. **Go back to Render dashboard**
2. **Select your backend service**
3. **Go to "Environment" tab**
4. **Update `CLIENT_URLS`**:
   ```
   https://your-app.vercel.app,https://your-app-git-main.vercel.app
   ```
   (Include both production and preview URLs)
5. **Save changes** (this will trigger a redeploy)

### Step 6: Test Full Application

1. **Open your Vercel URL**: `https://your-app.vercel.app`
2. **Test key features**:
   - User registration/login
   - Create a new room
   - Real-time collaboration (open room in two browser tabs)
   - Code execution
   - AI features (if configured)

---

## Post-Deployment Configuration

### Custom Domain (Optional)

#### For Vercel (Frontend):
1. Go to your project settings → "Domains"
2. Add your custom domain
3. Update DNS records as instructed

#### For Render (Backend):
1. Go to your service settings → "Custom Domains"
2. Add your custom domain
3. Update DNS records as instructed

### Monitoring and Logs

#### Render:
- View logs: Dashboard → Your Service → "Logs" tab
- Set up alerts: Dashboard → Your Service → "Alerts"

#### Vercel:
- View logs: Dashboard → Your Project → "Deployments" → Click deployment → "Logs"
- Analytics: Dashboard → Your Project → "Analytics"

---

## Troubleshooting

### Backend Issues

**Problem: MongoDB connection fails**
- ✅ Verify MongoDB Atlas connection string is correct
- ✅ Check that IP whitelist includes `0.0.0.0/0`
- ✅ Verify database user credentials
- ✅ Check Render logs for specific error messages

**Problem: CORS errors**
- ✅ Ensure `CLIENT_URLS` includes your Vercel domain
- ✅ Include both production and preview URLs
- ✅ Check that URLs don't have trailing slashes

**Problem: Service is slow to respond**
- ✅ Free tier spins down after inactivity
- ✅ Consider upgrading to paid plan
- ✅ Implement health check pings to keep service warm

### Frontend Issues

**Problem: Can't connect to backend**
- ✅ Verify `VITE_API_URL` is correct
- ✅ Check backend is running (visit health endpoint)
- ✅ Verify CORS is configured correctly
- ✅ Check browser console for errors

**Problem: Environment variables not working**
- ✅ Ensure all variables start with `VITE_`
- ✅ Redeploy after changing environment variables
- ✅ Clear browser cache

**Problem: WebSocket connection fails**
- ✅ Verify `VITE_SOCKET_URL` is correct
- ✅ Check that backend supports WebSocket connections
- ✅ Ensure no proxy/firewall blocking WebSockets

### General Tips

1. **Check logs first**: Both Render and Vercel provide detailed logs
2. **Test locally**: Ensure everything works locally before deploying
3. **Use environment variables**: Never hardcode URLs or secrets
4. **Monitor performance**: Use built-in analytics tools
5. **Set up alerts**: Get notified of deployment failures or errors

---

## Updating Your Application

### Backend Updates
1. Push changes to your Git repository
2. Render will automatically redeploy (if auto-deploy is enabled)
3. Or manually trigger deploy from Render dashboard

### Frontend Updates
1. Push changes to your Git repository
2. Vercel will automatically redeploy
3. Preview deployments created for pull requests

---

## Cost Considerations

### Free Tier Limits

**Render Free Tier:**
- 750 hours/month of runtime
- Services spin down after 15 minutes of inactivity
- 512 MB RAM
- Shared CPU

**Vercel Free Tier:**
- 100 GB bandwidth/month
- Unlimited deployments
- Automatic HTTPS
- Global CDN

### When to Upgrade

Consider upgrading when:
- You need 24/7 uptime (backend)
- You exceed bandwidth limits (frontend)
- You need better performance
- You have production users

---

## Security Best Practices

1. **Use strong secrets**: Generate random strings for `JWT_SECRET`
2. **Enable HTTPS**: Both Render and Vercel provide automatic HTTPS
3. **Restrict CORS**: Only allow your frontend domain
4. **Secure environment variables**: Never commit `.env` files
5. **Regular updates**: Keep dependencies updated
6. **Monitor logs**: Watch for suspicious activity
7. **Rate limiting**: Already implemented in your backend
8. **Input validation**: Ensure all user inputs are validated

---

## Next Steps

- [ ] Set up custom domains
- [ ] Configure monitoring and alerts
- [ ] Set up CI/CD pipelines
- [ ] Implement backup strategies
- [ ] Add error tracking (e.g., Sentry)
- [ ] Set up uptime monitoring
- [ ] Configure CDN for static assets
- [ ] Implement caching strategies

---

## Support Resources

- **Render Documentation**: https://render.com/docs
- **Vercel Documentation**: https://vercel.com/docs
- **MongoDB Atlas Documentation**: https://docs.atlas.mongodb.com/

---

**Congratulations! Your CodeEditor application is now deployed! 🎉**
