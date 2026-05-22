export default function InvoicesPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Invoices</h1>
        <button className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors">
          New Invoice
        </button>
      </div>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
        No invoices yet. Create invoices from your projects.
      </div>
    </div>
  );
}
