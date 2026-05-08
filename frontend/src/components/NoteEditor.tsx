import { useCallback } from "react"
import {
  EditorRoot,
  EditorContent,
  handleCommandNavigation,
  type EditorInstance,
} from "novel"

const defaultContent = {
  type: "doc",
  content: [],
}

interface NoteEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

function parseContent(html: string) {
  if (!html) return undefined
  try {
    return JSON.parse(html)
  } catch {
    return html
  }
}

export function NoteEditor({ content, onChange, placeholder = "Start writing..." }: NoteEditorProps) {
  const handleUpdate = useCallback(
    ({ editor }: { editor: EditorInstance }) => {
      onChange(editor.getHTML())
    },
    [onChange],
  )

  return (
    <div className="relative w-full border rounded-lg bg-background">
      <EditorRoot>
        <EditorContent
          initialContent={parseContent(content) || defaultContent}
          onUpdate={handleUpdate}
          editorProps={{
            handleDOMEvents: {
              keydown: (_view: unknown, event: KeyboardEvent) => handleCommandNavigation(event),
            },
            attributes: {
              class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-4 py-3",
              "data-placeholder": placeholder,
            },
          }}
        />
      </EditorRoot>
    </div>
  )
}
