"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  KeyRound,
  Loader2,
  Trash2,
} from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { SurfaceCard } from "@/components/surface-card";
import { SaveButton } from "@/components/save-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useActionHandler } from "@/hooks/use-action";
import {
  providersByModule,
  type IntegrationProvider,
} from "@/lib/integrations";
import {
  removeIntegration,
  saveIntegration,
  testIntegration,
  type IntegrationDTO,
} from "@/actions/integrations";

export function IntegrationsClient({
  integrations,
  secretsKeyConfigured,
}: {
  integrations: IntegrationDTO[];
  secretsKeyConfigured: boolean;
}) {
  const groups = providersByModule();
  const byProvider = new Map(integrations.map((i) => [i.provider, i]));

  return (
    <PageContainer className="mx-auto w-full max-w-3xl space-y-8 pb-10">
      {!secretsKeyConfigured && (
        <SurfaceCard className="border-amber-500/40 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="min-w-0 text-sm">
              <div className="font-medium">SECRETS_KEY is not set</div>
              <p className="mt-1 text-xs text-muted-foreground">
                API keys are encrypted before they are stored, so nothing can be
                saved until this environment variable exists. Generate one with{" "}
                <span className="font-mono text-foreground/90">openssl rand -hex 32</span>{" "}
                and restart the server.
              </p>
            </div>
          </div>
        </SurfaceCard>
      )}

      {groups.map(({ module, providers }) => (
        <section key={module} className="space-y-field-gap">
          <div className="px-1 text-tiny font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {module}
          </div>
          <div className="space-y-field-gap">
            {providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                state={byProvider.get(provider.id)}
                disabled={!secretsKeyConfigured}
              />
            ))}
          </div>
        </section>
      ))}
    </PageContainer>
  );
}

function ProviderCard({
  provider,
  state,
  disabled,
}: {
  provider: IntegrationProvider;
  state?: IntegrationDTO;
  disabled: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const { run, loading } = useActionHandler({
    onSuccess: () => router.refresh(),
  });

  const configured = !!state?.configured;
  const dirty = Object.values(values).some((v) => v.trim());

  // Managed elsewhere (WhatsApp) — link out rather than duplicate its storage.
  if (provider.managedAt) {
    return (
      <Link
        href={provider.managedAt}
        className="flex items-center gap-3 rounded-card border border-border/60 bg-surface p-4 transition-colors hover:border-border"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-black text-white">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{provider.name}</div>
          <div className="text-xs text-muted-foreground">{provider.description}</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    );
  }

  const save = async () => {
    if (loading) return;
    await run("Save Integration", async () => {
      const result = await saveIntegration(provider.id, values);
      if (!result.ok) throw new Error(result.error.message);
      setValues({});
      setTestResult(null);
    });
  };

  const test = async () => {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testIntegration(provider.id);
      setTestResult(
        result.ok ? result.data : { ok: false, message: result.error.message },
      );
      router.refresh();
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    if (loading) return;
    await run("Remove Integration", async () => {
      const result = await removeIntegration(provider.id);
      if (!result.ok) throw new Error(result.error.message);
      setValues({});
      setTestResult(null);
    });
  };

  return (
    <SurfaceCard padding="lg">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-black text-white">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{provider.name}</span>
            <StatusBadge state={state} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{provider.description}</p>
        </div>
        <a
          href={provider.docsUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${provider.name} documentation`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <div className="mt-5 space-y-field-gap">
        {provider.fields.map((field) => {
          const hint = state?.hints?.[field.key];
          return (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`${provider.id}-${field.key}`}>{field.label}</Label>
              <Input
                id={`${provider.id}-${field.key}`}
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                spellCheck={false}
                disabled={disabled}
                placeholder={hint ?? field.placeholder}
                value={values[field.key] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              />
              {field.help && (
                <p className="text-xs text-muted-foreground">{field.help}</p>
              )}
              {field.secret && configured && (
                <p className="text-xs text-muted-foreground">
                  Stored as {hint ?? "••••"}. Leave blank to keep it unchanged.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {testResult && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-md border p-3 text-xs ${
            testResult.ok
              ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
              : "border-destructive/40 bg-destructive/5 text-destructive"
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}

      {provider.testCost && (
        <p className="mt-3 text-xs text-muted-foreground">{provider.testCost}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SaveButton
          onClick={save}
          loading={loading}
          ready={dirty}
          disabled={disabled || !dirty}
        />
        {provider.testable && configured && (
          <Button variant="outline" className="rounded-md" onClick={test} disabled={testing}>
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Testing…
              </>
            ) : (
              "Test connection"
            )}
          </Button>
        )}
        {configured && (
          <Button
            variant="ghost"
            className="ml-auto rounded-md text-muted-foreground hover:text-destructive"
            onClick={remove}
            disabled={loading}
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        )}
      </div>
    </SurfaceCard>
  );
}

function StatusBadge({ state }: { state?: IntegrationDTO }) {
  if (!state?.configured) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Not configured
      </Badge>
    );
  }
  if (!state.enabled) return <Badge variant="outline">Disabled</Badge>;
  if (state.lastVerifyError) {
    return <Badge variant="destructive">Failed</Badge>;
  }
  if (state.lastVerifiedAt) {
    return (
      <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
        Verified
      </Badge>
    );
  }
  return <Badge variant="outline">Saved, not tested</Badge>;
}
