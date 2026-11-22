/* global window */
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.rateWatchInstallPrompt = event;
});
