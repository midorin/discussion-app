'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Topic = {
  id: string
  title: string
  description: string | null
  deadline: string
}

type Post = {
  id: string
  nickname: string
  opinion: string
  reason1: string
  reason2: string
  reason3: string
  created_at: string
}

export default function TopicPage() {
  const params = useParams()
  const topicId = params.id as string

  const [topic, setTopic] = useState<Topic | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // フォーム用
  const [nickname, setNickname] = useState('')
  const [opinion, setOpinion] = useState('')
  const [reason1, setReason1] = useState('')
  const [reason2, setReason2] = useState('')
  const [reason3, setReason3] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // ニックネームをlocalStorageから取得
    const saved = localStorage.getItem('nickname')
    if (saved) setNickname(saved)

    const fetchData = async () => {
      const { data: topicData } = await supabase
        .from('topics')
        .select('*')
        .eq('id', topicId)
        .single()

      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: false })

      setTopic(topicData)
      setPosts(postsData || [])
      setLoading(false)
    }

    fetchData()
  }, [topicId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!opinion || !reason1 || !reason2 || !reason3 || !nickname) {
      alert('すべての項目を入力してください')
      return
    }

    setSubmitting(true)

    // ニックネームを保存
    localStorage.setItem('nickname', nickname)

    const { error } = await supabase.from('posts').insert({
      topic_id: topicId,
      nickname,
      opinion,
      reason1,
      reason2,
      reason3,
    })

    if (error) {
      alert('投稿に失敗しました')
      console.error(error)
    } else {
      // フォームをリセット
      setOpinion('')
      setReason1('')
      setReason2('')
      setReason3('')
      setShowForm(false)

      // 投稿一覧を再取得
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: false })
      setPosts(data || [])
    }

    setSubmitting(false)
  }

  if (loading) return <div className="p-8">読み込み中...</div>
  if (!topic) return <div className="p-8">お題が見つかりません</div>

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 pb-24">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          ← 戻る
        </Link>

        <div className="bg-white p-5 rounded-lg shadow mb-6">
          <h1 className="text-xl font-bold">{topic.title}</h1>
          {topic.description && (
            <p className="text-gray-600 mt-2">{topic.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-3">
            期限: {new Date(topic.deadline).toLocaleDateString('ja-JP')}
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <h2 className="font-semibold text-gray-700">投稿一覧</h2>

          {posts.length === 0 ? (
            <p className="text-gray-500 text-sm">まだ投稿がありません</p>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between text-sm text-gray-500 mb-2">
                  <span>{post.nickname}</span>
                  <span>{new Date(post.created_at).toLocaleString('ja-JP')}</span>
                </div>
                <p className="font-medium mb-3">{post.opinion}</p>
                <div className="space-y-1 text-sm text-gray-700">
                  <p><span className="font-semibold">理由1:</span> {post.reason1}</p>
                  <p><span className="font-semibold">理由2:</span> {post.reason2}</p>
                  <p><span className="font-semibold">理由3:</span> {post.reason3}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 投稿フォーム */}
        {showForm ? (
          <div className="bg-white p-5 rounded-lg shadow fixed bottom-0 left-0 right-0 md:static md:bottom-auto max-w-2xl mx-auto">
            <h3 className="font-bold mb-4">意見を書く</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm font-medium">ニックネーム</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">あなたの意見</label>
                <textarea
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  rows={2}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">理由1（必須）</label>
                <textarea
                  value={reason1}
                  onChange={(e) => setReason1(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  rows={2}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">理由2（必須）</label>
                <textarea
                  value={reason2}
                  onChange={(e) => setReason2(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  rows={2}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">理由3（必須）</label>
                <textarea
                  value={reason3}
                  onChange={(e) => setReason3(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  rows={2}
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border rounded py-2"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white rounded py-2 disabled:opacity-50"
                >
                  {submitting ? '投稿中...' : '投稿する'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="fixed bottom-6 right-6 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700"
          >
            意見を書く
          </button>
        )}
      </div>
    </main>
  )
}