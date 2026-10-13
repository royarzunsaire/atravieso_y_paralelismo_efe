const bcrypt = require('bcryptjs');
const usersDb = require('../database');

async function createTestUser() {
  // Crea un usuario ADMIN. Nada va escrito en el código: se pide por el entorno (H-12 / H-20).
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  const nombre = process.env.TEST_USER_NOMBRE || 'Usuario de prueba';
  if (!email || !password || password.length < 12) {
    console.error('Define TEST_USER_EMAIL y TEST_USER_PASSWORD (mínimo 12 caracteres) en el entorno.');
    console.error('Esta herramienta crea un usuario con rol ADMIN: úsala solo en desarrollo.');
    process.exit(1);
  }

  try {
    // Verificar si ya existe en la tabla usuarios
    const existing = await usersDb.getUserByEmail(email);
    if (existing) {
      console.log('⚠️  Usuario ya existe en tabla usuarios, elimínalo primero si quieres recrearlo.');
      console.log(`   DELETE /usuarios/${existing.id} en ORDS, o DELETE FROM usuarios WHERE email = '${email}' en Oracle.`);
      return;
    }

    // Crear en tabla usuarios (Oracle) con password hasheado
    console.log('📝 Creando usuario en tabla usuarios...');
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await usersDb.createLocalUser({
      email,
      password: hashedPassword,
      nombre,
      rol: 'admin',
    });
    console.log('✅ Usuario creado en tabla usuarios');
    console.log('');
    console.log('═══════════════════════════════════');
    console.log('  Credenciales de acceso:');
    console.log(`  Email:    ${email}`);
    console.log(`  ID:       ${user.id}`);
    console.log(`  Rol:      ${user.rol}`);
    console.log('═══════════════════════════════════');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exitCode = 1;
  }
}

createTestUser();