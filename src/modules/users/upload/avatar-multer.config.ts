import { diskStorage } from 'multer';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

const dest = process.env.VERCEL
  ? path.join('/tmp', 'uploads', 'avatars')
  : path.resolve(process.cwd(), 'uploads/avatars');
if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

export const avatarMulterConfig = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '');
      const name = crypto.randomUUID().replace(/-/g, '');
      cb(null, `${name}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: any, file: { mimetype: string }, cb: (err: Error | null, ok: boolean) => void) => {
    const ok = /image\/(png|jpe?g|webp|gif|svg\+xml)/.test(file.mimetype);
    cb(ok ? null : new Error('Invalid image type'), ok);
  },
};
