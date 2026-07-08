-- Payment numbers are system-generated and unique per workspace.
CREATE UNIQUE INDEX "Payment_workspaceId_number_key" ON "Payment"("workspaceId", "number");
