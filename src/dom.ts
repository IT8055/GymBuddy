/** Minimal hyperscript helper for building DOM without a framework. */
type Child = Node | string | number | null | undefined | false
type Attrs = Record<string, any>

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k === 'class') el.className = v
    else if (k === 'html') el.innerHTML = v
    else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v)
    } else if (k === 'value') {
      ;(el as any).value = v
    } else if (v === true) {
      el.setAttribute(k, '')
    } else {
      el.setAttribute(k, String(v))
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue
    el.append(c instanceof Node ? c : document.createTextNode(String(c)))
  }
  return el
}

export function clear(el: HTMLElement) {
  el.replaceChildren()
}

/** Lightweight toast notification. */
export function toast(message: string, kind: 'info' | 'error' | 'success' = 'info') {
  const t = h('div', { class: `toast toast-${kind}` }, message)
  document.body.append(t)
  requestAnimationFrame(() => t.classList.add('show'))
  setTimeout(() => {
    t.classList.remove('show')
    setTimeout(() => t.remove(), 300)
  }, 2600)
}
