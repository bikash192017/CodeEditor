# Real-Time Collaborative Code Editor

A MERN stack application for real-time collaborative code editing with WebSocket support.

> **Note:** Setup in progress...

## Project Structure

```
CodeEditor/
├── client/          # React + TypeScript frontend
├── server/          # Node.js + Express backend
└── docker/          # Docker configurations
```

## Tech Stack

### Client
- React 18 with TypeScript
- Vite for build tooling
- Monaco Editor for code editing
- Socket.io Client for real-time communication
- Zustand for state management
- Tailwind CSS for styling
- React Query for data fetching

### Server
- Node.js with Express and TypeScript
- Socket.io for WebSocket communication
- MongoDB with Mongoose
- JWT for authentication
- OpenAI integration (optional)

## Setup Instructions

### Prerequisites
- Node.js 20+ installed
- MongoDB installed (or use Docker)
- npm or yarn package manager

### Client Setup

1. Navigate to client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment file:
```bash
# Windows
copy env.example .env

# Linux/Mac
cp env.example .env
```

4. Update `.env` with your configuration values

5. Start development server:
```bash
npm run dev
```

### Server Setup

1. Navigate to server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment file:
```bash
# Windows
copy env.example .env

# Linux/Mac
cp env.example .env
```

4. Update `.env` with your configuration values:
   - MongoDB connection string
   - JWT secret key
   - OpenAI API key (optional)
   - Client URL for CORS

5. Start development server:
```bash
npm run dev
```

## Docker Setup

1. Make sure Docker and Docker Compose are installed

2. Navigate to docker directory:
```bash
cd docker
```

3. Start all services:
```bash
docker-compose up -d
```

This will start:
- MongoDB on port 27017
- Server on port 5000
- Client on port 5173

4. To stop all services:
```bash
docker-compose down
```

## Development

- Client runs on `http://localhost:5173`
- Server runs on `http://localhost:5000`
- MongoDB runs on `mongodb://localhost:27017`

## Folder Structure Details

### Client
```
client/
├── src/
│   ├── components/    # Reusable React components
│   ├── pages/         # Page components
│   ├── hooks/         # Custom React hooks
│   ├── utils/         # Utility functions
│   ├── contexts/      # React contexts
│   ├── App.tsx        # Main app component
│   ├── main.tsx       # Entry point
│   └── index.css      # Global styles
```

### Server
```
server/
├── src/
│   ├── routes/        # Express routes
│   ├── controllers/   # Route controllers
│   ├── models/        # Mongoose models
│   ├── middleware/    # Express middleware
│   ├── socket/        # Socket.io handlers
│   └── index.ts       # Server entry point
```

## License

ISC

