import assert from 'node:assert/strict'
import { shouldPrependRecoveredNumbering } from './entryLibraryNumbering.ts'

assert.equal(shouldPrependRecoveredNumbering('定义', '一、 '), true)
assert.equal(shouldPrependRecoveredNumbering('一、 定义', '一、 '), false)
assert.equal(shouldPrependRecoveredNumbering('一、定义', '一、 '), false)
assert.equal(shouldPrependRecoveredNumbering('（一）遗传易感性', '（一）'), false)
assert.equal(shouldPrependRecoveredNumbering('(一) 遗传易感性', '（一）'), false)
assert.equal(shouldPrependRecoveredNumbering('1、 遗传风险', '1、 '), false)
assert.equal(shouldPrependRecoveredNumbering('1. 遗传风险', '1. '), false)
assert.equal(shouldPrependRecoveredNumbering('(1) 遗传风险', '(1)'), false)
assert.equal(shouldPrependRecoveredNumbering('四、 诊断', '九、 '), false)
assert.equal(shouldPrependRecoveredNumbering('2、 遗传风险', '1、 '), false)
assert.equal(shouldPrependRecoveredNumbering('1.5 mg/kg', '1、 '), true)

console.log('entryLibraryNumbering tests passed')
