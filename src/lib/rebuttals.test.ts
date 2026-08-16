import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canRebut,
  isReasonIndex,
  isUniqueViolation,
  validateRebuttalInput,
} from './rebuttals'

test('isReasonIndex accepts 1-3 only', () => {
  assert.equal(isReasonIndex(1), true)
  assert.equal(isReasonIndex(3), true)
  assert.equal(isReasonIndex(0), false)
  assert.equal(isReasonIndex(4), false)
})

test('validateRebuttalInput requires all fields', () => {
  const ok = validateRebuttalInput({
    nickname: 'A',
    claim: '反対',
    reason1: 'r1',
    reason2: 'r2',
    reason3: 'r3',
    reason_index: 2,
  })
  assert.equal(ok, null)

  const bad = validateRebuttalInput({
    nickname: '',
    claim: '反対',
    reason1: 'r1',
    reason2: 'r2',
    reason3: 'r3',
    reason_index: 2,
  })
  assert.notEqual(bad, null)
})

test('canRebut blocks self and duplicate nickname on same reason', () => {
  assert.equal(
    canRebut({
      viewerNickname: 'Alice',
      postNickname: 'Alice',
      existingRebuttals: [],
      reasonIndex: 1,
    }),
    false,
  )

  assert.equal(
    canRebut({
      viewerNickname: 'Bob',
      postNickname: 'Alice',
      existingRebuttals: [{ nickname: 'Bob', reason_index: 1 }],
      reasonIndex: 1,
    }),
    false,
  )

  assert.equal(
    canRebut({
      viewerNickname: 'Bob',
      postNickname: 'Alice',
      existingRebuttals: [{ nickname: 'Bob', reason_index: 1 }],
      reasonIndex: 2,
    }),
    true,
  )
})

test('isUniqueViolation detects 23505', () => {
  assert.equal(isUniqueViolation({ code: '23505' }), true)
  assert.equal(isUniqueViolation({ code: '42501' }), false)
  assert.equal(isUniqueViolation(null), false)
})
