CREATE TABLE "topic_pdfs" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_pdfs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "topic_pdfs_topicId_idx" ON "topic_pdfs"("topicId");

ALTER TABLE "topic_pdfs" ADD CONSTRAINT "topic_pdfs_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
