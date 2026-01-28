import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#f6f7f8] text-[#111518] font-display">
      {/* Navigation Bar */}
      <header className="fixed top-0 z-50 w-full border-b border-solid border-[#f0f3f4] bg-white/80 backdrop-blur-md px-6 md:px-20 py-4">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-primary">
              <svg fill="none" height="32" viewBox="0 0 48 48" width="32" xmlns="http://www.w3.org/2000/svg">
                <path clipRule="evenodd" d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z" fill="currentColor" fillRule="evenodd"></path>
              </svg>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">OpenBrain</h2>
          </div>
          <div className="hidden md:flex items-center gap-10">
            <Link className="text-sm font-semibold hover:text-primary transition-colors" href="#">Features</Link>
            <Link className="text-sm font-semibold hover:text-primary transition-colors" href="#">Community</Link>
            <Link className="text-sm font-semibold hover:text-primary transition-colors" href="#">Documentation</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button className="hidden sm:flex min-w-[100px] items-center justify-center rounded-lg h-10 px-5 bg-primary text-white text-sm font-bold tracking-wide hover:bg-primary/90 transition-all border-none">
                Sign In
              </Button>
            </Link>
            <span className="material-symbols-outlined cursor-pointer md:hidden">menu</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex flex-1 flex-col">
        <div className="flex min-h-screen w-full flex-col lg:flex-row">
          {/* Left Section: Content */}
          <div className="flex w-full flex-col justify-center px-8 py-32 lg:w-1/2 lg:px-20 xl:px-32">
            <div className="max-w-[560px]">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary">
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                <span className="text-xs font-bold uppercase tracking-wider">v2.0 Now Available</span>
              </div>
              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-[#111518] sm:text-5xl lg:text-6xl">
                The Open Source <span className="text-primary">Second Brain</span> for Modern Thinkers
              </h1>
              <p className="mt-8 text-lg font-normal leading-relaxed text-[#617989]">
                Own your thoughts with a decentralized, privacy-first knowledge base. Built for speed, extensibility, and total data sovereignty. Connect your ideas like never before.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link href="/signup">
                  <Button className="flex h-14 min-w-[180px] items-center justify-center rounded-xl bg-primary px-8 text-base font-bold text-white shadow-lg shadow-primary/25 hover:translate-y-[-2px] hover:shadow-primary/40 transition-all border-none">
                    Start Building
                  </Button>
                </Link>
                <Button variant="outline" className="flex h-14 min-w-[180px] items-center justify-center rounded-xl bg-[#f0f3f4] border-none px-8 text-base font-bold text-[#111518] hover:bg-[#e2e8eb] transition-all">
                  <span className="mr-2 flex items-center">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22v3.293c0 .319.192.694.805.576C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12z"></path></svg>
                  </span>
                  View on GitHub
                </Button>
              </div>
              {/* Stats */}
              <div className="mt-16 flex items-center gap-8 border-t border-[#f0f3f4] pt-10">
                <div>
                  <p className="text-2xl font-extrabold">10k+</p>
                  <p className="text-xs font-medium uppercase tracking-widest text-[#617989]">Stars</p>
                </div>
                <div className="h-10 w-[1px] bg-[#f0f3f4]"></div>
                <div>
                  <p className="text-2xl font-extrabold">450+</p>
                  <p className="text-xs font-medium uppercase tracking-widest text-[#617989]">Contributors</p>
                </div>
                <div className="h-10 w-[1px] bg-[#f0f3f4]"></div>
                <div>
                  <p className="text-2xl font-extrabold">25k+</p>
                  <p className="text-xs font-medium uppercase tracking-widest text-[#617989]">Users</p>
                </div>
              </div>
            </div>
          </div>
          {/* Right Section: Visualization */}
          <div className="bg-[#101a22] knowledge-graph-bg relative flex w-full items-center justify-center overflow-hidden lg:w-1/2">
            <div className="relative h-full w-full">
              <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(#2b9dee 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
              <svg className="h-full w-full" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <filter id="glow">
                    <feGaussianBlur result="coloredBlur" stdDeviation="3.5"></feGaussianBlur>
                    <feMerge>
                      <feMergeNode in="coloredBlur"></feMergeNode>
                      <feMergeNode in="SourceGraphic"></feMergeNode>
                    </feMerge>
                  </filter>
                </defs>
                <g stroke="rgba(43, 157, 238, 0.2)" strokeWidth="1.5">
                  <line x1="400" x2="250" y1="400" y2="250"></line>
                  <line x1="400" x2="550" y1="400" y2="250"></line>
                  <line x1="400" x2="250" y1="400" y2="550"></line>
                  <line x1="400" x2="550" y1="400" y2="550"></line>
                  <line x1="250" x2="150" y1="250" y2="350"></line>
                  <line x1="550" x2="650" y1="250" y2="150"></line>
                  <line x1="550" x2="700" y1="550" y2="600"></line>
                </g>
                <circle cx="400" cy="400" fill="#2b9dee" filter="url(#glow)" r="12"></circle>
                <circle cx="250" cy="250" fill="#2b9dee" filter="url(#glow)" opacity="0.8" r="8"></circle>
                <circle cx="550" cy="250" fill="#2b9dee" filter="url(#glow)" opacity="0.8" r="8"></circle>
                <circle cx="250" cy="550" fill="#2b9dee" filter="url(#glow)" opacity="0.8" r="8"></circle>
                <circle cx="550" cy="550" fill="#2b9dee" filter="url(#glow)" opacity="0.8" r="8"></circle>
                <circle cx="150" cy="350" fill="#2b9dee" filter="url(#glow)" opacity="0.5" r="6"></circle>
                <circle cx="650" cy="150" fill="#2b9dee" filter="url(#glow)" opacity="0.5" r="6"></circle>
                <circle cx="700" cy="600" fill="#2b9dee" filter="url(#glow)" opacity="0.5" r="6"></circle>
                <text fill="white" fontSize="14" fontWeight="bold" textAnchor="middle" x="400" y="440">Central Brain</text>
              </svg>
            </div>
            {/* Gradients */}
            <div className="absolute bottom-0 left-0 h-32 w-full bg-gradient-to-t from-[#101a22] to-transparent lg:hidden"></div>
            <div className="absolute left-0 top-0 h-full w-32 bg-gradient-to-r from-[#f6f7f8] to-transparent hidden lg:block"></div>
          </div>
        </div>

        {/* Features Section */}
        <section className="bg-white py-24 px-8 lg:px-20">
          <div className="mx-auto max-w-[1200px]">
            <div className="mb-16">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Built for the future of work</h2>
              <p className="mt-4 max-w-[700px] text-lg text-[#617989]">Everything you need to capture, organize, and synthesize your thoughts at scale.</p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <Card className="flex flex-col gap-4 rounded-2xl border border-[#dbe1e6] p-8 hover:border-primary/50 transition-colors shadow-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <span className="material-symbols-outlined">shield</span>
                </div>
                <h3 className="text-xl font-bold">Privacy First</h3>
                <p className="text-sm leading-relaxed text-[#617989]">Your data never leaves your local machine unless you explicitly enable sync. End-to-end encrypted by default.</p>
              </Card>
              <Card className="flex flex-col gap-4 rounded-2xl border border-[#dbe1e6] p-8 hover:border-primary/50 transition-colors shadow-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <span className="material-symbols-outlined">extension</span>
                </div>
                <h3 className="text-xl font-bold">Full Extensibility</h3>
                <p className="text-sm leading-relaxed text-[#617989]">Build custom plugins, themes, and workflows with our robust open-source API and community marketplace.</p>
              </Card>
              <Card className="flex flex-col gap-4 rounded-2xl border border-[#dbe1e6] p-8 hover:border-primary/50 transition-colors shadow-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <span className="material-symbols-outlined">bolt</span>
                </div>
                <h3 className="text-xl font-bold">Lightning Fast</h3>
                <p className="text-sm leading-relaxed text-[#617989]">Instant search and real-time graph rendering, even with hundred thousands of notes and connections.</p>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative overflow-hidden bg-primary px-8 py-20 lg:px-20">
          <div className="mx-auto max-w-[960px] text-center">
            <h2 className="text-3xl font-black text-white sm:text-4xl lg:text-5xl uppercase tracking-tighter">Ready to own your knowledge?</h2>
            <p className="mx-auto mt-6 max-w-[600px] text-lg text-white/80">
              Join thousands of developers, researchers, and modern thinkers building their second brain with OpenBrain.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup">
                <Button className="flex h-12 w-full items-center justify-center rounded-lg bg-white px-8 text-base font-bold text-primary sm:w-auto hover:bg-[#f6f7f8] transition-colors border-none shadow-xl">
                  Get Started for Free
                </Button>
              </Link>
              <Button variant="outline" className="flex h-12 w-full items-center justify-center rounded-lg border-2 border-white/30 px-8 text-base font-bold text-white sm:w-auto hover:bg-white/10 transition-colors bg-transparent">
                Request a Demo
              </Button>
            </div>
          </div>
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#f0f3f4] bg-white py-12 px-8 lg:px-20">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-8 md:flex-row">
          <div className="flex items-center gap-3">
            <div className="text-primary opacity-50">
              <svg fill="none" height="24" viewBox="0 0 48 48" width="24" xmlns="http://www.w3.org/2000/svg">
                <path d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z" fill="currentColor"></path>
              </svg>
            </div>
            <p className="text-sm font-medium text-[#617989]">© {new Date().getFullYear()} OpenBrain Project. MIT Licensed.</p>
          </div>
          <div className="flex gap-8">
            <Link className="text-xs font-bold uppercase tracking-widest text-[#617989] hover:text-primary transition-colors" href="#">Twitter</Link>
            <Link className="text-xs font-bold uppercase tracking-widest text-[#617989] hover:text-primary transition-colors" href="#">GitHub</Link>
            <Link className="text-xs font-bold uppercase tracking-widest text-[#617989] hover:text-primary transition-colors" href="#">Discord</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
