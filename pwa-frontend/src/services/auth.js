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
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Obtener token
  getToken() {
    return localStorage.getItem('token');
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