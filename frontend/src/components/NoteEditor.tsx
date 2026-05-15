import { useMemo, useEffect, useRef } from "react"
import "@yoopta/themes-shadcn/variables.css"
import YooptaEditor, { createYooptaEditor, type YooptaContentValue } from "@yoopta/editor"
import Paragraph from "@yoopta/paragraph"
import { HeadingOne, HeadingTwo } from "@yoopta/headings"
import Blockquote from "@yoopta/blockquote"
import { BulletedList, NumberedList } from "@yoopta/lists"
import { Code } from "@yoopta/code"
import { Bold, Italic, CodeMark, Underline, Strike } from "@yoopta/marks"
import { applyTheme } from "@yoopta/themes-shadcn"
import { FloatingToolbar, FloatingBlockActions, SlashCommandMenu } from "@yoopta/ui"

const plugins = applyTheme([
  Paragraph,
  HeadingOne,
  HeadingTwo,
  Blockquote,
  BulletedList,
  NumberedList,
  Code,
])

const marks = [Bold, Italic, CodeMark, Underline, Strike]

interface NoteEditorProps {
  content: string
  onChange: (html: string) => void
}

function parseContent(raw: string) {
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export function NoteEditor({ content, onChange }: NoteEditorProps) {
  const initialValue = useMemo(() => parseContent(content), [])
  const editorRef = useRef<ReturnType<typeof createYooptaEditor>>(null)

  const editor = useMemo(
    () => createYooptaEditor({ plugins, marks, value: initialValue }),
    [],
  )

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  const handleChange = (_value: YooptaContentValue, _options?: unknown) => {
    const ed = editorRef.current
    if (!ed) return
    const json = JSON.stringify(ed.children)
    onChange(json)
  }

  return (
    <div className="h-full flex flex-col">
      <YooptaEditor
        editor={editor}
        onChange={handleChange}
        placeholder="Type / to open menu..."
        autoFocus
        style={{ minHeight: "400px" }}
      >
        <FloatingToolbar />
        <FloatingBlockActions />
        <SlashCommandMenu />
      </YooptaEditor>
    </div>
  )
}
