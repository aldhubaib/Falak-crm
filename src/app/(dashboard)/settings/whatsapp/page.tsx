import { ArrowLeft, MessageCircle } from "lucide-react";
import Link from "next/link";

export default function WhatsAppSettingsPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/settings"
          className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-icon-sm h-icon-sm" />
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 max-w-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-success/15 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-success" />
          </div>
          <div>
            <h3 className="text-subheading font-medium text-foreground">WhatsApp Cloud API</h3>
            <p className="text-sub text-muted-foreground">Connect to send invoices and notifications</p>
          </div>
        </div>

        <div className="space-y-3 text-body text-muted-foreground">
          <p>To connect WhatsApp:</p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Create a Meta Business account</li>
            <li>Set up WhatsApp Business API in Meta Developer Portal</li>
            <li>Get your Phone Number ID and Access Token</li>
            <li>Add them to your environment variables</li>
          </ol>
          <p className="pt-2 text-sub">
            Configuration is managed via environment variables (WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID).
          </p>
        </div>
      </div>
    </div>
  );
}
