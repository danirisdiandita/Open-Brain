import { create } from "zustand"
import { persist } from "zustand/middleware"

interface ChatbotStore {
  open: boolean
  setOpen: (v: boolean) => void
}

export const useChatOpen = create<ChatbotStore>()(
  persist(
    (set) => ({
      open: false,
      setOpen: (v) => set({ open: v }),
    }),
    { name: "chatbot-open" },
  ),
)
