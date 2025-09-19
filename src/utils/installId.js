export function getInstallId() {
  let id = localStorage.getItem('pp_install_id');
  if (!id) {
    try { id = crypto.randomUUID(); }
    catch { id = `${Date.now()}_${Math.random().toString(36).slice(2)}`; }
    localStorage.setItem('pp_install_id', id);
  }
  return id;
}