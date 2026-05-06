const express = require('express');
const router = express.Router();
const passport = require('../config/auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const usersDb = require('../database');

// ========================================
// GENERAR TOKEN JWT (simplificado)
// ========================================
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      nombre: user.nombre,
      rol: user.rol,
      auth_type: user.auth_type
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' } // 7 días
  );
};

const ensureAzureConfigured = (req, res, next) => {
  if (passport.isAzureConfigured) {
    return next();
  }

  return res.status(503).json({
    success: false,
    error: 'Login Microsoft/Azure no configurado',
    message: 'Faltan AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID o AZURE_AD_REDIRECT_URI. El login local con Supabase sigue disponible.',
  });
};

// ========================================
// LOGIN LOCAL (usuario/contraseña)
// ========================================
router.post('/login/local', (req, res, next) => {
  passport.authenticate('local', async (err, user, info) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!user) {
      return res.status(401).json({ success: false, error: info.message || 'Credenciales inválidas' });
    }

    try {
      const supabaseSession = await usersDb.signInLocalAuthUser({
        email: req.body.email,
        password: req.body.password,
      });

      const token = generateToken(user);
      const connectionToken = supabaseSession?.access_token;

      res.json({
        success: true,
        token,
        connection_token: connectionToken,
        supabase_token: connectionToken,
        supabase_session: supabaseSession,
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          rol: user.rol,
          auth_type: user.auth_type
        }
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'No se pudo obtener token de conexión de Supabase para el usuario local',
        message: error.message,
      });
    }
  })(req, res, next);
});

// ========================================
// LOGIN MICROSOFT
// ========================================
router.get('/login/microsoft',
  ensureAzureConfigured,
  passport.authenticate('azure', { 
    failureRedirect: '/auth/login/failed' 
  })
);

router.post('/microsoft/callback',
  ensureAzureConfigured,
  passport.authenticate('azure', { 
    failureRedirect: '/auth/login/failed',
    session: false 
  }),
  (req, res) => {
    const token = generateToken(req.user);
    
    // Redireccionar al frontend con el token
    res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
  }
);

// ========================================
// REGISTRO LOCAL
// ========================================
router.post('/register', async (req, res) => {
  try {
    const { email, password, nombre } = req.body;

    // Validaciones
    if (!email || !password || !nombre) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, contraseña y nombre son requeridos' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email inválido' 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'La contraseña debe tener al menos 8 caracteres' 
      });
    }

    // Verificar si existe
    const existing = await usersDb.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'El email ya está registrado'
      });
    }

    // Crear credenciales en Supabase Auth para obtener token de conexión
    await usersDb.createLocalAuthUser({
      email,
      password,
      nombre,
    });

    // Hash password para mantener el perfil local de la aplicación
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar perfil local en Supabase
    const createdUser = await usersDb.createLocalUser({
      email,
      password: hashedPassword,
      nombre,
    });

    const user = {
      id: createdUser.id,
      email: createdUser.email,
      nombre: createdUser.nombre,
      rol: createdUser.rol,
      auth_type: createdUser.auth_type
    };

    const supabaseSession = await usersDb.signInLocalAuthUser({ email, password });
    const token = generateToken(user);
    const connectionToken = supabaseSession?.access_token;

    res.status(201).json({
      success: true,
      token,
      connection_token: connectionToken,
      supabase_token: connectionToken,
      supabase_session: supabaseSession,
      user
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// MIDDLEWARE - Verificar Token
// ========================================
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token expirado. Por favor, inicia sesión nuevamente.' 
      });
    }
    res.status(401).json({ success: false, error: 'Token inválido' });
  }
};

// ========================================
// INFO USUARIO ACTUAL
// ========================================
router.get('/me', verifyToken, async (req, res) => {
  try {

    if (req.user.auth_type === 'microsoft') {
      return res.json({
        success: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          nombre: req.user.nombre,
          rol: req.user.rol,
          auth_type: req.user.auth_type,
        },
      });
    }

    const user = await usersDb.getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const { password, activo, created_at: createdAt, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// LOGOUT (simplificado - solo para info)
// ========================================
router.post('/logout', verifyToken, (req, res) => {
  // En este caso, el logout se maneja en el frontend borrando el token
  res.json({ success: true, message: 'Sesión cerrada correctamente' });
});

// Fallo de autenticación
router.get('/login/failed', (req, res) => {
  res.status(401).json({ 
    success: false, 
    error: 'Autenticación fallida' 
  });
});

module.exports = router;
module.exports.verifyToken = verifyToken;