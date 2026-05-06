const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const usersDb = require('../database');

const isAzureConfigured = Boolean(
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_CLIENT_SECRET &&
  process.env.AZURE_AD_TENANT_ID &&
  process.env.AZURE_AD_REDIRECT_URI
);

// ========================================
// SOLO SI AZURE ESTÁ CONFIGURADO
// ========================================
if (isAzureConfigured) {
  
  const AzureAdOAuth2Strategy = require('passport-azure-ad').OIDCStrategy;
  
  passport.use('azure', new AzureAdOAuth2Strategy({
    identityMetadata: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0/.well-known/openid-configuration`,
    clientID: process.env.AZURE_AD_CLIENT_ID,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
    responseType: 'code',
    responseMode: 'form_post',
    redirectUrl: process.env.AZURE_AD_REDIRECT_URI,
    allowHttpForRedirectUrl: true,
    validateIssuer: true,
    passReqToCallback: false,
    scope: ['profile', 'email', 'openid']
  },
  async (iss, sub, profile, accessToken, refreshToken, done) => {
    try {

      const email = profile._json.email || profile._json.preferred_username;
      const nombre = profile.displayName || profile._json.name;
      const azureId = profile.oid || sub;

      return done(null, {
        id: azureId,
        email,
        nombre,
        rol: 'usuario',
        auth_type: 'microsoft',
      });

    } catch (error) {
      done(error);
    }
  }));
  
  console.log('✅ Azure AD configurado');
} else {
  console.log('⚠️  Azure AD no configurado (solo login local disponible)');
}

// ========================================
// Estrategia Local (SIEMPRE ACTIVA)
// ========================================
passport.use('local', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
},
async (email, password, done) => {
  try {

    const user = await usersDb.getLocalActiveUserByEmail(email);
    if (!user) return done(null, false, { message: 'Usuario no encontrado' });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return done(null, false, { message: 'Contraseña incorrecta' });
    const updatedUser = await usersDb.updateUserLastLogin(user.id);

    return done(null, updatedUser || user);

  } catch (error) {
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