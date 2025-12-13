// client/src/utils/monacoCursors.ts
import type * as monaco from 'monaco-editor'

export type RemoteCursor = {
  userId: string
  username: string
  color?: string
  position: { lineNumber: number; column: number }
}

export class CursorOverlayManager {
  private editor: monaco.editor.IStandaloneCodeEditor
  private decorationsByUser: Map<string, string[]> = new Map()

  constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor
  }

  /** Insert or update a remote cursor */
  upsert(cursor: RemoteCursor) {
    if (!cursor?.position) return

    const range = new (window as any).monaco.Range(
      cursor.position.lineNumber,
      cursor.position.column,
      cursor.position.lineNumber,
      cursor.position.column
    )

    const className = this.ensureStyle(cursor.userId, cursor.color || '#22c55e')

    const newDecos: monaco.editor.IModelDeltaDecoration[] = [
      {
        // vertical caret
        range,
        options: {
          className,
          stickiness:
            (window as any).monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      },
      {
        // label above caret
        range,
        options: {
          beforeContentClassName: `${className}-label`,
          stickiness:
            (window as any).monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          // Attach username as data attribute (visible in ::before)
          inlineClassName: '',
          before: {
            content: cursor.username,
          },
        },
      },
    ]

    const old = this.decorationsByUser.get(cursor.userId) || []
    const applied = this.editor.deltaDecorations(old, newDecos)
    this.decorationsByUser.set(cursor.userId, applied)
  }

  /** Remove a user's cursor decorations */
  remove(userId: string) {
    const old = this.decorationsByUser.get(userId)
    if (!old?.length) return
    this.editor.deltaDecorations(old, [])
    this.decorationsByUser.delete(userId)
  }

  /** Remove all remote cursor decorations */
  dispose() {
    for (const [userId, decos] of this.decorationsByUser.entries()) {
      this.editor.deltaDecorations(decos, [])
      this.decorationsByUser.delete(userId)
    }
  }

  /** Ensures CSS styles are injected once per user */
  private ensureStyle(userId: string, color: string) {
    const base = `remote-cursor-${userId}`
    if (document.getElementById(base)) return base

    const style = document.createElement('style')
    style.id = base
    style.innerHTML = `
      .${base} {
        border-left: 2px solid ${color};
      }
      .${base}-label::before {
        content: attr(data-content);
      }
      .${base}-label {
        position: absolute;
        transform: translateY(-16px);
        padding: 1px 6px;
        border-radius: 6px;
        font-size: 10px;
        line-height: 14px;
        color: #0b1221;
        background: ${color};
        box-shadow: 0 1px 4px rgba(0,0,0,.25);
      }
    `
    document.head.appendChild(style)
    return base
  }
}
