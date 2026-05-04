import { Link, Outlet, useLocation } from "react-router-dom"
import { useLogout } from "@/hooks"
import { Button } from "@/components/ui/button"

export default function DashboardLayout() {
  const logout = useLogout()
  const location = useLocation()

  const navLinks = [
    { to: "/dashboard", label: "Home" },
  ]

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="flex h-14 items-center justify-between px-4 max-w-6xl mx-auto">
          <nav className="flex gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm font-medium ${
                  location.pathname === link.to
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Button variant="outline" size="sm" onClick={logout}>
            Sign Out
          </Button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}
