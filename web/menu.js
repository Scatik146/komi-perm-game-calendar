// Меню разделов «☰»: закрывается щелчком мимо него и клавишей Escape.
// Само меню открывается без скриптов — это элемент <details> в шапке страницы.

// zakrytMenu: свернуть меню разделов
function zakrytMenu(menu) {
  menu.open = false;
}

// shchelchokMimo: щелчок пришёлся вне меню
function shchelchokMimo(menu, sobytie) {
  const mimo = !menu.contains(sobytie.target);
  return mimo;
}

// podklyuchitMenu: повесить закрытие меню на щелчок и Escape
function podklyuchitMenu() {
  const menu = document.querySelector('.menu');
  if (menu) {
    document.addEventListener('click', (e) => { if (shchelchokMimo(menu, e)) zakrytMenu(menu); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') zakrytMenu(menu); });
  }
}

podklyuchitMenu();
