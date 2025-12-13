FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 5173

# Start dev server (for production, use a proper server like nginx)
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]








