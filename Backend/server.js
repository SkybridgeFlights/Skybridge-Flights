require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');

const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

/* ------------------------------------------------------------------
 * CORS configuration
 * ------------------------------------------------------------------ */
const defaultAllowedOrigins = [
  'https://skybridgeflights.com',
  'https://www.skybridgeflights.com',
  'http://localhost:3000',
];

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : defaultAllowedOrigins;

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* ------------------------------------------------------------------
 * Global Middlewares
 * ------------------------------------------------------------------ */
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(morgan('dev'));
app.use(express.json());
app.use('/api/refunds/webhook', bodyParser.raw({ type: '*/*' }));

app.set('trust proxy', 1);

/* ------------------------------------------------------------------
 * Routes
 * ------------------------------------------------------------------ */
app.get('/', (req, res) => {
  res.send('Skybridge Flights API is running...');
});

app.use('/api/users', require('./routes/userRoutes'));   // ✅ مهم جداً
app.use('/api/flights', require('./routes/flightRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/visa', require('./routes/visaRoutes'));
app.use('/api/staff', require('./routes/staffRoutes'));
app.use('/api/refunds', require('./routes/refundRoutes'));

/* ------------------------------------------------------------------
 * 404 & Error Handlers
 * ------------------------------------------------------------------ */
app.use(notFound);
app.use(errorHandler);

/* ------------------------------------------------------------------
 * MongoDB Connection
 * ------------------------------------------------------------------ */
const { MONGO_URI, PORT = 5000 } = process.env;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in environment variables.');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

/* ------------------------------------------------------------------
 * Start Server
 * ------------------------------------------------------------------ */
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log('✅ Allowed CORS origins:', allowedOrigins);
});