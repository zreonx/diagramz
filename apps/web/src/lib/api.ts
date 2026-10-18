import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && envUrl.startsWith('https://')) {
      return envUrl;
    }
    return '/api/v1';
  }

  return (
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === 'production'
      ? '/api/v1'
      : 'http://localhost:4000/api/v1')
  );
}

const API_BASE_URL = getApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let accessToken: string | null = null;
let refreshToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('diagramz_access_token', token);
    } else {
      localStorage.removeItem('diagramz_access_token');
      localStorage.removeItem('diagramz_refresh_token');
      refreshToken = null;
    }
  }
};

export const getAccessToken = (): string | null => {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('diagramz_access_token');
  }
  return accessToken;
};

export const setRefreshToken = (token: string | null) => {
  refreshToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('diagramz_refresh_token', token);
    } else {
      localStorage.removeItem('diagramz_refresh_token');
    }
  }
};

export const getRefreshToken = (): string | null => {
  if (refreshToken) return refreshToken;
  if (typeof window !== 'undefined') {
    refreshToken = localStorage.getItem('diagramz_refresh_token');
  }
  return refreshToken;
};

// Request interceptor to attach bearer token and protect against mixed content
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Prevent any accidental http:// calls on HTTPS pages (e.g. Vercel)
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    if (config.url && config.url.startsWith('http://')) {
      config.url = config.url.replace(/^http:\/\/[^/]+(\/api\/v1)?/, '/api/v1');
    }
    if (config.baseURL && config.baseURL.startsWith('http://')) {
      config.baseURL = '/api/v1';
    }
  }

  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401 and refresh token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers && token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = getRefreshToken();
        const refreshEndpoint =
          typeof window !== 'undefined' && window.location.protocol === 'https:'
            ? '/api/v1/auth/refresh'
            : `${API_BASE_URL}/auth/refresh`;
        const refreshResponse = await axios.post(
          refreshEndpoint,
          storedRefreshToken ? { refreshToken: storedRefreshToken } : {},
          { withCredentials: true },
        );
        const newToken = refreshResponse.data.tokens.accessToken;
        const newRefreshToken = refreshResponse.data.tokens.refreshToken;
        setAccessToken(newToken);
        if (newRefreshToken) {
          setRefreshToken(newRefreshToken);
        }
        processQueue(null, newToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        setAccessToken(null);
        if (
          typeof window !== 'undefined' &&
          window.location.pathname !== '/' &&
          !window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/register') &&
          !window.location.pathname.startsWith('/share')
        ) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
