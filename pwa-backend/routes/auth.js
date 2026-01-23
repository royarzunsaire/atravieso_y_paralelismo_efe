const express = require('express');
const router = express.Router();
const passport = require('../config/auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../database');

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

// ========================================
// LOGIN LOCAL (usuario/contraseña)
// ========================================
router.post('/login/local', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!user) {
      return res.status(401).json({ success: false, error: info.message || 'Credenciales inválidas' });
    }

    const token = generateToken(user);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        auth_type: user.auth_type
      }
    });
  })(req, res, next);
});

// ========================================
// LOGIN MICROSOFT
// ========================================
router.get('/login/microsoft', 
  passport.authenticate('azure', { 
    failureRedirect: '/auth/login/failed' 
  })
);

router.post('/microsoft/callback',
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
    db.get('SELECT id FROM usuarios WHERE email = ?', [email], async (err, existing) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      if (existing) {
        return res.status(409).json({ 
          success: false, 
          error: 'El email ya está registrado' 
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insertar usuario
      const sql = `
        INSERT INTO usuarios (email, password, nombre, auth_type, rol)
        VALUES (?, ?, ?, 'local', 'usuario')
      `;
      
      db.run(sql, [email, hashedPassword, nombre], function(err) {
        if (err) {
          return res.status(500).json({ success: false, error: err.message });
        }

        const user = {
          id: this.lastID,
          email,
          nombre,
          rol: 'usuario',
          auth_type: 'local'
        };

        const token = generateToken(user);

        res.status(201).json({
          success: true,
          token,
          user
        });
      });
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
router.get('/me', verifyToken, (req, res) => {
  db.get('SELECT id, email, nombre, rol, auth_type, last_login FROM usuarios WHERE id = ?', 
    [req.user.id], 
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      }
      res.json({ success: true, user });
    }
  );
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