'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ここを好きなパスワードに変えてOK
const ADMIN_PASSWORD = 'idea3reason'

export default function AdminPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  // ページを開いたときに、すでに認証済みか確認
  useEffect(() => {
    const saved = sessionStorage.getItem('admin_authenticated')
    if (saved === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      sessionStorage.setItem('admin_authenticated', 'true')
      setPasswordError('')
    } else {
      setPasswordError('パスワードが違います')
    }
  }

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
      
      setTimeout(() => {
        router.push('/')
      }, 1500)
    }

    setSubmitting(false)
  }

  // まだ認証されていない場合はパスワード入力画面
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-sm w-full bg-white p-6 rounded-lg shadow">
          <h1 className="text-xl font-bold mb-4 text-center">管理画面ログイン</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">パスワード</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full border rounded p-2"
                placeholder="パスワードを入力"
                required
              />
            </div>
            {passwordError && (
              <p className="text-red-600 text-sm">{passwordError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              ログイン
            </button>
          </form>
          <Link href="/" className="block text-center text-sm text-blue-600 mt-4 hover:underline">
            ホームに戻る
          </Link>
        </div>
      </main>
    )
  }

  // 認証後の管理画面
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
      </div>
    </main>
  )
}