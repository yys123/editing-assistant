import assert from 'node:assert/strict'
import {
  createRichEditorHistory,
  isMarkModuleShortcut,
  isUndoShortcut,
} from './richEditorShortcuts.ts'

assert.equal(isMarkModuleShortcut({ metaKey: true, ctrlKey: false, key: '=' }), true)
assert.equal(isMarkModuleShortcut({ metaKey: true, ctrlKey: false, key: '+' }), true)
assert.equal(isMarkModuleShortcut({ metaKey: false, ctrlKey: true, key: '=' }), false)
assert.equal(isMarkModuleShortcut({ metaKey: true, ctrlKey: false, key: '-' }), false)

assert.equal(isUndoShortcut({ metaKey: true, ctrlKey: false, shiftKey: false, key: 'z' }), true)
assert.equal(isUndoShortcut({ metaKey: true, ctrlKey: false, shiftKey: false, key: 'Z' }), true)
assert.equal(isUndoShortcut({ metaKey: true, ctrlKey: false, shiftKey: true, key: 'z' }), false)
assert.equal(isUndoShortcut({ metaKey: false, ctrlKey: true, shiftKey: false, key: 'z' }), false)

const history = createRichEditorHistory('alpha')

history.record('alpha')
history.record('beta')
history.record('gamma')
history.record('gamma')

assert.equal(history.undo('gamma'), 'beta')
assert.equal(history.undo('beta'), 'alpha')
assert.equal(history.undo('alpha'), null)

history.record('delta')
assert.equal(history.undo('delta'), 'alpha')

console.log('richEditorShortcuts tests passed')
