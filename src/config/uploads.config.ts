import { registerAs } from '@nestjs/config';

export default registerAs('uploads', () => ({
  maxFileSizeMB: parseInt(process.env.UPLOAD_MAX_MB ?? '5', 10),
  allowedMime: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif',
    'image/svg+xml',
  ],
  publicBaseUrl: process.env.PUBLIC_BASE_URL, // opcional
}));
