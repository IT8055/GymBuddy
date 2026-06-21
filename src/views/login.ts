import { h, toast } from '../dom'
import { api } from '../api'
import { auth } from '../state'
import { navigate } from '../router'
import type { User } from '../types'

export function loginView(): HTMLElement {
  let email = ''

  const emailStep = h('div', { class: 'stack' })
  const codeStep = h('div', { class: 'stack hidden' })

  // --- Step 1: email ---
  const emailInput = h('input', {
    type: 'email', inputmode: 'email', autocomplete: 'email',
    placeholder: 'you@example.com', value: '',
  }) as HTMLInputElement
  const sendBtn = h('button', { class: 'btn btn-primary', onClick: sendCode }, 'Send me a code')
  emailStep.append(
    h('div', { class: 'field' }, h('label', {}, 'Email address'), emailInput),
    sendBtn,
  )

  // --- Step 2: code ---
  const codeInput = h('input', {
    type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code',
    maxlength: '6', placeholder: '123456', style: 'letter-spacing:8px;text-align:center;font-size:1.5rem',
  }) as HTMLInputElement
  const verifyBtn = h('button', { class: 'btn btn-primary', onClick: verify }, 'Verify & sign in')
  const devNote = h('p', { class: 'muted hidden' })
  codeStep.append(
    h('p', { class: 'muted' }, 'We emailed a 6-digit code. Enter it below.'),
    h('div', { class: 'field' }, h('label', {}, 'Login code'), codeInput),
    verifyBtn,
    h('button', { class: 'btn btn-ghost', onClick: () => { codeStep.classList.add('hidden'); emailStep.classList.remove('hidden') } }, 'Use a different email'),
    devNote,
  )

  async function sendCode() {
    email = emailInput.value.trim().toLowerCase()
    if (!email) return toast('Enter your email', 'error')
    sendBtn.textContent = 'Sending…'
    ;(sendBtn as HTMLButtonElement).disabled = true
    try {
      const r = await api.post<{ ok: boolean; dev_logged: boolean }>('/auth/request', { email })
      emailStep.classList.add('hidden')
      codeStep.classList.remove('hidden')
      codeInput.focus()
      if (r.dev_logged) {
        devNote.textContent = 'Dev mode: the code was written to api/data/mail.log instead of emailed.'
        devNote.classList.remove('hidden')
      }
    } catch (e: any) {
      toast(e.message || 'Could not send code', 'error')
    } finally {
      sendBtn.textContent = 'Send me a code'
      ;(sendBtn as HTMLButtonElement).disabled = false
    }
  }

  async function verify() {
    const code = codeInput.value.trim()
    if (code.length < 6) return toast('Enter the 6-digit code', 'error')
    verifyBtn.textContent = 'Verifying…'
    ;(verifyBtn as HTMLButtonElement).disabled = true
    try {
      const r = await api.post<{ token: string; user: User }>('/auth/verify', { email, code })
      auth.login(r.token, r.user)
      navigate('/')
    } catch (e: any) {
      toast(e.message || 'Invalid code', 'error')
    } finally {
      verifyBtn.textContent = 'Verify & sign in'
      ;(verifyBtn as HTMLButtonElement).disabled = false
    }
  }

  emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendCode() })
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') verify() })

  return h('div', { class: 'login-wrap' },
    h('div', { class: 'logo-badge' }, '💪'),
    h('h1', {}, 'GymBuddy'),
    h('p', { class: 'muted', style: 'margin-bottom:24px' }, 'Build workouts. Run them. Track every set.'),
    emailStep,
    codeStep,
  )
}
