import { h } from '../dom'

/** Page header with optional back button and right-hand action. */
export function pageHead(title: string, opts: { back?: string; action?: HTMLElement } = {}): HTMLElement {
  return h('div', { class: 'page-head' },
    opts.back ? h('a', { class: 'back', href: '#' + opts.back }, '‹') : null,
    h('h1', {}, title),
    opts.action ?? null,
  )
}

export function loading(): HTMLElement {
  return h('p', { class: 'muted', style: 'text-align:center;padding:40px' }, 'Loading…')
}

export function empty(icon: string, title: string, sub?: string): HTMLElement {
  return h('div', { class: 'empty' },
    h('div', { class: 'big' }, icon),
    h('div', {}, title),
    sub ? h('p', { class: 'muted' }, sub) : null,
  )
}
