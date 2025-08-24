FROM node:22

WORKDIR /sociair-chat-app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .


RUN npm run build

# Expose the port your Node app listens to
EXPOSE 3000

# Start app using PM2
CMD ["npm", "run", "start"]

