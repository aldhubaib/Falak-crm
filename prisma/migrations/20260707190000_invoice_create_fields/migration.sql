-- Invoice: deal link, issue date, discount
ALTER TABLE "Invoice" ADD COLUMN "dealId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "issueDate" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "discountType" TEXT NOT NULL DEFAULT 'percent';
ALTER TABLE "Invoice" ADD COLUMN "discountValue" DECIMAL(12,3) NOT NULL DEFAULT 0;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InvoiceItem: long description + per-item tax
ALTER TABLE "InvoiceItem" ADD COLUMN "details" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN "taxPct" DECIMAL(5,2);
