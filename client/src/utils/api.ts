export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Only set Content-Type to JSON if it's not FormData (which sets its own boundary)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Optional: handle token expiration globally
    localStorage.removeItem('token');
    localStorage.removeItem('isAuthenticated');
    window.location.href = '/auth';
  }

  return response;
};
