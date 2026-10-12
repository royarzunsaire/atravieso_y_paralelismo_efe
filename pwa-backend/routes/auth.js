const express = require('express');
const router = express.Router();
const passport = require('../config/auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validarPasswordNueva } = require('../utils/politicaPassword');

// Costo de bcrypt para contraseñas NUEVAS (H-19). Los hashes existentes (costo 10) siguen validando: el costo va dentro del hash.
const BCRYPT_COSTO = 12;
const usersDb = require('../database');
const { limitarLogin } = require('../middleware/limitarLogin');
const { sesion } = require('../middleware/sesion');

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
    { algorithm: 'HS256', expiresIn: '7d' } // 7 días
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
  // Validación de entrada (H-10): deben ser textos razonables; un objeto/arreglo/número no llega a Oracle ni a bcrypt.
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password || email.length > 254 || password.length > 200) {
    return res.status(400).json({ success: false, error: 'DATOS_INVALIDOS', message: 'Ingresa tu correo y tu contraseña.' });
  }
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error('❌ Error en el login:', err.message);
      return res.status(500).json({ success: false, error: 'ERROR_INTERNO', message: 'No se pudo iniciar sesión. Inténtalo de nuevo en unos minutos.' });
    }
    if (!user) {
      return res.status(401).json({ success: false, error: info?.message || 'Correo o contraseña incorrectos. Si el problema continúa, contacta al administrador.' });
    }

    // Acaba de comprobarse en Oracle que la cuenta está activa: se descarta lo que la caché recordaba (p. ej. una baja anterior).
    sesion.olvidar(user.id);

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
//     // ⚠️ SEGURIDAD (H-09): NO reactivar este redirect tal cual. Un token en la URL queda en el historial, en los logs y en el
//     // Referer, y la pantalla que lo recibía permitía iniciar la sesión de la víctima en la cuenta de un atacante (se eliminó).
//     // Al retomar Azure AD: intercambiar un código de un solo uso por POST, o entregar el token en el fragmento (#), y validar `state`.
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
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    // Algoritmo fijado: nunca se acepta otro que el de emisión (H-08).
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado. Por favor, inicia sesión nuevamente.'
      });
    }
    return res.status(401).json({ success: false, error: 'Token inválido' });
  }

  // H-08: la firma no basta. (1) «Cerrar sesión» invalida el token en el servidor.
  if (sesion.estaRevocado(token)) {
    return res.status(401).json({ success: false, error: 'Sesión cerrada. Por favor, inicia sesión nuevamente.' });
  }
  // (2) Un usuario dado de baja (usuarios.activo = 0) o eliminado pierde la sesión en menos de un minuto (caché de 60 s).
  if (decoded.id && decoded.auth_type !== 'microsoft' && !(await sesion.cuentaActiva(decoded.id))) {
    return res.status(401).json({ success: false, error: 'Tu cuenta ya no está activa. Contacta al administrador.' });
  }

  req.user = decoded;
  next();
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
    console.error('❌ Error en /auth:', error.message);
    res.status(500).json({ success: false, error: 'ERROR_INTERNO', message: 'No se pudo completar la operación. Inténtalo de nuevo en unos minutos.' });
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

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'currentPassword y newPassword son requeridos',
      });
    }

    const problemaPassword = validarPasswordNueva(newPassword);
    if (problemaPassword) {
      return res.status(400).json({ success: false, error: 'PASSWORD_NO_VALIDA', message: problemaPassword });
    }

    const user = await usersDb.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Contraseña actual incorrecta' });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ success: false, error: 'PASSWORD_NO_VALIDA', message: 'La nueva contraseña debe ser distinta de la actual.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_COSTO);
    await usersDb.updateUserPassword(user.id, hashedPassword);

    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('❌ Error en /auth:', error.message);
    res.status(500).json({ success: false, error: 'ERROR_INTERNO', message: 'No se pudo completar la operación. Inténtalo de nuevo en unos minutos.' });
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

    if (typeof newPassword !== 'string' || !newPassword) {
      return res.status(400).json({ success: false, error: 'newPassword es requerido' });
    }

    const problemaPassword = validarPasswordNueva(newPassword);
    if (problemaPassword) {
      return res.status(400).json({ success: false, error: 'PASSWORD_NO_VALIDA', message: problemaPassword });
    }

    const targetUser = await usersDb.getUserById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_COSTO);
    // resetUserPassword (no updateUserPassword): además de la contraseña,
    // vuelve a activar debe_cambiar_password — el usuario deberá cambiarla
    // en su próximo login, ya que esta se la asignó el admin, no él mismo.
    await usersDb.resetUserPassword(targetUser.id, hashedPassword);

    res.json({ success: true, message: `Contraseña de ${targetUser.email} restablecida correctamente` });
  } catch (error) {
    console.error('❌ Error en /auth:', error.message);
    res.status(500).json({ success: false, error: 'ERROR_INTERNO', message: 'No se pudo completar la operación. Inténtalo de nuevo en unos minutos.' });
  }
});

// ========================================
// LOGOUT (invalida el token en el servidor)
// ========================================
router.post('/logout', verifyToken, async (req, res) => {
  // H-08: además de borrar el token del navegador, se invalida en el servidor hasta que venza.
  sesion.revocar(req.headers.authorization.split(' ')[1], req.user.exp);
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