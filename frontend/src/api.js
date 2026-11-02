const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'jasrain_token';

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);

export const setToken = (token) => {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body, options = {}) {
  const { asBlob = false, headers: extraHeaders = {} } = options;
  const headers = {};
  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Add caller-provided headers, including the one-time upload token.
  Object.assign(headers, extraHeaders);

  let payload;

  if (body instanceof Blob) {
    headers['Content-Type'] =
      body.type || 'application/octet-stream';
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;

  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: payload,
    });
  } catch {
    throw new ApiError(
      'Cannot reach the server. Is the backend running?',
      0
    );
  }

  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event('jasrain-signed-out'));
  }

  if (!res.ok) {
    let message = 'Something went wrong.';

    try {
      const data = await res.json();
      message = data.error || data.message || message;
    } catch {
      // The response was not JSON.
    }

    throw new ApiError(message, res.status);
  }

  return asBlob ? res.blob() : res.json();
}

export const api = {
  get: (path) => request('GET', path),

  post: (path, body) =>
    request('POST', path, body ?? {}),

  put: (path, body, headers = {}) =>
    request('PUT', path, body, { headers }),

  patch: (path, body) =>
    request('PATCH', path, body),

  del: (path) =>
    request('DELETE', path),

  blob: (path) =>
    request('GET', path, undefined, { asBlob: true }),
};
