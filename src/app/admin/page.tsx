'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title || !deadline) {
      alert('タイトルと期限は必須です')
      return
    }

    setSubmitting(true)
    setMessage('')

    const { error } = await supabase.from('topics').insert({
      title,
      description: description || null,
      deadline: new Date(deadline).toISOString(),
      is_active: true,
    })

    if (error) {
      setMessage('追加に失敗しました')
      console.error(error)
    } else {
      setMessage('お題を追加しました！')
      setTitle('')
      setDescription('')
      setDeadline('')
      
      // 2秒後にホームに戻る
      setTimeout(() => {
        router.push('/')
      }, 1500)
    }

    setSubmitting(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          ← ホームに戻る
        </Link>

        <h1 className="text-2xl font-bold mb-6">お題を追加（管理画面）</h1>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">お題タイトル *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded p-2"
              placeholder="例: リモートワークは生産性を上げるか？"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">説明（任意）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded p-2"
              rows={3}
              placeholder="お題の補足説明"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">期限 *</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full border rounded p-2"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '追加中...' : 'お題を追加する'}
          </button>

          {message && (
            <p className={`text-center text-sm ${message.includes('失敗') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </p>
          )}
        </form>

        <p className="text-xs text-gray-400 mt-4 text-center">
          ※ プロトタイプのため認証はありません
        </p>
      </div>
    </main>
  )
}