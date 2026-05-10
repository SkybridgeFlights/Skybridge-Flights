require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { init: initIO } = require('./realtime/io');
const { startBlogScheduler } = require('./services/blogScheduler');
const { startBlogQueueWorker } = require('./services/blogQueueService');
const { startFlightAlertWorker } = require('./services/flightAlertWorker');
const { getSitemap, getRobots } = require('./controllers/blogController');

const app = express();

/* CORS */
const defaultAllowedOrigins = [
  'https://skybridgeflights.com',
  'https://www.skybridgeflights.com',
  'http://localhost:3000',
  'http://localhost:3001',
];

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : defaultAllowedOrigins;

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }

    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* Security & logs */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(morgan('dev'));

/* Parsers */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

/* Static uploads */
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

/* Health check */
app.get('/', (_req, res) => {
  res.send('Skybridge Flights API is running...');
});

app.get('/sitemap.xml', getSitemap);
app.get('/robots.txt', getRobots);

/* Core routes */
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/flights', require('./routes/flightRoutes'));
app.use('/api/flight-tracker', require('./routes/flightTrackerRoutes'));
app.use('/api/flight-alerts', require('./routes/flightAlertRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/staff', require('./routes/staffRoutes'));
app.use('/api/admin/users', require('./routes/userAdminRoutes'));
app.use('/api/settings', require('./routes/SettingsRoutes'));
app.use('/api/redirect', require('./routes/redirectRoutes'));
app.use('/api/admin/flight-alerts', require('./routes/flightAlertAdminRoutes'));
app.use('/api/admin/analytics', require('./routes/adminAnalyticsRoutes'));
app.use('/api/blog', require('./routes/blogRoutes'));
app.use('/api/admin', require('./routes/adminStatsRoutes'));
app.use('/api/support', require('./routes/supportRoutes'));

/* Errors */
app.use(notFound);
app.use(errorHandler);

/* ENV */
const MONGO_URI = process.env.MONGO_URI;
const PORT = Number(process.env.PORT) || 5000;

if (!MONGO_URI) {
  console.error('MONGO_URI is not defined');
  process.exit(1);
}

/* DB */
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');

    startBlogScheduler();
    startBlogQueueWorker();
    startFlightAlertWorker();
  })
  .catch((err) => {
    console.error('Mongo error:', err);
    process.exit(1);
  });

/* HTTP + Socket.IO */
const server = http.createServer(app);

initIO(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }

      return cb(new Error(`WS Not allowed by CORS: ${origin}`));
    },

    credentials: true,
    methods: ['GET', 'POST'],
  },
});

/* START SERVER */
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on port ${PORT}`);
  console.log('Allowed CORS origins:', allowedOrigins);
});