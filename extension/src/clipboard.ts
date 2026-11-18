// Write-only clipboard access, always triggered by a click or key press.
// The Clipboard API needs no extension permission for a user-initiated write;
// the execCommand path covers documents where it is unavailable.
export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		/* fall through */
	}
	try {
		const area = document.createElement("textarea");
		area.value = text;
		area.setAttribute("readonly", "");
		area.className = "clip-buffer";
		const active = document.activeElement as HTMLElement | null;
		document.body.append(area);
		area.select();
		const ok = document.execCommand("copy");
		area.remove();
		active?.focus();
		return ok;
	} catch {
		return false;
	}
}
