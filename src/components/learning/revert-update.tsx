'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/primitives'

export function RevertUpdate({ externalId }: { externalId: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const revert = async () => {
    setStatus('running')
    try {
      const response = await fetch('/api/learning/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalId }),
      })
      const body = (await response.json()) as { reverted?: boolean; reason?: string; error?: { message?: string } }
      if (!response.ok) throw new Error(body.reason ?? body.error?.message ?? `Revert failed (HTTP ${response.status})`)
      router.refresh()
      setStatus('idle')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button variant="ghost" size="sm" onClick={revert} disabled={status === 'running'}>
        {status === 'running' ? <Loader2 aria-hidden size={12} className="animate-spin" /> : <Undo2 aria-hidden size={12} />}
        Revert
      </Button>
      {status === 'error' ? <span className="max-w-[160px] text-right text-[10px] text-danger">{message}</span> : null}
    </span>
  )
}
