import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-black items-center justify-center">
        {/* Decorative grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        {/* Animated floating shapes */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-primary/5 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-purple-500/5 blur-3xl animate-pulse delay-1000" />

        {/* Center logo & text */}
        <div className="relative z-10 text-center px-12">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl font-bold text-primary">F</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Falak CRM</h2>
          <p className="text-[14px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
            CRM & bookkeeping system for marketing teams — powered by WhatsApp.
          </p>
        </div>

        {/* Bottom version tag */}
        <div className="absolute bottom-6 left-0 right-0 text-center">
          <span className="text-[11px] text-zinc-600">falak · v1.0</span>
        </div>
      </div>

      {/* Right Panel — Sign In */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">F</span>
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-foreground mb-2">Sign in to Falak</h1>
            <p className="text-[13px] text-muted-foreground">
              CRM & bookkeeping for marketing teams
            </p>
          </div>

          <div className="flex justify-center">
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full",
                  cardBox: "shadow-none border-0 w-full",
                  card: "shadow-none border-0 bg-transparent p-0 w-full",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton: "h-11 rounded-full border border-border bg-card hover:bg-muted/50 text-foreground text-[13px] font-medium transition-colors",
                  socialButtonsBlockButtonText: "text-foreground",
                  dividerLine: "bg-border",
                  dividerText: "text-muted-foreground text-[11px]",
                  formFieldInput: "h-11 rounded-lg border-border bg-black text-foreground text-[13px] focus:border-ring",
                  formFieldLabel: "text-muted-foreground text-[11px] uppercase tracking-wider font-medium",
                  formButtonPrimary: "h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-[13px] font-medium",
                  footerAction: "hidden",
                  footer: "hidden",
                },
              }}
            />
          </div>

          <p className="text-center text-[11px] text-muted-foreground/60 mt-6">
            Access is restricted to team members only.
          </p>
        </div>
      </div>
    </div>
  );
}
