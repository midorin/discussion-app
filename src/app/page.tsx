'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Topic = {
  id: string
  title: string
  description: string | null
  deadline: string
  is_active: boolean
  created_at: string
}

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTopics = async () => {
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
      } else {
        setTopics(data || [])
      }
      setLoading(false)
    }

    fetchTopics()
  }, [])

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">議論アプリ</h1>

        {loading ? (
          <p>読み込み中...</p>
        ) : topics.length === 0 ? (
          <p className="text-gray-500">現在進行中のお題はありません</p>
        ) : (
          <div className="space-y-4">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                href={`/topics/${topic.id}`}
                className="block bg-white p-4 rounded-lg shadow hover:shadow-md transition"
              >
                <h2 className="text-lg font-semibold">{topic.title}</h2>
                {topic.description && (
                  <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                    {topic.description}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  期限: {new Date(topic.deadline).toLocaleDateString('ja-JP')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}