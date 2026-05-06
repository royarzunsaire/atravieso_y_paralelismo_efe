const bcrypt = require('bcryptjs');
const usersDb = require('../database');

async function createTestUser() {
  const email = 'admin@efe.cl';
  const password = 'Admin123456'; // Cambiar después
  const nombre = 'Administrador EFE';
  
  try {
    const existing = await usersDb.getUserByEmail(email);
    if (existing) {
      console.log('⚠️  Usuario ya existe');
      return;
    }
    await usersDb.createLocalAuthUser({
      email,
      password,
      nombre,
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await usersDb.createLocalUser({
      email,
      password: hashedPassword,
      nombre,
      rol: 'admin',
    });

    console.log('✅ Usuario creado:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   ID:', user.id);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exitCode = 1;
  }  
}

createTestUser();
