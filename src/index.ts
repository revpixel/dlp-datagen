// Worker: serves the JSON API. Static assets (the web UI) are served by
// Cloudflare before the Worker runs, except for /api/* (see cloudflare.config.ts).
import { handleApi } from "./api.ts";

export default {
	fetch(request) {
		return handleApi(request);
	},
} satisfies ExportedHandler;
