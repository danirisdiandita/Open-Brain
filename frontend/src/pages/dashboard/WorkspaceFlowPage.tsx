import { FolderFlow } from "@/components/FolderFlow"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function WorkspaceFlowPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 shrink-0 px-4 py-3 border-b">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Workspace Structure</h1>
      </div>
      <div className="flex-1 min-h-0">
        <FolderFlow />
      </div>
    </div>
  )
}
