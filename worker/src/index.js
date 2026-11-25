// Điểm vào Cloudflare Worker: API (fetch) + nhắc học theo lịch (scheduled, cron mỗi 15 phút).
import { handle } from './handler.js';
import { runReminders } from './push.js';

export default {
  fetch: (request, env) => handle(request, env),
  scheduled: (event, env, ctx) => ctx.waitUntil(runReminders(env)),
};
