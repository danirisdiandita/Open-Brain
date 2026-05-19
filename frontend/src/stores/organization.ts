import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { OrgResponse } from "@/api/organization"

interface OrganizationStore {
  selectedOrg: OrgResponse | null
  selectOrg: (org: OrgResponse) => void
}

export const useOrganization = create<OrganizationStore>()(
  persist(
    (set) => ({
      selectedOrg: null,
      selectOrg: (org) => set({ selectedOrg: org }),
    }),
    {
      name: "organization-store",
    },
  ),
)
