export function confirmDelete(label) {
  if (!window.confirm(`Eliminare ${label}?`)) return false;
  if (!window.confirm('Conferma definitiva. Operazione irreversibile.')) return false;
  return true;
}
