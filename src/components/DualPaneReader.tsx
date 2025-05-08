'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Section = {
  id: string
  sequence: number
  full_text: string
  summary: string
}

export default function DualPaneReader() {
  const [sections, setSections] = useState<Section[]>([])
  const [ratio, setRatio] = useState<'1:3' | '1:5' | '1:10'>('1:3')
  const [currentId, setCurrentId] = useState<string>('')

  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const isSyncing = useRef(false)

  // load sections (with sequence) + summaries
  useEffect(() => {
    async function load() {
      const bookId = process.env.NEXT_PUBLIC_BOOK_ID!
      // 1) fetch id, sequence, full_text
      const { data: secs, error: secErr } = await supabase
        .from('sections')
        .select('id, sequence, full_text')
        .eq('book_id', bookId)
        .order('sequence', { ascending: true })
      if (secErr) return console.error(secErr)

      const ids = secs.map((s) => s.id)
      // 2) fetch summaries for those section_ids & ratio
      const { data: sums, error: sumErr } = await supabase
        .from('summaries')
        .select('section_id, summary_text')
        .in('section_id', ids)
        .eq('ratio', ratio)
      if (sumErr) return console.error(sumErr)

      const map = new Map<string, string>()
      sums.forEach((s) => map.set(s.section_id, s.summary_text))

      const merged: Section[] = secs.map((s) => ({
        id: s.id,
        sequence: s.sequence,
        full_text: s.full_text,
        summary: map.get(s.id) ?? ''
      }))

      setSections(merged)
      // preserve currentId if still present, else default to first
      if (merged.length) {
        const exists = merged.some((s) => s.id === currentId)
        setCurrentId(exists ? currentId : merged[0].id)
      }
    }
    load()
  }, [ratio])

  // percent‐based scroll sync
  useEffect(() => {
    const left = leftRef.current
    const right = rightRef.current
    if (!left || !right) return

    const sync = (src: HTMLElement, dst: HTMLElement) => {
      if (isSyncing.current) return
      isSyncing.current = true
      const pct =
        src.scrollTop / (src.scrollHeight - src.clientHeight) || 0
      dst.scrollTop = pct * (dst.scrollHeight - dst.clientHeight)
      requestAnimationFrame(() => {
        isSyncing.current = false
      })
    }

    const onLeft = () => sync(left, right)
    const onRight = () => sync(right, left)

    left.addEventListener('scroll', onLeft)
    right.addEventListener('scroll', onRight)
    return () => {
      left.removeEventListener('scroll', onLeft)
      right.removeEventListener('scroll', onRight)
    }
  }, [sections, currentId])

  const current = sections.find((s) => s.id === currentId)

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Controls */}
      <div className="p-4 bg-gray-800 flex items-center space-x-4">
        <label className="font-medium">Section:</label>
        <select
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1"
          value={currentId}
          onChange={(e) => setCurrentId(e.target.value)}
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              Section {s.sequence}
            </option>
          ))}
        </select>

        <label className="font-medium">Ratio:</label>
        <select
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1"
          value={ratio}
          onChange={(e) => setRatio(e.target.value as any)}
        >
          <option value="1:3">1:3</option>
          <option value="1:5">1:5</option>
          <option value="1:10">1:10</option>
        </select>
      </div>

      {/* Panes */}
      <div className="flex flex-1 overflow-hidden">
        <div
          ref={leftRef}
          className="w-1/2 p-6 overflow-y-auto bg-gray-900 text-gray-100"
        >
          <div className="whitespace-pre-wrap">{current?.full_text}</div>
        </div>
        <div
          ref={rightRef}
          className="w-1/2 p-6 overflow-y-auto bg-gray-800 text-gray-300"
        >
          <div className="italic whitespace-pre-wrap">
            {current?.summary}
          </div>
        </div>
      </div>
    </div>
  )
}
