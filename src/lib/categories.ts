import type { Category } from "./fields.ts";

/**
 * Presentation metadata for categories, shared by the web UI and the browser
 * extension. Pure data (SVG path markup and token names): no DOM access here.
 */
export const CATEGORY_ICONS: Record<Category, string> = {
	Identity: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
	Contact: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
	"Government ID": '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2M15 10h3M15 13.5h3"/>',
	Financial: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
	Health: '<path d="M12 20s-8-4.6-8-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.8C20 15.4 12 20 12 20z"/><path d="M8 12h2.2l1.3-2.5 2 5 1.3-2.5H16"/>',
	Secrets: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16.5 6.5l2.5 2.5M14.5 8.5l2 2"/>',
	Network: '<rect x="9" y="3" width="6" height="5" rx="1.2"/><rect x="3" y="16" width="6" height="5" rx="1.2"/><rect x="15" y="16" width="6" height="5" rx="1.2"/><path d="M12 8v4M6 16v-2.5h12V16"/>',
};

/** Suffix of the `--c-*` colour token for each category. */
export const CATEGORY_TOKEN: Record<Category, string> = {
	Identity: "identity",
	Contact: "contact",
	"Government ID": "gov",
	Financial: "financial",
	Health: "health",
	Secrets: "secrets",
	Network: "network",
};
