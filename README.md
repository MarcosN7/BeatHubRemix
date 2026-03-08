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

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
