# Quick Setup Guide

## Environment Files

The environment example files are created as `env.example` in both client and server directories. To use them:

**Windows (PowerShell):**
```powershell
# In client directory
Copy-Item env.example .env

# In server directory  
Copy-Item env.example .env
```

**Linux/Mac:**
```bash
# In client directory
cp env.example .env

# In server directory
cp env.example .env
```

Or manually rename `env.example` to `.env.example` and then copy to `.env` as needed.

## Initial Setup Steps

1. **Install client dependencies:**
   ```bash
   cd client
   npm install
   ```

2. **Install server dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Set up environment variables:**
   - Copy `env.example` to `.env` in both client and server directories
   - Update the values in `.env` files with your configuration

4. **Start MongoDB** (if not using Docker):
   - Make sure MongoDB is running on `mongodb://localhost:27017`

5. **Start development servers:**
   - Server: `cd server && npm run dev`
   - Client: `cd client && npm run dev`

## Using Docker

1. Navigate to docker directory:
   ```bash
   cd docker
   ```

2. Start all services:
   ```bash
   docker-compose up -d
   ```

3. View logs:
   ```bash
   docker-compose logs -f
   ```








