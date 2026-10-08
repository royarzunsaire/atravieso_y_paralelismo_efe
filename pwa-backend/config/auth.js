const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const usersDb = require('../database');
const { randomUUID } = require('crypto');

// Seguridad (hallazgo H-06): el login NO debe revelar si un correo existe. Para eso (1) se responde SIEMPRE el mismo mensaje,
// sea porque el correo no existe, está dado de baja o la contraseña es incorrecta, y (2) cuando el correo no existe se compara
// igual contra un hash falso del mismo costo que los reales, para que el tiempo de respuesta no delate la diferencia.
const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos. Si el problema continúa, contacta al administrador.';
const HASH_FALSO = bcrypt.hashSync(randomUUID(), 10);

const isAzureConfigured = Boolean(
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_CLIENT_SECRET &&
  process.env.AZURE_AD_TENANT_ID &&
  process.env.AZURE_AD_REDIRECT_URI
);

// ========================================
// Azure AD deshabilitado temporalmente — ver spec 02-azure-ad-login.md
// Se retomará en una fase futura. No borrar: dejar comentado para reactivar.
// ========================================
// if (isAzureConfigured) {
//
//   const AzureAdOAuth2Strategy = require('passport-azure-ad').OIDCStrategy;
//
//   passport.use('azure', new AzureAdOAuth2Strategy({
//     identityMetadata: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0/.well-known/openid-configuration`,
//     clientID: process.env.AZURE_AD_CLIENT_ID,
//     clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
//     responseType: 'code',
//     responseMode: 'form_post',
//     redirectUrl: process.env.AZURE_AD_REDIRECT_URI,
//     allowHttpForRedirectUrl: true,
//     validateIssuer: true,
//     passReqToCallback: false,
//     scope: ['profile', 'email', 'openid']
//   },
//   async (iss, sub, profile, accessToken, refreshToken, done) => {
//     try {
//
//       const email = profile._json.email || profile._json.preferred_username;
//       const nombre = profile.displayName || profile._json.name;
//       const azureId = profile.oid || sub;
//
//       return done(null, {
//         id: azureId,
//         email,
//         nombre,
//         rol: 'usuario',
//         auth_type: 'microsoft',
//       });
//
//     } catch (error) {
//       done(error);
//     }
//   }));
//
//   console.log('✅ Azure AD configurado');
// } else {
//   console.log('⚠️  Azure AD no configurado (solo login local disponible)');
// }

// ========================================
// Estrategia Local (SIEMPRE ACTIVA)
// ========================================
passport.use('local', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
},
async (email, password, done) => {
  try {
    // Seguridad (hallazgo H-04): los logs NUNCA llevan el registro del usuario (incluye el hash de la contraseña),
    // ni el correo, ni el motivo del rechazo. Solo un evento genérico y, si entró, su id interno.
    
    const user = await usersDb.getLocalActiveUserByEmail(email);
    
    
    if (!user) {
      console.warn('⚠️  Login rechazado');
      await bcrypt.compare(password, HASH_FALSO); // iguala el tiempo con el camino «contraseña incorrecta»
      return done(null, false, { message: MENSAJE_CREDENCIALES });
    }
    
    const isValid = typeof user.password === 'string' && await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      console.warn('⚠️  Login rechazado');
      return done(null, false, { message: MENSAJE_CREDENCIALES });
    }
    
    const updatedUser = await usersDb.updateUserLastLogin(user.id);
    console.log(`✅ Login correcto (usuario ${user.id})`);
    return done(null, updatedUser || user);

  } catch (error) {
    console.error('❌ Error en LocalStrategy:', error.message);
    return done(error);
  }
}));

// Serialización
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await usersDb.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

passport.isAzureConfigured = isAzureConfigured;

module.exports = passport;