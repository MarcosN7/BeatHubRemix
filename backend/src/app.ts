import express, { Application } from 'express';
import cors, { CorsOptions } from 'cors';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import roomRoutes from './routes/room.routes';
import youtubeRoutes from './routes/youtube.routes';

const app: Application = express();

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowed = process.env.FRONTEND_URL?.replace(/\/$/, '');

    // ADD THIS TEMPORARILY
    console.log('FRONTEND_URL env:', allowed);
    console.log('Incoming origin:', origin);

    if (!origin || origin === allowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// ✅ Preflight must come FIRST, before body parsers and routes
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  console.log('Origin:', req.headers.origin);
  next();
});

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/youtube', youtubeRoutes);

export default app;
