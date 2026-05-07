import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Code2, Undo2, Redo2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useEffect } from "react"

interface NoteEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export function NoteEditor({ content, onChange, placeholder = "Start writing..." }: NoteEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3",
      },
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor) return null

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleBold().run()}
          data-active={editor.isActive("bold") ? "true" : "false"}
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          data-active={editor.isActive("italic") ? "true" : "false"}
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          data-active={editor.isActive("heading", { level: 1 }) ? "true" : "false"}
        >
          <Heading1 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          data-active={editor.isActive("heading", { level: 2 }) ? "true" : "false"}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          data-active={editor.isActive("bulletList") ? "true" : "false"}
        >
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          data-active={editor.isActive("orderedList") ? "true" : "false"}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          data-active={editor.isActive("codeBlock") ? "true" : "false"}
        >
          <Code2 className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
