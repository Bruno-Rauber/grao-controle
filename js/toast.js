export function toast(msg, tipo = 'sucesso') {
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('toast-visivel')));
  setTimeout(() => {
    el.classList.remove('toast-visivel');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 2500);
}
