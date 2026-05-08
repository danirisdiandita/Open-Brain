import { useCallback } from "react"
import { Extension } from "@tiptap/core"
import { EditorRoot, EditorContent, type EditorInstance, StarterKit, Placeholder } from "novel"

const TabHandler = Extension.create({
  name: "tabHandler",
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (editor.isActive("codeBlock")) {
          editor.commands.insertContent("  ")
        } else {
          editor.commands.insertContent("\t")
        }
        return true
      },
      "Shift-Tab": () => {
        return true
      },
    }
  },
})

const defaultContent = { type: "doc", content: [] }

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2] },
  }),
  Placeholder,
  TabHandler,
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
    <div className="h-full">
      <EditorRoot>
        <EditorContent
          initialContent={initialContent}
          extensions={extensions}
          onUpdate={handleUpdate}
          editorProps={{
            attributes: {
              class: "prose prose-sm max-w-none focus:outline-none min-h-full p-4",
            },
          }}
        />
      </EditorRoot>
    </div>
  )
}
