const supabase = require('./supabase');

function normalizeSupabaseError(error) {
  if (!error) return null;
  const normalized = new Error(error.message || 'Error de Supabase');
  normalized.code = error.code;
  normalized.details = error.details;
  normalized.hint = error.hint;
  return normalized;
}

async function assertSingle(query) {
  const { data, error } = await query;
  if (error) throw normalizeSupabaseError(error);
  return data;
}

async function maybeSingle(query) {
  const { data, error } = await query;
  if (error && error.code !== 'PGRST116') {
    throw normalizeSupabaseError(error);
  }
  return data || null;
}

function mapUsuarioRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    nombre: row.nombre,
    rol: row.rol,
    auth_type: row.auth_type,
    activo: row.activo,
    created_at: row.created_at,
    last_login: row.last_login,
  };
}

async function getUserByEmail(email) {
  const data = await maybeSingle(
    supabase.from('usuarios').select('*').eq('email', email).maybeSingle()
  );
  return mapUsuarioRow(data);
}

async function getUserById(id) {
  const data = await maybeSingle(
    supabase.from('usuarios').select('*').eq('id', id).maybeSingle()
  );
  return mapUsuarioRow(data);
}

async function getLocalActiveUserByEmail(email) {
  const data = await maybeSingle(
    supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('auth_type', 'local')
      .eq('activo', true)
      .maybeSingle()
  );
  return mapUsuarioRow(data);
}

async function updateUserLastLogin(id) {
  const data = await assertSingle(
    supabase
      .from('usuarios')
      .update({ last_login: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()
  );
  return mapUsuarioRow(data);
}

async function createLocalUser({ email, password, nombre, rol = 'usuario' }) {
  const data = await assertSingle(
    supabase
      .from('usuarios')
      .insert({
        email,
        password,
        nombre,
        rol,
        auth_type: 'local',
        activo: true,
      })
      .select('*')
      .single()
  );
  return mapUsuarioRow(data);
}

async function createLocalAuthUser({ email, password, nombre }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });
  
  if (error) throw normalizeSupabaseError(error);
  return data.user;
}

async function signInLocalAuthUser({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw normalizeSupabaseError(error);
  return data.session;
}

module.exports = {
  supabase,
  getUserByEmail,
  getUserById,
  getLocalActiveUserByEmail,
  updateUserLastLogin,
  createLocalUser,
  createLocalAuthUser,
  signInLocalAuthUser,
};