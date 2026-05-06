const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const authService = {
  // Login local
  async loginLocal(email, password) {
    const response = await fetch(`${API_URL}/auth/login/local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al iniciar sesión');
    }

    // Guardar token y usuario en localStorage
    localStorage.setItem('token', data.token);
    if (data.connection_token) {
      localStorage.setItem('connection_token', data.connection_token);
    }
    if (data.supabase_session) {
      localStorage.setItem('supabase_session', JSON.stringify(data.supabase_session));
    }
    localStorage.setItem('user', JSON.stringify(data.user));

    return data;
  },

  // Registro
  async register(email, password, nombre) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, nombre })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al registrar');
    }

    localStorage.setItem('token', data.token);
    if (data.connection_token) {
      localStorage.setItem('connection_token', data.connection_token);
    }
    if (data.supabase_session) {
      localStorage.setItem('supabase_session', JSON.stringify(data.supabase_session));
    }
    localStorage.setItem('user', JSON.stringify(data.user));

    return data;
  },

  // Obtener usuario actual
  async getCurrentUser() {
    const token = this.getToken();
    if (!token) return null;

    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      this.logout();
      return null;
    }

    const data = await response.json();
    return data.user;
  },

  // Logout
async logout() {
  try {
    const token = this.getToken();
    const supabaseToken = this.getConnectionToken();

    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          // Enviar el token de Supabase para cerrar esa sesión
          ...(supabaseToken && { 'x-supabase-token': supabaseToken }),
        },
      });
    }
  } catch (e) {
    console.warn('⚠️  Error cerrando sesión en servidor:', e.message);
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('connection_token');
    localStorage.removeItem('supabase_session');
    localStorage.removeItem('user');
  }
},

  // Obtener token
  getToken() {
    return localStorage.getItem('token');
  },

  // Obtener token de conexión de Supabase para usuarios locales
  getConnectionToken() {
    return localStorage.getItem('connection_token');
  },

  // Obtener usuario guardado
  getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Verificar si está autenticado
  isAuthenticated() {
    return !!this.getToken();
  }
};