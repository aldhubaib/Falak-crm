import { MessageCircle, ExternalLink } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { SurfaceCard } from "@/components/surface-card";

const STEPS = [
  "Create a Meta Business account",
  "Set up WhatsApp Business API in Meta Developer Portal",
  "Get your Phone Number ID and Access Token",
  "Add them to your environment variables",
];

export default function WhatsAppIntegrationPage() {
  return (
    <>
      <AppHeader title="WhatsApp Cloud API" backHref="/settings" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer className="mx-auto w-full max-w-3xl">
          <SurfaceCard padding="lg">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-emerald-500/15 text-emerald-400">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">WhatsApp Cloud API</div>
                <div className="text-xs text-muted-foreground">
                  Connect to send invoices and notifications
                </div>
              </div>
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api"
                target="_blank"
                rel="noreferrer"
                aria-label="Open Meta Developer Portal"
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-5 space-y-3">
              <div className="text-sm text-muted-foreground">To connect WhatsApp:</div>
              <ol className="space-y-2">
                {STEPS.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted/50 text-xxs font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-foreground/90">{s}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-5 rounded-md border border-border/40 bg-background/40 p-3">
              <div className="text-tiny font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Environment variables
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                <li className="font-mono text-foreground/90">WHATSAPP_API_TOKEN</li>
                <li className="font-mono text-foreground/90">WHATSAPP_PHONE_NUMBER_ID</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Configuration is managed via environment variables.
              </p>
            </div>
          </SurfaceCard>
        </PageContainer>
      </main>
    </>
  );
}
