import { useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useOrganizations } from "@/hooks/useOrganizations"
import { useOrganization } from "@/contexts/OrganizationContext"

export function useSyncOrgFromSlug() {
  const { orgSlug } = useParams<{ orgSlug: string; "*"?: string }>()
  const { data: orgs, isLoading } = useOrganizations()
  const { selectedOrg, selectOrg } = useOrganization()
  const navigate = useNavigate()

  useEffect(() => {
    if (!orgSlug || !orgs) return
    if (isLoading) return

    const match = orgs.find((o) => o.slug === orgSlug)
    if (!match) {
      navigate("/dashboard", { replace: true })
      return
    }

    if (selectedOrg?.slug !== orgSlug) {
      selectOrg(match)
    }
  }, [orgSlug, orgs, isLoading, selectedOrg, selectOrg, navigate])
}

export function useCurrentFolderPath(): string[] {
  const { "*": splat } = useParams<{ "*"?: string }>()
  if (!splat || splat === "/") return []
  return splat.replace(/^\//, "").replace(/\/$/, "").split("/").filter(Boolean)
}
