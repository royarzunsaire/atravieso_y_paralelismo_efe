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
      console.log('⚠️  Usuario ya existe en tabla usuarios, eliminando...');
      // No podemos eliminar desde database.js, hazlo manualmente en Supabase SQL Editor
      console.log('👉 Ejecuta en Supabase SQL Editor:');
      console.log(`   delete from usuarios where email = '${email}';`);
      console.log('   Luego vuelve a ejecutar este script.');
      return;
    }

    // 1. Crear en Supabase Auth
    console.log('📝 Creando usuario en Supabase Auth...');
    await usersDb.createLocalAuthUser({ email, password, nombre });
    console.log('✅ Usuario creado en Supabase Auth');

    // 2. Crear en tabla usuarios con password hasheado
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