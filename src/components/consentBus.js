export function openConsent() {
  window.dispatchEvent(new Event('pp:consent:open'));
}