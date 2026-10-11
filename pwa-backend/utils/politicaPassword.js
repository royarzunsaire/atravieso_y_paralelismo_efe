// Política de contraseñas NUEVAS (cambio de contraseña y reset de administrador, H-19).
// No se aplica al login: las cuentas existentes siguen entrando con la contraseña que ya tienen.

const MIN_LARGO = 10;
const MAX_LARGO = 200;
// Fragmentos que vuelven predecible una contraseña (se buscan sin distinguir mayúsculas).
const FRAGMENTOS_COMUNES = [
  'password', 'passw0rd', 'contraseña', 'contrasena', 'qwerty', '123456', 'abcdef', 'admin',
  'letmein', 'welcome', 'bienvenid', 'efe2026', 'iloveyou',
];

/** Devuelve un mensaje (texto para el usuario) si la contraseña no cumple, o null si es aceptable. */
function validarPasswordNueva(password) {
  if (typeof password !== 'string') return 'La contraseña no es válida.';
  if (password.length < MIN_LARGO) return `La nueva contraseña debe tener al menos ${MIN_LARGO} caracteres.`;
  if (password.length > MAX_LARGO) return `La nueva contraseña no puede superar los ${MAX_LARGO} caracteres.`;
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'La nueva contraseña debe incluir al menos una letra y un número.';
  const minus = password.toLowerCase();
  if (FRAGMENTOS_COMUNES.some((f) => minus.includes(f))) return 'La nueva contraseña es demasiado común o predecible: elige otra.';
  if (/^(.)\1+$/.test(password)) return 'La nueva contraseña es demasiado simple: elige otra.';
  return null;
}

module.exports = { validarPasswordNueva, MIN_LARGO };
