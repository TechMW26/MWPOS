'use client'

import { useEffect } from 'react'
import { initNativeBridge } from '@/lib/firebase/native-bridge'

export function NativeFcmBridge () {
  useEffect(() => {
    initNativeBridge()
  }, [])

  return null
}
