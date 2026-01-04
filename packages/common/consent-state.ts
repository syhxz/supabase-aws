'use client'

import type Usercentrics from '@usercentrics/cmp-browser-sdk'
import type { BaseCategory, UserDecision } from '@usercentrics/cmp-browser-sdk'
import { useState, useEffect } from 'react'
import { IS_PLATFORM, LOCAL_STORAGE_KEYS } from './constants'

// Simple state management without valtio
interface ConsentStateType {
  UC: Usercentrics | null
  categories: BaseCategory[] | null
  showConsentToast: boolean
  hasConsented: boolean
  acceptAll: () => void
  denyAll: () => void
  updateServices: (decisions: UserDecision[]) => void
}

let globalConsentState: ConsentStateType = {
  UC: null,
  categories: null,
  showConsentToast: false,
  hasConsented: false,
  acceptAll: () => {},
  denyAll: () => {},
  updateServices: () => {},
}

const listeners = new Set<() => void>()

const notifyListeners = () => {
  listeners.forEach(listener => listener())
}

export const consentState = {
  get UC() { return globalConsentState.UC },
  set UC(value: Usercentrics | null) { 
    globalConsentState.UC = value
    notifyListeners()
  },
  get categories() { return globalConsentState.categories },
  set categories(value: BaseCategory[] | null) { 
    globalConsentState.categories = value
    notifyListeners()
  },
  get showConsentToast() { return globalConsentState.showConsentToast },
  set showConsentToast(value: boolean) { 
    globalConsentState.showConsentToast = value
    notifyListeners()
  },
  get hasConsented() { return globalConsentState.hasConsented },
  set hasConsented(value: boolean) { 
    globalConsentState.hasConsented = value
    notifyListeners()
  },
  acceptAll: () => {
    if (!consentState.UC) return
    const previousConsentValue = consentState.hasConsented

    consentState.hasConsented = true
    consentState.showConsentToast = false

    consentState.UC.acceptAllServices()
      .then(() => {
        consentState.categories = consentState.UC?.getCategoriesBaseInfo() ?? null
      })
      .catch(() => {
        consentState.hasConsented = previousConsentValue
        consentState.showConsentToast = true
      })
  },
  denyAll: () => {
    if (!consentState.UC) return
    const previousConsentValue = consentState.hasConsented

    consentState.hasConsented = false
    consentState.showConsentToast = false

    consentState.UC.denyAllServices()
      .then(() => {
        consentState.categories = consentState.UC?.getCategoriesBaseInfo() ?? null
      })
      .catch(() => {
        consentState.showConsentToast = previousConsentValue
      })
  },
  updateServices: (decisions: UserDecision[]) => {
    if (!consentState.UC) return

    consentState.showConsentToast = false

    consentState.UC.updateServices(decisions)
      .then(() => {
        consentState.hasConsented = consentState.UC?.areAllConsentsAccepted() ?? false
        consentState.categories = consentState.UC?.getCategoriesBaseInfo() ?? null
      })
      .catch(() => {
        consentState.showConsentToast = true
      })
  },
}

async function initUserCentrics() {
  if (process.env.NODE_ENV === 'test' || !IS_PLATFORM) return

  // [Alaister] For local development and staging, we accept all consent by default.
  // If you need to test usercentrics in these environments, comment out this
  // NEXT_PUBLIC_ENVIRONMENT check and add an ngrok domain to usercentrics
  if (
    process.env.NEXT_PUBLIC_ENVIRONMENT === 'local' ||
    process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging'
  ) {
    consentState.hasConsented = true
    return
  }

  const { default: Usercentrics } = await import('@usercentrics/cmp-browser-sdk')

  const UC = new Usercentrics(process.env.NEXT_PUBLIC_USERCENTRICS_RULESET_ID!, {
    rulesetId: process.env.NEXT_PUBLIC_USERCENTRICS_RULESET_ID,
    useRulesetId: true,
  })

  const initialUIValues = await UC.init()

  consentState.UC = UC
  const hasConsented = UC.areAllConsentsAccepted()

  // 0 = first layer, aka show consent toast
  consentState.showConsentToast = initialUIValues.initialLayer === 0
  consentState.hasConsented = hasConsented
  consentState.categories = UC.getCategoriesBaseInfo()

  // If the user has previously consented (before usercentrics), accept all services
  if (!hasConsented && localStorage?.getItem(LOCAL_STORAGE_KEYS.TELEMETRY_CONSENT) === 'true') {
    consentState.acceptAll()
    localStorage.removeItem(LOCAL_STORAGE_KEYS.TELEMETRY_CONSENT)
  }
}

// Usercentrics is not available on the server
if (typeof window !== 'undefined') {
  initUserCentrics()
}

// Public API for consent

export function hasConsented() {
  return globalConsentState.hasConsented
}

export function useConsentState() {
  const [state, setState] = useState(globalConsentState)
  
  useEffect(() => {
    const listener = () => setState({ ...globalConsentState })
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, [])

  return {
    hasAccepted: state.hasConsented,
    categories: state.categories as BaseCategory[] | null,
    acceptAll: consentState.acceptAll,
    denyAll: consentState.denyAll,
    updateServices: consentState.updateServices,
  }
}
