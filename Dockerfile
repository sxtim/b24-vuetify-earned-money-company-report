# 1. Base image for installing all dependencies
FROM node:18-alpine AS base
WORKDIR /app

# Copy all package.json files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies
RUN npm install
RUN npm install --prefix backend
RUN npm install --prefix frontend

# 2. Builder image
FROM base AS builder
WORKDIR /app

# Copy the entire source code
COPY . .

# Run the build script from the backend package
# This script builds both frontend and backend and places them in /app/dist
RUN npm run build --prefix backend

# 3. Final image for production
FROM node:18-alpine AS final
WORKDIR /app

# Copy the production build from the builder stage
COPY --from=builder /app/dist .

# Install production dependencies
RUN npm install --omit=dev

# Expose the port the server is running on
EXPOSE 3000

# The command to start the production server
CMD [ "npm", "start" ]

# Expose ports for backend and frontend dev server
EXPOSE 3000
EXPOSE 5173

# The command to run both services
CMD [ "npm", "run", "dev" ]

# The command to run the app will be provided by docker-compose or a direct docker run command
# For development, this is typically `npm run dev`
# For production, this would be `npm start` after building 