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
const tiposInspeccionRoutes = require('./routes/tiposInspeccion');
const usuariosRouter = require('./routes/usuarios');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));
//app.use(cors());

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // true en producción con HTTPS
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: '✓ API funcionando',
    status: 'online'
  });
});

app.use('/auth', authRoutes);
app.use('/api/datos', datosRoutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/archivos', archivosRoutes);
app.use('/api/inspecciones', inspeccionesRoutes);
app.use('/api/fotos', fotosRouter);
app.use('/api/tipos-inspeccion', tiposInspeccionRoutes);
app.use('/api/usuarios', usuariosRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log(`✓ Servidor en puerto ${PORT}`);
  console.log(`✓ Flow CREATE: ${process.env.FLOW_CREATE_URL ? 'Configurado' : '❌ NO'}`);
  console.log(`✓ Flow ARCHIVOS: ${process.env.FLOW_ARCHIVOS_LISTAR_URL ? 'Configurado' : '❌ NO'}`);
  console.log(`✓ Flow INSPECCIONES: ${process.env.FLOW_INSPECCIONES_CREAR_URL ? 'Configurado' : '❌ NO'}`);
  console.log(`✓ Flow Tipos de INSPECCION: ${process.env.FLOW_TIPOS_INSPECCION_URL ? 'Configurado' : '❌ NO'}`);
  console.log(`✓ Auth Microsoft: ${process.env.AZURE_AD_CLIENT_ID ? 'Configurado' : '❌ NO'}`);
  console.log(`✓ JWT Secret: ${process.env.JWT_SECRET ? 'Configurado' : '❌ NO'}`);
  console.log('='.repeat(50));
});
