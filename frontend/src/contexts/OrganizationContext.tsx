import type { ReactNode } from "react"
import { createContext, useCallback, useContext, useMemo, useState } from "react"

import type { OrgResponse } from "@/api/organization"

interface OrganizationContextValue {
  selectedOrg: OrgResponse | null
  selectOrg: (org: OrgResponse) => void
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null)

function getInitialOrg(): OrgResponse | null {
  const stored = localStorage.getItem("selected_org")
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }
  return null
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [selectedOrg, setSelectedOrg] = useState<OrgResponse | null>(getInitialOrg)

  const selectOrg = useCallback((org: OrgResponse) => {
    localStorage.setItem("selected_org", JSON.stringify(org))
    setSelectedOrg(org)
  }, [])

  const value = useMemo(
    () => ({ selectedOrg, selectOrg }),
    [selectedOrg, selectOrg],
  )

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext)
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider")
  return ctx
}
