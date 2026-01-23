const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const db = require('../database');

// ========================================
// SOLO SI AZURE ESTÁ CONFIGURADO
// ========================================
if (process.env.AZURE_AD_CLIENT_ID && 
    process.env.AZURE_AD_CLIENT_SECRET && 
    process.env.AZURE_AD_TENANT_ID) {
  
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

      db.get('SELECT * FROM usuarios WHERE email = ? OR azure_id = ?', [email, azureId], (err, user) => {
        if (err) return done(err);

        if (user) {
          db.run('UPDATE usuarios SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
          return done(null, user);
        } else {
          const insertSql = `
            INSERT INTO usuarios (email, nombre, auth_type, azure_id, password, rol)
            VALUES (?, ?, 'microsoft', ?, 'MICROSOFT_AUTH', 'usuario')
          `;
          db.run(insertSql, [email, nombre, azureId], function(err) {
            if (err) return done(err);
            
            db.get('SELECT * FROM usuarios WHERE id = ?', [this.lastID], (err, newUser) => {
              done(err, newUser);
            });
          });
        }
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
    db.get('SELECT * FROM usuarios WHERE email = ? AND auth_type = "local" AND activo = 1', 
      [email], 
      async (err, user) => {
        if (err) return done(err);
        if (!user) return done(null, false, { message: 'Usuario no encontrado' });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return done(null, false, { message: 'Contraseña incorrecta' });

        db.run('UPDATE usuarios SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        
        return done(null, user);
      }
    );
  } catch (error) {
    return done(error);
  }
}));

// Serialización
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  db.get('SELECT * FROM usuarios WHERE id = ?', [id], (err, user) => {
    done(err, user);
  });
});

module.exports = passport;