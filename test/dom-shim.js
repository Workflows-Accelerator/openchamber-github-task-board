/**
 * A tiny DOM for the decision renderer tests.
 *
 * It implements exactly what `panel/decisions.ts` uses, and nothing more:
 * `createElement`, `createDocumentFragment`, `createTextNode`, `textContent`,
 * `appendChild`, `className`, `setAttribute`, `addEventListener` and a class /
 * attribute `querySelectorAll`. `innerHTML` throws on write, so a renderer that
 * ever routes agent text through markup fails the test instead of passing it.
 */

function matches(node, selector) {
  if (!node || typeof selector !== 'string') return false;
  const attr = /^\[([a-z0-9-]+)(?:="([^"]*)")?\]$/i.exec(selector);
  if (attr) {
    if (!node.hasAttribute || !node.hasAttribute(attr[1])) return false;
    return attr[2] === undefined || node.getAttribute(attr[1]) === attr[2];
  }
  if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
  if (selector.startsWith('#')) return node.getAttribute('id') === selector.slice(1);
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

export function createElement(tagName = 'div') {
  const listeners = new Map();
  const attributes = new Map();
  const node = {
    tagName: String(tagName).toUpperCase(),
    children: [],
    className: '',
    id: '',
    value: '',
    checked: false,
    disabled: false,
    type: '',
    name: '',
    step: '',
    title: '',
    style: {},
    classList: {
      add(...names) {
        const current = new Set(String(node.className).split(/\s+/).filter(Boolean));
        for (const name of names) current.add(name);
        node.className = [...current].join(' ');
      },
      remove(...names) {
        const current = new Set(String(node.className).split(/\s+/).filter(Boolean));
        for (const name of names) current.delete(name);
        node.className = [...current].join(' ');
      },
      contains(name) {
        return String(node.className).split(/\s+/).filter(Boolean).includes(name);
      },
    },
    appendChild(child) {
      node.children.push(child);
      child.parentNode = node;
      return child;
    },
    setAttribute(name, value) {
      attributes.set(String(name), String(value));
    },
    getAttribute(name) {
      return attributes.has(String(name)) ? attributes.get(String(name)) : null;
    },
    hasAttribute(name) {
      return attributes.has(String(name));
    },
    getAttributeNames() {
      return [...attributes.keys()];
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener() {},
    focus() {},
    dispatch(type) {
      for (const listener of listeners.get(type) ?? []) {
        listener({ type, target: node, preventDefault() {}, stopPropagation() {} });
      }
    },
    querySelectorAll(selector) {
      const results = [];
      const walk = (current) => {
        for (const child of current.children ?? []) {
          if (matches(child, selector)) results.push(child);
          walk(child);
        }
      };
      walk(node);
      return results;
    },
    querySelector(selector) {
      return node.querySelectorAll(selector)[0] ?? null;
    },
    get textContent() {
      if (node.children.length > 0) return node.children.map((child) => child.textContent ?? '').join('');
      return node._text ?? '';
    },
    set textContent(value) {
      node._text = String(value);
      node.children = [];
    },
    get innerHTML() {
      return node._text ?? '';
    },
    set innerHTML(_value) {
      throw new Error('decision renderer must not use innerHTML');
    },
  };
  return node;
}

export function createDocumentFragment() {
  return createElement('fragment');
}

export function createTextNode(value) {
  return { textContent: String(value), children: [] };
}

/** Installs `document` for one test file and returns it. */
export function installDocument() {
  const document = {
    createElement,
    createDocumentFragment,
    createTextNode,
  };
  globalThis.document = document;
  return document;
}

/** Every text node under `node`, in order. */
export function collectText(node) {
  const out = [];
  const walk = (current) => {
    if (current._text !== undefined) out.push(current._text);
    for (const child of current.children ?? []) walk(child);
  };
  walk(node);
  return out;
}

/** Every element under `node`, in order. */
export function collectElements(node) {
  const out = [];
  const walk = (current) => {
    for (const child of current.children ?? []) {
      out.push(child);
      walk(child);
    }
  };
  walk(node);
  return out;
}

/** A structural signature: tag plus classes, so EN and FR can be compared. */
export function structureOf(node) {
  return collectElements(node).map((child) => `${child.tagName}.${String(child.className).trim()}`);
}
