// Service worker: its only job is to make the toolbar button open the side
// panel. It has no listeners for tabs, pages, network or messages.
function openPanelOnActionClick() {
	chrome?.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
		/* the panel can still be opened from Chrome's side panel menu */
	});
}

chrome?.runtime?.onInstalled.addListener(openPanelOnActionClick);
chrome?.runtime?.onStartup.addListener(openPanelOnActionClick);
