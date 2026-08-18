const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('./config/auth');
require('dotenv').config();

const datosRoutes = require('./routes/datos');
const authRoutes = require('./routes/auth');
const solicitudesRoutes = require('./routes/solicitudes');
const archivosRoutes = require('./routes/archivos');
const inspeccionesRoutes = require('./routes/inspecciones');
const fotosRouter = require('./routes/fotos');
const informesRouter = require('./routes/informes');
const tiposInspeccionRoutes = require('./routes/tiposInspeccion');
const usuariosRouter = require('./routes/usuarios');

process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException:', err.message, err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 unhandledRejection:', reason);
});

const app = express();
const PORT = process.env.PORT || 3001;

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
    oracle:            !!process.env.ORACLE_ORDS_URL && !!process.env.ORACLE_USER && !!process.env.ORACLE_PASSWORD,
    jwt:               !!process.env.JWT_SECRET,
    session:           !!process.env.SESSION_SECRET,
    frontend_url:      !!process.env.FRONTEND_URL,
    // azure_ad: deshabilitado temporalmente — ver spec 02-azure-ad-login.md
    // azure_ad:          !!(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_TENANT_ID),
    flow_solicitudes:  !!process.env.FLOW_SOLICITUD_READ_ALL_URL,
    flow_inspecciones: !!process.env.FLOW_INSPECCIONES_CREAR_URL,
    flow_archivos:     !!process.env.FLOW_ARCHIVOS_LISTAR_URL,
    flow_subir_archivos: !!process.env.FLOW_SUBIR_ARCHIVOS_URL,
    flow_tipos:        !!process.env.FLOW_TIPOS_INSPECCION_URL,
    flow_usuarios:     !!process.env.FLOW_USUARIOS_URL,
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
app.use('/api/datos', datosRoutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/archivos', archivosRoutes);
app.use('/api/inspecciones', inspeccionesRoutes);
app.use('/api/fotos', fotosRouter);
app.use('/api/informes', informesRouter);
app.use('/api/tipos-inspeccion', tiposInspeccionRoutes);
app.use('/api/usuarios', usuariosRouter);

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
  console.log(`  ✓ Oracle ORDS URL:    ${process.env.ORACLE_ORDS_URL        ? '✅' : '❌ NO CONFIGURADO'}`);
  console.log(`  ✓ Oracle User:        ${process.env.ORACLE_USER            ? '✅' : '❌ NO CONFIGURADO'}`);
  console.log(`  ✓ Oracle Password:    ${process.env.ORACLE_PASSWORD        ? '✅' : '❌ NO CONFIGURADO'}`);
  console.log(`  ✓ JWT Secret:         ${process.env.JWT_SECRET             ? '✅' : '❌ NO CONFIGURADO'}`);
  console.log(`  ✓ Session Secret:     ${process.env.SESSION_SECRET         ? '✅' : '❌ NO CONFIGURADO'}`);
  console.log(`  ✓ Frontend URL:       ${process.env.FRONTEND_URL           ? `✅ ${process.env.FRONTEND_URL}` : '⚠️  Solo localhost'}`);
  // Azure AD deshabilitado temporalmente — ver spec 02-azure-ad-login.md
  // console.log(`  ✓ Azure AD:           ${process.env.AZURE_AD_CLIENT_ID     ? '✅' : '⚠️  No configurado (solo login local)'}`);
  console.log(separator);
  console.log('  Flows Power Automate:');
  console.log(`  ✓ Solicitudes:        ${process.env.FLOW_SOLICITUD_READ_ALL_URL  ? '✅' : '❌'}`);
  console.log(`  ✓ Inspecciones:       ${process.env.FLOW_INSPECCIONES_CREAR_URL  ? '✅' : '❌'}`);
  console.log(`  ✓ Archivos:           ${process.env.FLOW_ARCHIVOS_LISTAR_URL     ? '✅' : '❌'}`);
  console.log(`  ✓ Subir archivos:     ${process.env.FLOW_SUBIR_ARCHIVOS_URL      ? '✅' : '❌'}`);
  console.log(`  ✓ Fotos listar:       ${process.env.FLOW_FOTOS_LISTAR_URL        ? '✅' : '❌'}`);
  console.log(`  ✓ Fotos contenido:    ${process.env.FLOW_FOTOS_CONTENIDO_URL     ? '✅' : '❌'}`);
  console.log(`  ✓ Tipos inspección:   ${process.env.FLOW_TIPOS_INSPECCION_URL    ? '✅' : '❌'}`);
  console.log(`  ✓ Usuarios:           ${process.env.FLOW_USUARIOS_URL            ? '✅' : '❌'}`);
  console.log(separator);
});