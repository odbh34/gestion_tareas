const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, headers, ...options } = {}) {
  const requestHeaders = { ...(headers || {}) };

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...options,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message || 'No se pudo completar la solicitud',
      response.status,
      payload?.error?.details,
    );
  }

  return payload;
}

function withQuery(path, params) {
  const query = new URLSearchParams(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ).toString();

  return query ? `${path}?${query}` : path;
}

export const api = {
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  changePassword: (data) =>
    request('/auth/change-password', { method: 'POST', body: data }),
  forgotPassword: (data) =>
    request('/auth/forgot-password', { method: 'POST', body: data }),
  resetPassword: (data) =>
    request('/auth/reset-password', { method: 'POST', body: data }),

  listTasks: (params = {}) => request(withQuery('/tasks', params)),
  createTask: (data) => request('/tasks', { method: 'POST', body: data }),
  updateTask: (id, data) =>
    request(`/tasks/${id}`, { method: 'PATCH', body: data }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  listUsers: (params = {}) => request(withQuery('/users', params)),
  createUser: (data) => request('/users', { method: 'POST', body: data }),
  updateUser: (id, data) =>
    request(`/users/${id}`, { method: 'PATCH', body: data }),
  updateUserRole: (id, role) =>
    request(`/users/${id}/role`, { method: 'PATCH', body: { role } }),
  updateUserStatus: (id, isActive) =>
    request(`/users/${id}/status`, {
      method: 'PATCH',
      body: { is_active: isActive },
    }),
};
