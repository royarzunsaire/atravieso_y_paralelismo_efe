const bcrypt = require('bcryptjs');
const usersDb = require('../database');

async function createTestUser() {
  const email = 'admin@efe.cl';
  const password = 'Admin123456';
  const nombre = 'Administrador EFE';

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
    console.log(`  Password: ${password}`);
    console.log(`  ID:       ${user.id}`);
    console.log(`  Rol:      ${user.rol}`);
    console.log('═══════════════════════════════════');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exitCode = 1;
  }
}

createTestUser();