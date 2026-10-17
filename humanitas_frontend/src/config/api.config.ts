/**
 * Centralized API Configuration
 * All API endpoints should use these URLs from environment variables
 */

// Main tenant API base URL - use environment variable or fallback to VPS IP
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://humanitas-erp.ziontech.tech/api/v1';

// Socket.IO connection URL (for real-time features)
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

// File uploads base URL (proxied through Vercel for same-origin)
export const UPLOADS_URL = '/api/uploads';

// Avatar generation service (external)
export const AVATAR_API_URL = 'https://api.dicebear.com/7.x/initials/svg';

// Helper to generate avatar URL
export function getAvatarUrl(name: string): string {
  return `${AVATAR_API_URL}?seed=${encodeURIComponent(name || 'User')}`;
}

// Helper to get full upload URL
export function getUploadUrl(filename: string): string {
  if (!filename) return '';
  // If already a full URL, return as-is
  if (filename.startsWith('http')) return filename;

  // Handle relative URLs (e.g., /uploads/avatar.jpg or avatar.jpg)
  const cleanFilename = filename.startsWith('/uploads/')
    ? filename.substring('/uploads/'.length)
    : filename.startsWith('/')
      ? filename
      : filename;

  // If UPLOADS_URL is a full URL (production)
  if (UPLOADS_URL.startsWith('http')) {
    return `${UPLOADS_URL}/${cleanFilename}`;
  }

  // Otherwise use relative path (development with proxy)
  return cleanFilename.startsWith('/') ? cleanFilename : `${UPLOADS_URL}/${cleanFilename}`;
}

// Configuration object for easy import
export const apiConfig = {
  baseUrl: API_BASE_URL,
  socketUrl: SOCKET_URL,
  uploadsUrl: UPLOADS_URL,
  avatarApiUrl: AVATAR_API_URL,
  getAvatarUrl,
  getUploadUrl,
};

export default apiConfig;
