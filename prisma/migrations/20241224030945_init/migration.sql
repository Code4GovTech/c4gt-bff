-- CreateTable
CREATE TABLE "Schema" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Schema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "verificationTemplateId" TEXT,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_verificationTemplateId_fkey" FOREIGN KEY ("verificationTemplateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
