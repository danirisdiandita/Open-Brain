import { useState, useEffect, useCallback } from "react"
import {
  EditorRoot,
  EditorContent,
  handleCommandNavigation,
  type EditorInstance,
} from "novel"

interface NoteEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export function NoteEditor({ content, onChange, placeholder = "Start writing..." }: NoteEditorProps) {
  const [initialContent, setInitialContent] = useState<any>(null)

  useEffect(() => {
    if (content) {
      try {
        setInitialContent(JSON.parse(content))
      } catch {
        setInitialContent(content)
      }
    } else {
      setInitialContent(undefined)
    }
  }, [])

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
          initialContent={initialContent}
          onUpdate={handleUpdate}
          editorProps={{
            handleDOMEvents: {
              keydown: (_view: unknown, event: KeyboardEvent) => handleCommandNavigation(event),
            },
            attributes: {
              class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px]",
            },
          }}
        >
          <div data-placeholder={placeholder} />
        </EditorContent>
      </EditorRoot>
    </div>
  )
}
