export type ReasonIndex = 1 | 2 | 3

export type Rebuttal = {
  id: string
  post_id: string
  reason_index: ReasonIndex
  nickname: string
  claim: string
  reason1: string
  reason2: string
  reason3: string
  created_at: string
}

export function isReasonIndex(value: number): value is ReasonIndex {
  return value === 1 || value === 2 || value === 3
}

export function validateRebuttalInput(input: {
  nickname: string
  claim: string
  reason1: string
  reason2: string
  reason3: string
  reason_index: number
}): string | null {
  if (!input.nickname.trim() || !input.claim.trim() || !input.reason1.trim() || !input.reason2.trim() || !input.reason3.trim()) {
    return 'すべての項目を入力してください'
  }
  if (!isReasonIndex(input.reason_index)) {
    return '反論する理由を選んでください'
  }
  return null
}

export function canRebut(args: {
  viewerNickname: string
  postNickname: string
  existingRebuttals: Pick<Rebuttal, 'nickname' | 'reason_index'>[]
  reasonIndex: ReasonIndex
}): boolean {
  const viewer = args.viewerNickname.trim()
  if (!viewer) return true // 未入力時はボタン表示可（送信時に必須チェック）
  if (viewer === args.postNickname.trim()) return false
  return !args.existingRebuttals.some(
    (r) => r.reason_index === args.reasonIndex && r.nickname.trim() === viewer,
  )
}

export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505'
}
