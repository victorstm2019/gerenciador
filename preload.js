// preload.js
// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
  // You can expose protected APIs here if needed
  console.log('Preload script loaded.');
});
