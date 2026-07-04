-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MemberType" AS ENUM ('OWNER', 'MEMBER', 'FREELANCER');

-- CreateEnum
CREATE TYPE "CollaboratorStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('FIXED', 'MONTHLY', 'PER_UNIT', 'HOURLY');

-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "CustomFieldEntity" AS ENUM ('COMPANY', 'CONTACT', 'DEAL');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'CHECKBOX', 'URL', 'PHONE');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'KWD',
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DECIMAL(12,6) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT,
    "type" "MemberType" NOT NULL DEFAULT 'MEMBER',
    "roleId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCollaborator" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "CollaboratorStatus" NOT NULL DEFAULT 'PENDING',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedVia" TEXT,

    CONSTRAINT "ProjectCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "industry" TEXT,
    "referral" TEXT,
    "phone" TEXT,
    "whatsappNumber" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "logo" TEXT,
    "notes" TEXT,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "nameAr" TEXT,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT,
    "country" TEXT NOT NULL,
    "notes" TEXT,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactCompany" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pricingType" "PricingType" NOT NULL DEFAULT 'FIXED',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unit" TEXT,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "type" "StageType" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "title" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KWD',
    "rateToBase" DECIMAL(12,6),
    "valueInBase" DECIMAL(12,2),
    "expectedCloseDate" TIMESTAMP(3),
    "discountType" TEXT NOT NULL DEFAULT 'percent',
    "discountValue" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "lostReason" TEXT,
    "notes" TEXT,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealAccess" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "token" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "DealAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealItem" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "description" TEXT,

    CONSTRAINT "DealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStatus" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dealId" TEXT,
    "companyId" TEXT,
    "contactId" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "statusId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'fixed',
    "thumbnailId" TEXT,
    "description" TEXT,
    "requirePublishing" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "roleId" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFolder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "role" TEXT NOT NULL DEFAULT 'any',
    "options" TEXT,
    "allowedFileTypes" TEXT,
    "allowedFormats" TEXT,
    "aspectRatio" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "phase" TEXT NOT NULL DEFAULT 'create',
    "visibleFromStageId" TEXT,
    "requiredBeforeStageId" TEXT,
    "lockedFromStageId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTemplate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskChecklistItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "templateItemId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "role" TEXT NOT NULL DEFAULT 'any',
    "options" TEXT,
    "allowedFileTypes" TEXT,
    "allowedFormats" TEXT,
    "aspectRatio" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "phase" TEXT NOT NULL DEFAULT 'create',
    "visibleFromStageId" TEXT,
    "requiredBeforeStageId" TEXT,
    "lockedFromStageId" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "attachmentId" TEXT,
    "textValue" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskStatus" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskNumber" INTEGER NOT NULL DEFAULT 0,
    "serviceId" TEXT,
    "statusId" TEXT,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "price" DECIMAL(12,2),
    "priority" INTEGER,
    "estimateMin" INTEGER,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assignmentHistory" JSONB,
    "stageTimings" JSONB,
    "stageEnteredAt" TIMESTAMP(3),
    "rejectionCount" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskStatusChange" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "memberId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatusId" TEXT,
    "fromStatusName" TEXT,
    "toStatusId" TEXT,
    "toStatusName" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "projectId" TEXT,
    "conversationId" TEXT,
    "replyToId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'message',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentMention" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "CommentMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "linkUrl" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "contactId" TEXT,
    "number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "rateToBase" DECIMAL(12,6),
    "totalInBase" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'KWD',
    "notes" TEXT,
    "dueDate" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "publicToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "businessName" TEXT,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "templateId" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "linkedType" TEXT,
    "linkedId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "userImage" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Industry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDef" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityType" "CustomFieldEntity" NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "CustomFieldType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "contentType" TEXT,
    "r2Key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploading',
    "uploadId" TEXT,
    "totalParts" INTEGER NOT NULL DEFAULT 1,
    "uploadedParts" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginPhoto" (
    "id" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "contentType" TEXT,
    "column" TEXT NOT NULL DEFAULT 'a',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "scheduledBy" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_workspaceId_code_key" ON "Currency"("workspaceId", "code");

-- CreateIndex
CREATE INDEX "ExchangeRate_workspaceId_fromCurrency_toCurrency_idx" ON "ExchangeRate"("workspaceId", "fromCurrency", "toCurrency");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_workspaceId_name_key" ON "Role"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "ProjectCollaborator_projectId_idx" ON "ProjectCollaborator"("projectId");

-- CreateIndex
CREATE INDEX "Company_workspaceId_deletedAt_idx" ON "Company"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "Contact_workspaceId_deletedAt_idx" ON "Contact"("workspaceId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_workspaceId_mobile_key" ON "Contact"("workspaceId", "mobile");

-- CreateIndex
CREATE UNIQUE INDEX "ContactCompany_contactId_companyId_key" ON "ContactCompany"("contactId", "companyId");

-- CreateIndex
CREATE INDEX "Pipeline_workspaceId_isDefault_idx" ON "Pipeline"("workspaceId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_pipelineId_order_key" ON "PipelineStage"("pipelineId", "order");

-- CreateIndex
CREATE INDEX "Deal_workspaceId_deletedAt_idx" ON "Deal"("workspaceId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DealAccess_token_key" ON "DealAccess"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DealAccess_dealId_email_key" ON "DealAccess"("dealId", "email");

-- CreateIndex
CREATE INDEX "DealItem_dealId_idx" ON "DealItem"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStatus_workspaceId_order_key" ON "ProjectStatus"("workspaceId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Project_dealId_key" ON "Project"("dealId");

-- CreateIndex
CREATE INDEX "Project_workspaceId_deletedAt_idx" ON "Project"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "ProjectMember_memberId_idx" ON "ProjectMember"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_memberId_key" ON "ProjectMember"("projectId", "memberId");

-- CreateIndex
CREATE INDEX "ProjectFolder_projectId_parentId_idx" ON "ProjectFolder"("projectId", "parentId");

-- CreateIndex
CREATE INDEX "ProjectAsset_projectId_folderId_idx" ON "ProjectAsset"("projectId", "folderId");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_templateId_idx" ON "ChecklistTemplateItem"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTemplate_projectId_templateId_key" ON "ProjectTemplate"("projectId", "templateId");

-- CreateIndex
CREATE INDEX "TaskChecklistItem_taskId_idx" ON "TaskChecklistItem"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskStatus_workspaceId_order_key" ON "TaskStatus"("workspaceId", "order");

-- CreateIndex
CREATE INDEX "Task_projectId_statusId_idx" ON "Task"("projectId", "statusId");

-- CreateIndex
CREATE INDEX "Task_projectId_order_idx" ON "Task"("projectId", "order");

-- CreateIndex
CREATE INDEX "Task_projectId_deletedAt_idx" ON "Task"("projectId", "deletedAt");

-- CreateIndex
CREATE INDEX "TaskStatusChange_taskId_createdAt_idx" ON "TaskStatusChange"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskComment_projectId_createdAt_idx" ON "TaskComment"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskComment_conversationId_createdAt_idx" ON "TaskComment"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_memberId_emoji_key" ON "MessageReaction"("messageId", "memberId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "CommentMention_commentId_memberId_key" ON "CommentMention"("commentId", "memberId");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_idx" ON "Conversation"("workspaceId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_memberId_idx" ON "ConversationParticipant"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_memberId_key" ON "ConversationParticipant"("conversationId", "memberId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_read_createdAt_idx" ON "Notification"("recipientId", "read", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_memberId_idx" ON "PushSubscription"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_publicToken_key" ON "Invoice"("publicToken");

-- CreateIndex
CREATE INDEX "Invoice_workspaceId_status_idx" ON "Invoice"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Invoice_workspaceId_createdAt_idx" ON "Invoice"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConfig_workspaceId_key" ON "WhatsAppConfig"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_workspaceId_event_key" ON "WhatsAppTemplate"("workspaceId", "event");

-- CreateIndex
CREATE INDEX "ActivityLog_workspaceId_entityType_entityId_idx" ON "ActivityLog"("workspaceId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_workspaceId_createdAt_idx" ON "ActivityLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Industry_workspaceId_name_key" ON "Industry"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_workspaceId_name_key" ON "Referral"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDef_workspaceId_entityType_name_key" ON "CustomFieldDef"("workspaceId", "entityType", "name");

-- CreateIndex
CREATE INDEX "Attachment_workspaceId_entityType_entityId_idx" ON "Attachment"("workspaceId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "Attachment_r2Key_idx" ON "Attachment"("r2Key");

-- CreateIndex
CREATE INDEX "LoginPhoto_column_order_idx" ON "LoginPhoto"("column", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PublishItem_taskId_key" ON "PublishItem"("taskId");

-- CreateIndex
CREATE INDEX "PublishItem_projectId_scheduledDate_idx" ON "PublishItem"("projectId", "scheduledDate");

-- CreateIndex
CREATE INDEX "PublishItem_workspaceId_scheduledDate_idx" ON "PublishItem"("workspaceId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "Currency" ADD CONSTRAINT "Currency_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCollaborator" ADD CONSTRAINT "ProjectCollaborator_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactCompany" ADD CONSTRAINT "ContactCompany_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactCompany" ADD CONSTRAINT "ContactCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAccess" ADD CONSTRAINT "DealAccess_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealItem" ADD CONSTRAINT "DealItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealItem" ADD CONSTRAINT "DealItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatus" ADD CONSTRAINT "ProjectStatus_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "ProjectStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFolder" ADD CONSTRAINT "ProjectFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFolder" ADD CONSTRAINT "ProjectFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAsset" ADD CONSTRAINT "ProjectAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAsset" ADD CONSTRAINT "ProjectAsset_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ProjectFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_visibleFromStageId_fkey" FOREIGN KEY ("visibleFromStageId") REFERENCES "TaskStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_requiredBeforeStageId_fkey" FOREIGN KEY ("requiredBeforeStageId") REFERENCES "TaskStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_lockedFromStageId_fkey" FOREIGN KEY ("lockedFromStageId") REFERENCES "TaskStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTemplate" ADD CONSTRAINT "ProjectTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTemplate" ADD CONSTRAINT "ProjectTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "ChecklistTemplateItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatus" ADD CONSTRAINT "TaskStatus_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "TaskStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "WorkspaceMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusChange" ADD CONSTRAINT "TaskStatusChange_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusChange" ADD CONSTRAINT "TaskStatusChange_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkspaceMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TaskComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentMention" ADD CONSTRAINT "CommentMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "TaskComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentMention" ADD CONSTRAINT "CommentMention_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConfig" ADD CONSTRAINT "WhatsAppConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Industry" ADD CONSTRAINT "Industry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDef" ADD CONSTRAINT "CustomFieldDef_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishItem" ADD CONSTRAINT "PublishItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishItem" ADD CONSTRAINT "PublishItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishItem" ADD CONSTRAINT "PublishItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishItem" ADD CONSTRAINT "PublishItem_scheduledBy_fkey" FOREIGN KEY ("scheduledBy") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
