import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { MessageCircle, X, Send, Loader2, Sparkles, ExternalLink, Plus, Trash2, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOrganization } from "@/contexts/OrganizationContext"
import api from "@/api/client"

interface Message {
  id?: string
  role: "user" | "assistant"
  content: string
  sources?: { note_id: string; title: string; heading: string | null }[]
}

interface Session {
  id: string
  title: string
  updated_at: string
}

export function Chatbot() {
  const { selectedOrg } = useOrganization()
  const navigate = useNavigate()
  const orgId = selectedOrg?.id

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [viewSessions, setViewSessions] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    if (orgId) loadSessions()
  }, [orgId])

  const loadSessions = async () => {
    try {
      const res = await api.get<{ sessions: Session[] }>(`/organizations/${orgId}/chat/sessions`)
      setSessions(res.data.sessions)
    } catch { /* ignore */ }
  }

  const startNewSession = () => {
    setSessionId(null)
    setMessages([])
    setViewSessions(false)
    if (!open) setOpen(true)
  }

  const loadSession = async (id: string) => {
    try {
      const res = await api.get<{ messages: any[] }>(`/organizations/${orgId}/chat/sessions/${id}`)
      setSessionId(id)
      setMessages(
        res.data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources || undefined,
        }))
      )
      setViewSessions(false)
      if (!open) setOpen(true)
    } catch { /* ignore */ }
  }

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await api.delete(`/organizations/${orgId}/chat/sessions/${id}`)
      if (sessionId === id) {
        setSessionId(null)
        setMessages([])
      }
      setSessions((prev) => prev.filter((s) => s.id !== id))
    } catch { /* ignore */ }
  }

  const send = async () => {
    const q = input.trim()
    if (!q || !orgId || loading) return

    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: q }])
    setLoading(true)

    try {
      const res = await api.post<{
        session_id: string
        answer: string
        sources: { note_id: string; title: string; heading: string | null }[]
      }>(`/organizations/${orgId}/chat`, {
        session_id: sessionId,
        question: q,
        top_k: 5,
      })

      if (!sessionId) {
        setSessionId(res.data.session_id)
        loadSessions()
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.answer, sources: res.data.sources },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't process your question." },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-3 shadow-lg hover:bg-primary/90 transition-colors"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Ask AI</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-h-[650px] bg-background border rounded-lg shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <div className="flex items-center gap-2">
              {viewSessions ? (
                <ChevronLeft className="h-4 w-4 cursor-pointer" onClick={() => setViewSessions(false)} />
              ) : null}
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">
                {viewSessions ? "Chat History" : "Ask Open Brain"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startNewSession} title="New session">
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setViewSessions(!viewSessions); loadSessions() }} title="History">
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {viewSessions ? (
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-[200px]">
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No previous chats</p>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between rounded-md px-3 py-2 cursor-pointer hover:bg-muted transition-colors ${s.id === sessionId ? "bg-muted" : ""}`}
                    onClick={() => loadSession(s.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{s.title || "Chat"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(s.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-50 hover:opacity-100"
                      onClick={(e) => deleteSession(s.id, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Ask a question about your knowledge base. Chat history is saved.
                  </p>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      {msg.content}
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border max-w-[85%]">
                        <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Sources</p>
                        <div className="space-y-1">
                          {msg.sources.map((s, j) => (
                            <button
                              key={j}
                              className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                              onClick={() => navigate(`/dashboard/${selectedOrg?.slug}/note/${s.note_id}`)}
                            >
                              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{s.title}</span>
                              {s.heading && <span className="text-muted-foreground/50 shrink-0">· {s.heading}</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Thinking...
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 px-4 py-3 border-t shrink-0">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question..."
                  className="flex-1 min-w-0 bg-muted/50 rounded-md px-3 py-2 text-sm border-none outline-none focus:ring-1 focus:ring-ring"
                  disabled={loading}
                />
                <Button size="icon" className="h-8 w-8 shrink-0" onClick={send} disabled={!input.trim() || loading}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
