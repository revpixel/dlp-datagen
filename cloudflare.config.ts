import { defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "dlp-datagen",
		compatibilityDate: "2026-11-10",
		entrypoint,
		assets: {
			notFoundHandling: "none",
			// The web UI is static; only the API runs in the Worker.
			runWorkerFirst: ["/api/*"],
		},
	},
});
