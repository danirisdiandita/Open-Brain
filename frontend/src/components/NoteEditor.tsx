import { useCallback } from "react"
import { EditorRoot, EditorContent, type EditorInstance, StarterKit, Placeholder } from "novel"

const defaultContent = { type: "doc", content: [] }

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2] },
  }),
  Placeholder,
]

interface NoteEditorProps {
  content: string
  onChange: (html: string) => void
}

export function NoteEditor({ content, onChange }: NoteEditorProps) {
  const handleUpdate = useCallback(
    ({ editor }: { editor: EditorInstance }) => {
      onChange(editor.getHTML())
    },
    [onChange],
  )

  const initialContent = (() => {
    if (!content) return defaultContent
    try {
      return JSON.parse(content)
    } catch {
      return content
    }
  })()

  return (
    <EditorRoot>
      <EditorContent
        initialContent={initialContent}
        extensions={extensions}
        onUpdate={handleUpdate}
      />
    </EditorRoot>
  )
}
