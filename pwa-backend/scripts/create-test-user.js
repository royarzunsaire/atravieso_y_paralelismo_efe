const bcrypt = require('bcryptjs');
const db = require('../database');

async function createTestUser() {
  const email = 'admin@efe.cl';
  const password = 'Admin123456'; // Cambiar después
  const nombre = 'Administrador EFE';
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const sql = `
    INSERT INTO usuarios (email, password, nombre, auth_type, rol)
    VALUES (?, ?, ?, 'local', 'admin')
  `;
  
  db.run(sql, [email, hashedPassword, nombre], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        console.log('⚠️  Usuario ya existe');
      } else {
        console.error('❌ Error:', err.message);
      }
    } else {
      console.log('✅ Usuario creado:');
      console.log('   Email:', email);
      console.log('   Password:', password);
      console.log('   ID:', this.lastID);
    }
    db.close();
  });
}

createTestUser();
