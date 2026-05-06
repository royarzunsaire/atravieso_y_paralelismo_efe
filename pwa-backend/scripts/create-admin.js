const bcrypt = require('bcryptjs');
const db = require('../database');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}


async function createAdmin() {
  try {
    const email = await question('Email: ');
    const password = await question('Contraseña: ');
    const nombre = await question('Nombre: ');

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

    console.log('✅ Admin creado con ID:', user.id);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

createAdmin();