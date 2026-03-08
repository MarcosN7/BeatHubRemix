# 🎧 BeatHubREMIX

**Real-time Collaborative Music Rooms for the Modern Web.**

BeatHubREMIX is an open-source, full-stack application that allows users to create synchronized rooms to listen to music together. Built with a focus on real-time interaction, performance, and a sleek retro-terminal aesthetic.

---

## 🚀 Key Features

- **Synced Music Playback**: High-fidelity YouTube synchronized playback across all participants.
- **Real-time Interaction**: Instant room updates, chat, and user presence powered by Socket.io and Redis.
- **Collaborative Queue**: Anyone can suggest songs; voting and host controls manage the flow.
- **Skip System**: Support for host-initiated "Force Skip" and decentralized "Vote Skip" sequences.
- **Full Auth Suite**: Secure JWT-based authentication, including a robust Forgot/Reset password flow via Resend.
- **Retro Aesthetic**: A unique, terminal-inspired UI that feels premium and responsive.

## 🛠 Tech Stack

### Frontend
- **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Styling**: [TailwindCSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Real-time**: [Socket.io-client](https://socket.io/docs/v4/client-api/)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Server**: [Express](https://expressjs.com/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Real-time/Presence**: [Socket.io](https://socket.io/) + [Redis](https://redis.io/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **Email Delivery**: [Resend](https://resend.com/)

---

## 📂 Project Structure

```text
BeatHubREMIX/
├── frontend/          # React + Vite application
├── backend/           # Node.js + Express API server
├── database/          # Prisma schema and migrations
└── docker/            # Optional containerization config
```

---

## 🚦 Getting Started

### 1. Prerequisites
- Node.js (v20+)
- PostgreSQL
- Redis
- A [Resend](https://resend.com) API Key (for emails)

### 2. Environment Setup
Create a `.env` file in the `backend/` directory:

```env
PORT=4000
DATABASE_URL="postgresql://user:pass@localhost:5432/beathub_db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your_secret_key"
YOUTUBE_API_KEY="your_youtube_key"
RESEND_API_KEY="your_resend_key"
FRONTEND_URL="http://localhost:5173"
```

### 3. Installation
From the root directory:

```bash
# Install root dependencies
npm install

# Initialize Database (if using local PG)
cd database
npx prisma generate
npx prisma db push
```

### 4. Running the App
Open two terminals:

**Terminal 1 (Backend)**:
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend)**:
```bash
cd frontend
npm run dev
```

---

## ⚙️ Development & Good Practices

- **Strict Typing**: TypeScript is enforced across both frontend and backend.
- **Validation**: Data integrity is handled via [Zod](https://zod.dev/) schemas.
- **Security**: Raw tokens (like password resets) are never stored; only one-way salts/hashes are persisted.
- **Real-time Precision**: Drift correction logic ensures all users stay within milliseconds of each other.

---

## ☁️ Deployment (Vercel + Render + Supabase)

This repo works well with:
- **Frontend:** Vercel
- **Backend:** Render (Web Service)
- **Database:** Supabase (PostgreSQL)

### 1. Create Supabase database
1. Create a Supabase project.
2. Go to **Project Settings → Database** and copy the connection string.
3. Use the **Direct connection** URL for `DATABASE_URL` on Render.

> Tip: Prisma needs a standard Postgres connection string, for example:
> `postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?schema=public`

### 2. Deploy backend on Render
1. In Render, create a **Web Service** from this repository.
2. Use the provided `render.yaml` blueprint (recommended), or manually set:
   - **Build command:** `npm install && npm run build --workspace=@beathub/database && npm run build --workspace=@beathub/backend`
   - **Start command:** `npm run start --workspace=@beathub/backend`
   - The database workspace build only runs `prisma generate` (it does not attempt a DB connection during Render build).
3. Configure env vars in Render:
   - `DATABASE_URL` = Supabase Postgres URL
   - `REDIS_URL` = your Redis instance URL
   - `JWT_SECRET` = strong random secret
   - `FRONTEND_URL` = your Vercel URL(s), comma-separated if multiple
   - `YOUTUBE_API_KEY` = YouTube Data API key
   - `RESEND_API_KEY` = Resend key (if using email flows)
   - `PORT` = `4000`

### 2.1 Apply schema to Supabase
After first deploy (or schema changes), run Prisma push from a shell where `DATABASE_URL` points to Supabase:

```bash
npm run db:push --workspace=@beathub/database
```

### 3. Configure frontend on Vercel
In your Vercel project, add:

```env
VITE_API_URL="https://<your-render-service>.onrender.com/api"
VITE_SOCKET_URL="https://<your-render-service>.onrender.com"
```

Redeploy the frontend after adding/changing env vars.

### 4. CORS and sockets
Set `FRONTEND_URL` on Render to your Vercel origin(s). Multiple origins are supported via comma-separated values, for example:

```env
FRONTEND_URL="https://beathubremix.vercel.app,https://beathubremix-git-main-yourteam.vercel.app"
```

This value is used by both Express CORS and Socket.io CORS.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
