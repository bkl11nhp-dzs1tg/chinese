import { defineConfig } from 'vite';
import { createReadStream, existsSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, normalize, extname, join } from 'node:path';

// Nội dung học lấy thẳng từ data/ (không cần nạp file trong app):
// - dev: phục vụ data/pack.json tại /content/pack.json, data/audio/*.mp3 tại /content/audio/
// - build: chép vào dist/content/. Đặt INCLUDE_AUDIO=0 để không đưa MP3 vào bản build.
const dataDir = resolve(__dirname, 'data');
const TYPES = { '.json': 'application/json; charset=utf-8', '.mp3': 'audio/mpeg' };

function contentFromData() {
  return {
    name: 'content-from-data',
    configureServer(server) {
      server.middlewares.use('/content', (req, res, next) => {
        const rel = decodeURIComponent((req.url || '/').split('?')[0]);
        const file = normalize(resolve(dataDir, `.${rel}`));
        if (!file.startsWith(dataDir) || !existsSync(file) || !statSync(file).isFile()) return next();
        const size = statSync(file).size;
        res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
        res.setHeader('Accept-Ranges', 'bytes');
        const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
        if (range) {
          const start = Number(range[1] || 0);
          const end = range[2] ? Number(range[2]) : size - 1;
          res.statusCode = 206;
          res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
          res.setHeader('Content-Length', end - start + 1);
          return createReadStream(file, { start, end }).pipe(res);
        }
        res.setHeader('Content-Length', size);
        createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      const pack = join(dataDir, 'pack.json');
      if (!existsSync(pack)) {
        this.warn('Không có data/pack.json: bản build sẽ không có nội dung (chạy npm run pack).');
        return;
      }
      this.emitFile({ type: 'asset', fileName: 'content/pack.json', source: readFileSync(pack) });
      const decomp = join(dataDir, 'decomp.json');
      if (existsSync(decomp)) this.emitFile({ type: 'asset', fileName: 'content/decomp.json', source: readFileSync(decomp) });
      const audioDir = join(dataDir, 'audio');
      if (process.env.INCLUDE_AUDIO !== '0' && existsSync(audioDir)) {
        for (const f of readdirSync(audioDir).filter((x) => x.endsWith('.mp3'))) {
          this.emitFile({ type: 'asset', fileName: `content/audio/${f}`, source: readFileSync(join(audioDir, f)) });
        }
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [contentFromData()],
  server: { port: 5173, host: true },
  build: { outDir: 'dist' },
  test: { include: ['tests/**/*.test.js'] },
});
