// ==========================================
// Custom UI Dropdown Component
// ==========================================

export function setupCustomDropdown(selectEl: HTMLSelectElement): {
  wrapper: HTMLElement;
  trigger: HTMLButtonElement;
  menu: HTMLElement;
  sync: () => void;
  destroy: () => void;
} | null {
  if (!selectEl || selectEl.dataset.customDropdownInitialized === 'true') {
    return null;
  }
  selectEl.dataset.customDropdownInitialized = 'true';

  // 1. Hide the native select
  selectEl.style.display = 'none';

  // 2. Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-dropdown';
  if (selectEl.classList.contains('select-sm')) {
    wrapper.classList.add('size-sm');
  }
  if (selectEl.style.width === '100%') {
    wrapper.classList.add('size-full');
  }
  if (selectEl.style.flex) {
    wrapper.style.flex = selectEl.style.flex;
  }
  wrapper.dataset.selectId = selectEl.id || '';

  // 3. Create trigger button
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-dropdown-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const labelSpan = document.createElement('span');
  labelSpan.className = 'custom-dropdown-label';

  const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  arrowSvg.setAttribute('class', 'custom-dropdown-arrow icon icon-sm');
  arrowSvg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M7 10l5 5 5-5z');
  arrowSvg.appendChild(path);

  trigger.appendChild(labelSpan);
  trigger.appendChild(arrowSvg);
  wrapper.appendChild(trigger);

  // 4. Create floating menu
  const menu = document.createElement('div');
  menu.className = 'custom-dropdown-menu';
  menu.setAttribute('role', 'listbox');

  let activeIndex = -1;

  function syncOptions(): void {
    menu.innerHTML = '';
    const options = Array.from(selectEl.options);
    options.forEach((opt, idx) => {
      const item = document.createElement('div');
      item.className = 'custom-dropdown-item';
      item.setAttribute('role', 'option');
      item.setAttribute('data-value', opt.value);
      item.setAttribute('data-index', String(idx));
      item.setAttribute('aria-selected', opt.selected ? 'true' : 'false');
      if (opt.selected) {
        item.classList.add('is-selected');
        activeIndex = idx;
      }

      const text = document.createElement('span');
      text.className = 'custom-dropdown-item-text';
      text.textContent = opt.text;

      const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      checkSvg.setAttribute('class', 'custom-dropdown-check icon icon-sm');
      checkSvg.setAttribute('viewBox', '0 0 24 24');
      const checkPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      checkPath.setAttribute('d', 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z');
      checkSvg.appendChild(checkPath);

      item.appendChild(text);
      item.appendChild(checkSvg);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectOption(opt.value);
      });

      menu.appendChild(item);
    });
  }

  function syncLabel(): void {
    const selected = selectEl.options[selectEl.selectedIndex];
    labelSpan.textContent = selected ? selected.text : '';

    const items = Array.from(menu.children) as HTMLElement[];
    items.forEach((item, idx) => {
      const isSel = idx === selectEl.selectedIndex;
      item.classList.toggle('is-selected', isSel);
      item.setAttribute('aria-selected', isSel ? 'true' : 'false');
    });
  }

  function positionMenu(): void {
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const minWidth = Math.max(rect.width, 130);
    menu.style.minWidth = `${minWidth}px`;

    menu.style.left = `${Math.min(rect.left, window.innerWidth - minWidth - 10)}px`;

    if (spaceBelow < 180 && spaceAbove > spaceBelow) {
      menu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
      menu.style.top = 'auto';
    } else {
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.bottom = 'auto';
    }
  }

  function openMenu(): void {
    if (menu.classList.contains('is-open')) return;
    document.querySelectorAll('.custom-dropdown-menu.is-open').forEach((m) => {
      m.classList.remove('is-open');
    });
    document.querySelectorAll('.custom-dropdown-trigger.is-open').forEach((t) => {
      t.classList.remove('is-open');
      t.setAttribute('aria-expanded', 'false');
    });

    if (!document.body.contains(menu)) {
      document.body.appendChild(menu);
    }
    positionMenu();
    menu.classList.add('is-open');
    trigger.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');

    const selectedItem = menu.querySelector('.custom-dropdown-item.is-selected') as HTMLElement | null;
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }

  function closeMenu(): void {
    menu.classList.remove('is-open');
    trigger.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  function selectOption(val: string): void {
    if (selectEl.value !== val) {
      selectEl.value = val;
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    syncLabel();
    closeMenu();
    trigger.focus();
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.classList.contains('is-open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    } else if (e.key === 'Escape') {
      closeMenu();
    }
  });

  menu.addEventListener('keydown', (e) => {
    const items = Array.from(menu.querySelectorAll('.custom-dropdown-item')) as HTMLElement[];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      items[activeIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      items[activeIndex]?.focus();
    } else if (e.key === 'Escape') {
      closeMenu();
      trigger.focus();
    }
  });

  const proto = HTMLSelectElement.prototype;
  const originalDescriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (originalDescriptor) {
    Object.defineProperty(selectEl, 'value', {
      get() {
        return originalDescriptor.get?.call(this);
      },
      set(newVal) {
        originalDescriptor.set?.call(this, newVal);
        syncLabel();
      },
      configurable: true,
    });
  }

  selectEl.addEventListener('change', syncLabel);

  const observer = new MutationObserver(() => {
    syncOptions();
    syncLabel();
  });
  observer.observe(selectEl, { childList: true, subtree: true, attributes: true });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target as Node) && !menu.contains(e.target as Node)) {
      closeMenu();
    }
  });

  window.addEventListener('resize', closeMenu);

  syncOptions();
  syncLabel();

  selectEl.parentNode?.insertBefore(wrapper, selectEl.nextSibling);

  return {
    wrapper,
    trigger,
    menu,
    sync: () => {
      syncOptions();
      syncLabel();
    },
    destroy: () => {
      observer.disconnect();
      menu.remove();
      wrapper.remove();
      selectEl.style.display = '';
      delete selectEl.dataset.customDropdownInitialized;
    },
  };
}

export function initAllCustomDropdowns(root: ParentNode = document): void {
  const selects = root.querySelectorAll('select.form-ctrl, select.select-sm');
  selects.forEach((s) => {
    setupCustomDropdown(s as HTMLSelectElement);
  });
}
