interface ShortcutLikeEvent {
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  key: string
}

export function isMarkModuleShortcut(event: ShortcutLikeEvent) {
  return Boolean(event.metaKey && !event.ctrlKey && (event.key === '=' || event.key === '+'))
}

export function isUndoShortcut(event: ShortcutLikeEvent) {
  return Boolean(event.metaKey && !event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'z')
}

export function createRichEditorHistory(initialHtml = '') {
  const stack: string[] = [initialHtml]

  return {
    reset(html: string) {
      stack.splice(0, stack.length, html)
    },
    record(html: string) {
      if (stack[stack.length - 1] === html) return
      stack.push(html)
      if (stack.length > 100) stack.shift()
    },
    undo(currentHtml: string) {
      if (stack[stack.length - 1] !== currentHtml) {
        this.record(currentHtml)
      }
      if (stack.length <= 1) return null
      stack.pop()
      return stack[stack.length - 1]
    },
  }
}
