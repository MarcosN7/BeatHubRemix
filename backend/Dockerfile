FROM node:18-alpine

WORKDIR /app

# Install dependencies for Prisma and native extensions
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./
COPY database ./database/

# Copy application source
COPY backend ./backend/

# Install dependencies
RUN npm install

# Generate Prisma client
RUN cd database && npx prisma generate

WORKDIR /app/backend

# Expose API port
EXPOSE 4000

# Start development server (for dev environment) or compiled index
CMD ["npm", "run", "dev"]
