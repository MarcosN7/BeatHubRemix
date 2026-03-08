FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# In a real production environment this would be served via Nginx.
# For this dev/demo architecture, we'll expose the Vite dev server.
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
