const bcrypt = require('bcryptjs');
const db = require('../database');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createAdmin() {
  rl.question('Email: ', (email) => {
    rl.question('Contraseña: ', async (password) => {
      rl.question('Nombre: ', async (nombre) => {
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const sql = `
          INSERT INTO usuarios (email, password, nombre, auth_type, rol)
          VALUES (?, ?, ?, 'local', 'admin')
        `;
        
        db.run(sql, [email, hashedPassword, nombre], function(err) {
          if (err) {
            console.error('❌ Error:', err.message);
          } else {
            console.log('✅ Admin creado con ID:', this.lastID);
          }
          db.close();
          rl.close();
        });
      });
    });
  });
}

createAdmin();