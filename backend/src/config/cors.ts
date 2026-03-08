const rawAllowedOrigins = process.env.FRONTEND_URL || 'http://localhost:5173';

export const allowedOrigins = rawAllowedOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const corsOriginValidator = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  if (!origin) {
    // Allow non-browser and same-origin requests.
    return callback(null, true);
  }

  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`CORS blocked for origin: ${origin}`));
};

