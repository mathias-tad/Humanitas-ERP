// [FIX] Read from Environment Variable (Set this in Vercel!)
// We prioritize BACKEND_URL, but fallback to VITE_API_URL (origin only)
const getBackendUrl = () => {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL;
  if (process.env.VITE_API_URL) {
    try {
      // Extract origin (e.g., https://site.com) from full URL (e.g., https://site.com/api/v1)
      return new URL(process.env.VITE_API_URL).origin;
    } catch (e) {
      console.warn('Invalid VITE_API_URL:', process.env.VITE_API_URL);
    }
  }
  return 'https://your-tenant-api.onrender.com';
};

const BACKEND_URL = getBackendUrl();

export const config = {
  api: {
    bodyParser: false, // Disable body parsing to handle raw body for file uploads
  },
};

// Helper to get raw body
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  // Get path from query parameter (set by Vercel rewrite)
  const pathParam = req.query.path || '';

  // Build URL, preserving other query params
  // Check if it's an uploads path (no /api prefix on backend)
  const isUploads = pathParam.startsWith('uploads/') || pathParam === 'uploads';
  const basePath = isUploads ? '' : '/api';
  const url = new URL(`${BACKEND_URL}${basePath}/${pathParam}`);
  Object.keys(req.query).forEach(key => {
    if (key !== 'path') {
      url.searchParams.append(key, req.query[key]);
    }
  });

  console.log('Proxying:', req.method, url.toString());

  try {
    const headers = {};

    // Forward content-type (important for multipart/form-data)
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }
    if (req.headers.cookie) {
      headers['Cookie'] = req.headers.cookie;
    }
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    if (req.headers['x-tenant-id']) {
      headers['X-Tenant-ID'] = req.headers['x-tenant-id'];
    }
    if (req.headers['x-tenant-slug']) {
      headers['X-Tenant-Slug'] = req.headers['x-tenant-slug'];
    }
    // Forward content-length for file uploads
    if (req.headers['content-length']) {
      headers['Content-Length'] = req.headers['content-length'];
    }

    const fetchOptions = {
      method: req.method,
      headers,
    };

    // Get raw body for non-GET requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const rawBody = await getRawBody(req);
      if (rawBody.length > 0) {
        fetchOptions.body = rawBody;
      }
    }

    const backendResponse = await fetch(url.toString(), fetchOptions);

    // Forward Set-Cookie headers
    const setCookies = backendResponse.headers.getSetCookie?.() || [];
    if (setCookies.length > 0) {
      res.setHeader('Set-Cookie', setCookies);
    } else {
      const rawSetCookie = backendResponse.headers.get('set-cookie');
      if (rawSetCookie) {
        res.setHeader('Set-Cookie', rawSetCookie);
      }
    }

    const contentType = backendResponse.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // Handle different response types
    if (contentType && contentType.includes('application/json')) {
      const responseBody = await backendResponse.json();
      res.status(backendResponse.status).json(responseBody);
    } else if (contentType && (contentType.includes('image/') || contentType.includes('application/octet-stream'))) {
      // Handle binary data (images, files)
      const buffer = Buffer.from(await backendResponse.arrayBuffer());
      res.status(backendResponse.status).send(buffer);
    } else {
      const responseBody = await backendResponse.text();
      res.status(backendResponse.status).send(responseBody);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
