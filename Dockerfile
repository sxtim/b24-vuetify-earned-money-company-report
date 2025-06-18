# 1. Base image for development
FROM node:18-alpine as development

# Set the working directory in the container
WORKDIR /app

# Install dependencies for all workspaces
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm install

# Install backend dependencies
RUN npm install --prefix backend

# Install frontend dependencies
RUN npm install --prefix frontend

# Copy all the source code
COPY . .

# Build the application for production
RUN npm run build --prefix backend

# Expose ports for backend and frontend dev server
EXPOSE 3000
EXPOSE 5173

# The command to run both services
CMD [ "npm", "run", "dev" ]

# The command to run the app will be provided by docker-compose or a direct docker run command
# For development, this is typically `npm run dev`
# For production, this would be `npm start` after building 