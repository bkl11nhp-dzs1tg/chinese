// Điểm vào Cloudflare Worker.
import { handle } from './handler.js';

export default {
  fetch: (request, env) => handle(request, env),
};
