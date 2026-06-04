"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { EditorContent, EditorContext, useEditor } from "@tiptap/react";

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TextAlign } from "@tiptap/extension-text-align";
import { Typography } from "@tiptap/extension-typography";
import { Highlight } from "@tiptap/extension-highlight";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Selection } from "@tiptap/extensions";

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button";
import { Spacer } from "@/components/tiptap-ui-primitive/spacer";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar";

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension";
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension";
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss";
import "@/components/tiptap-node/code-block-node/code-block-node.scss";
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss";
import "@/components/tiptap-node/list-node/list-node.scss";
import "@/components/tiptap-node/image-node/image-node.scss";
import "@/components/tiptap-node/heading-node/heading-node.scss";
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss";

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu";
import {
  ImageUploadButton,
  useImageUpload,
} from "@/components/tiptap-ui/image-upload-button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/tiptap-ui-primitive/popover";
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu";
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button";
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button";
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover";
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover";
import { MarkButton } from "@/components/tiptap-ui/mark-button";
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button";
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button";

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon";
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon";
import { LinkIcon } from "@/components/tiptap-icons/link-icon";

// --- Hooks ---
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint";
import { useWindowSize } from "@/hooks/use-window-size";
import { useCursorVisibility } from "@/hooks/use-cursor-visibility";

// --- Components ---
import { ThemeToggle } from "@/components/tiptap-templates/simple/theme-toggle";

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils";

// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss";

import content from "@/components/tiptap-templates/simple/data/content.json";

function ImageAddPopover({
  text,
  imageAttachments,
  fetchAttachmentUrl,
  onInsert,
}: {
  text?: string;
  imageAttachments?: { id: string; filename: string }[];
  fetchAttachmentUrl?: (id: string) => Promise<string>;
  onInsert?: (url: string, filename: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { handleImage, canInsert, isVisible, Icon, label } = useImageUpload({});

  if (!isVisible) return null;

  const handleInsertFromAttachment = async (att: {
    id: string;
    filename: string;
  }) => {
    if (!fetchAttachmentUrl || !onInsert) return;
    setLoadingId(att.id);
    try {
      const url = await fetchAttachmentUrl(att.id);
      onInsert(url, att.filename);
      setOpen(false);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={!canInsert}
          tooltip={label}
        >
          <Icon className="tiptap-button-icon" />
          {text && <span className="tiptap-button-text">{text}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 bg-background border shadow-md rounded-lg" align="start">
        <div className="p-2 border-b">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-sm"
            onClick={() => {
              handleImage();
              setOpen(false);
            }}
          >
            <Icon className="tiptap-button-icon mr-2 h-4 w-4" />
            Upload from device
          </Button>
        </div>
        {imageAttachments && imageAttachments.length > 0 ? (
          <div className="p-2">
            <p className="text-xs text-muted-foreground mb-2 px-2">
              From attachments
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {imageAttachments.map((att) => (
                <button
                  key={att.id}
                  disabled={loadingId === att.id}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors truncate flex items-center gap-2 disabled:opacity-50"
                  onClick={() => handleInsertFromAttachment(att)}
                >
                  {loadingId === att.id ? (
                    <span className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : (
                    <span className="shrink-0 text-xs">🖼</span>
                  )}
                  <span className="truncate">{att.filename}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground p-3 text-center">
            No image attachments yet
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
  imageAttachments,
  fetchAttachmentUrl,
  onInsertAttachmentImage,
}: {
  onHighlighterClick: () => void;
  onLinkClick: () => void;
  isMobile: boolean;
  imageAttachments?: { id: string; filename: string }[];
  fetchAttachmentUrl?: (id: string) => Promise<string>;
  onInsertAttachmentImage?: (url: string, filename: string) => void;
}) => {
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu modal={false} levels={[1, 2, 3, 4]} />
        <ListDropdownMenu
          modal={false}
          types={["bulletList", "orderedList", "taskList"]}
        />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ImageAddPopover
          imageAttachments={imageAttachments}
          fetchAttachmentUrl={fetchAttachmentUrl}
          onInsert={onInsertAttachmentImage}
          text="Add"
        />
      </ToolbarGroup>

      <Spacer />

      {isMobile && <ToolbarSeparator />}

      <ToolbarGroup>
        <ThemeToggle />
      </ToolbarGroup>
    </>
  );
};

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "link";
  onBack: () => void;
}) => (
  <>
    <ToolbarGroup>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
);

export function SimpleEditor({
  content: initialContent,
  onChange,
  uploadImage,
  imageAttachments,
  fetchAttachmentUrl,
}: {
  content?: string;
  onChange?: (json: string) => void;
  uploadImage?: (
    file: File,
    onProgress?: (event: { progress: number }) => void,
  ) => Promise<string>;
  imageAttachments?: { id: string; filename: string }[];
  fetchAttachmentUrl?: (id: string) => Promise<string>;
}) {
  const isMobile = useIsBreakpoint();
  const { height } = useWindowSize();
  const [mobileView, setMobileView] = useState<"main" | "highlighter" | "link">(
    "main",
  );
  const toolbarRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: uploadImage || handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
    ],
    content: initialContent
      ? (() => {
          try {
            return JSON.parse(initialContent);
          } catch {
            return initialContent;
          }
        })()
      : content,
    onUpdate: onChange
      ? ({ editor: ed }) => {
          onChange(JSON.stringify(ed.getJSON()));
        }
      : undefined,
  });

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  });

  const handleInsertAttachmentImage = useCallback(
    (url: string, filename: string) => {
      editor
        ?.chain()
        .focus()
        .setImage({ src: url, alt: filename, title: filename })
        .run();
    },
    [editor],
  );

  useEffect(() => {
    if (!isMobile && mobileView !== "main") {
      setMobileView("main");
    }
  }, [isMobile, mobileView]);

  return (
    <div className="simple-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        <Toolbar
          ref={toolbarRef}
          style={{
            ...(isMobile
              ? {
                  bottom: `calc(100% - ${height - rect.y}px)`,
                }
              : {}),
          }}
        >
          {mobileView === "main" ? (
            <MainToolbarContent
              onHighlighterClick={() => setMobileView("highlighter")}
              onLinkClick={() => setMobileView("link")}
              isMobile={isMobile}
              imageAttachments={imageAttachments}
              fetchAttachmentUrl={fetchAttachmentUrl}
              onInsertAttachmentImage={handleInsertAttachmentImage}
            />
          ) : (
            <MobileToolbarContent
              type={mobileView === "highlighter" ? "highlighter" : "link"}
              onBack={() => setMobileView("main")}
            />
          )}
        </Toolbar>

        <EditorContent
          editor={editor}
          role="presentation"
          className="simple-editor-content"
        />
      </EditorContext.Provider>
    </div>
  );
}
