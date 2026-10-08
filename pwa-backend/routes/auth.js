const express = require('express');
const router = express.Router();
const passport = require('../config/auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const usersDb = require('../database');
const { limitarLogin } = require('../middleware/limitarLogin');

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

// Azure AD deshabilitado temporalmente — ver spec 02-azure-ad-login.md
// const ensureAzureConfigured = (req, res, next) => {
//   if (passport.isAzureConfigured) {
//     return next();
//   }
//
//   return res.status(503).json({
//     success: false,
//     error: 'Login Microsoft/Azure no configurado',
//     message: 'Faltan AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID o AZURE_AD_REDIRECT_URI. El login local sigue disponible.',
//   });
// };

// ========================================
// LOGIN LOCAL (usuario/contraseña)
// ========================================
router.post('/login/local', limitarLogin, (req, res, next) => {
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
        auth_type: user.auth_type,
        debeCambiarPassword: !!user.debe_cambiar_password,
      }
    });
  })(req, res, next);
});

// ========================================
// LOGIN MICROSOFT — deshabilitado temporalmente, ver spec 02-azure-ad-login.md
// ========================================
// router.get('/login/microsoft',
//   ensureAzureConfigured,
//   passport.authenticate('azure', {
//     failureRedirect: '/auth/login/failed'
//   })
// );
//
// router.post('/microsoft/callback',
//   ensureAzureConfigured,
//   passport.authenticate('azure', {
//     failureRedirect: '/auth/login/failed',
//     session: false
//   }),
//   (req, res) => {
//     const token = generateToken(req.user);
//
//     // Redireccionar al frontend con el token
//     res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
//   }
// );

// ========================================
// REGISTRO — eliminado a propósito (hallazgo de seguridad H-01)
// Las cuentas NO se crean desde esta API: la API del cliente autoriza por el correo del token que firmamos
// nosotros, así que un registro público permitiría suplantar a alguien que aún no tiene cuenta.
// Solo se crean usuarios por ORDS (POST /usuarios-actions/register, client AYP_INTEGRACION_EXTERNA), a cargo del jefe de proyecto.
// ========================================

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

    const { password, activo, created_at: createdAt, debe_cambiar_password, ...safeUser } = user;
    res.json({ success: true, user: { ...safeUser, debeCambiarPassword: !!debe_cambiar_password } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// CAMBIAR CONTRASEÑA (usuario propio)
// ========================================
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    if (req.user.auth_type !== 'local') {
      return res.status(400).json({
        success: false,
        error: 'Los usuarios Microsoft no tienen contraseña local que cambiar',
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'currentPassword y newPassword son requeridos',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'La nueva contraseña debe tener al menos 8 caracteres',
      });
    }

    const user = await usersDb.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Contraseña actual incorrecta' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await usersDb.updateUserPassword(user.id, hashedPassword);

    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// RESETEAR CONTRASEÑA DE OTRO USUARIO (solo admin)
// ========================================
router.post('/admin/reset-password/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ success: false, error: 'Requiere rol admin' });
    }

    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ success: false, error: 'newPassword es requerido' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'La nueva contraseña debe tener al menos 8 caracteres',
      });
    }

    const targetUser = await usersDb.getUserById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // resetUserPassword (no updateUserPassword): además de la contraseña,
    // vuelve a activar debe_cambiar_password — el usuario deberá cambiarla
    // en su próximo login, ya que esta se la asignó el admin, no él mismo.
    await usersDb.resetUserPassword(targetUser.id, hashedPassword);

    res.json({ success: true, message: `Contraseña de ${targetUser.email} restablecida correctamente` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// LOGOUT (simplificado - solo para info)
// ========================================
router.post('/logout', verifyToken, async (req, res) => {
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