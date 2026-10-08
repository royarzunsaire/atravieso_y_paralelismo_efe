const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('./config/auth');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const eventosRouter = require('./routes/eventos');
const { startSyncJob } = require('./syncJob');

process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException:', err.message, err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 unhandledRejection:', reason);
});

const app = express();
const PORT = process.env.PORT || 3001;

// Cuántos proxies de confianza hay delante (nginx del contenedor, balanceador de OCI…). Necesario para ver la IP REAL del
// usuario (límite de intentos de login, H-03). 0 = sin proxy (desarrollo). Docker compose: 1 (nginx). OCI: nginx + balanceador
// = 2 (confirmar con quien arma la infraestructura). Un valor mal puesto hace que todos parezcan tener la misma IP.
const confianzaProxy = Number.parseInt(process.env.TRUST_PROXY ?? '0', 10);
app.set('trust proxy', Number.isInteger(confianzaProxy) && confianzaProxy >= 0 ? confianzaProxy : 0);

// ========================================
// CORS
// ========================================
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173', // vite preview
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (Postman, mobile, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`⚠️  CORS bloqueado para origin: ${origin}`);
    callback(new Error(`CORS: origen no permitido → ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Version'],
}));

// ========================================
// MIDDLEWARES
// ========================================
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS en producción
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
  }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// ========================================
// LOGGER DE REQUESTS (solo desarrollo)
// ========================================
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`→ ${req.method} ${req.path}`);
    next();
  });
}

// ========================================
// HEALTH CHECK
// ========================================
app.get('/', (req, res) => {
  res.json({
    message: '✓ API funcionando',
    status: 'online',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  const checks = {
    oracle:            !!process.env.ORACLE_ORDS_URL && !!process.env.ORACLE_ORDS_CLIENT_ID && !!process.env.ORACLE_ORDS_CLIENT_SECRET,
    jwt:               !!process.env.JWT_SECRET,
    session:           !!process.env.SESSION_SECRET,
    frontend_url:      !!process.env.FRONTEND_URL,
    sharepoint_api:    !!(process.env.SHAREPOINT_API_URL && process.env.SHAREPOINT_API_SECRET),
    // azure_ad: deshabilitado temporalmente — ver spec 02-azure-ad-login.md
    // azure_ad:          !!(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_TENANT_ID),
  };

  const allCriticalOk = checks.oracle && checks.jwt && checks.session;
  const status = allCriticalOk ? 'ok' : 'degraded';

  res.status(allCriticalOk ? 200 : 207).json({
    status,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// ========================================
// ROUTES
// ========================================
app.use('/auth', authRoutes);
app.use('/api/v2', eventosRouter);

// ========================================
// 404
// ========================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Ruta no encontrada: ${req.method} ${req.path}`,
  });
});

// ========================================
// ERROR HANDLER GLOBAL
// ========================================
app.use((err, req, res, next) => {
  console.error('❌ Error no controlado:', err.message);

  if (err.message?.includes('CORS')) {
    return res.status(403).json({ success: false, error: err.message });
  }

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message,
  });
});

// ========================================
// INICIO DEL SERVIDOR
// ========================================
app.listen(PORT, '0.0.0.0', () => {
  const separator = '═'.repeat(50);
  console.log(separator);
  console.log(`  Sistema AyP — Backend`);
  console.log(separator);
  console.log(`  Entorno:      ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Puerto:       ${PORT}`);
  console.log(separator);
  console.log('  Variables de entorno:');
  console.log(`  ✓ Oracle ORDS URL:    ${process.env.ORACLE_ORDS_URL          ? '✅' : '❌ NO CONFIGURADO'}`);
  console.log(`  ✓ Oracle Client ID:   ${process.env.ORACLE_ORDS_CLIENT_ID     ? '✅' : '❌ NO CONFIGURADO'}`);
  console.log(`  ✓ Oracle Client Secret: ${process.env.ORACLE_ORDS_CLIENT_SECRET ? '✅' : '❌ NO CONFIGURADO'}`);
  console.log(`  ✓ JWT Secret:         ${process.env.JWT_SECRET             ? '✅' : '❌ NO CONFIGURADO'}`);
  console.log(`  ✓ Session Secret:     ${process.env.SESSION_SECRET         ? '✅' : '❌ NO CONFIGURADO'}`);
  console.log(`  ✓ Frontend URL:       ${process.env.FRONTEND_URL           ? `✅ ${process.env.FRONTEND_URL}` : '⚠️  Solo localhost'}`);
  // Azure AD deshabilitado temporalmente — ver spec 02-azure-ad-login.md
  // console.log(`  ✓ Azure AD:           ${process.env.AZURE_AD_CLIENT_ID     ? '✅' : '⚠️  No configurado (solo login local)'}`);
  console.log(separator);
  console.log('  API del cliente (SharePoint):');
  console.log(`  ✓ URL:               ${process.env.SHAREPOINT_API_URL    ? '✅' : '❌ NO CONFIGURADO'}`);
  console.log(`  ✓ Secreto JWT:       ${process.env.SHAREPOINT_API_SECRET ? '✅' : '❌ NO CONFIGURADO'}`);
  console.log(separator);

  startSyncJob();
});