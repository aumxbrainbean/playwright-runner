# ✅ Use the official Playwright image (includes Chromium, Firefox, WebKit)
FROM mcr.microsoft.com/playwright:v1.47.0-focal

# Set working directory
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy the rest of your project
COPY . .

# Expose Render's port
ENV PORT=3000

# Start your app
CMD ["npm", "start"]
