/**
 * One-time setup: Configure CORS on the R2 bucket so browsers can upload directly.
 *
 * Run:  npx tsx scripts/setup-r2-cors.ts
 *
 * Requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 * in your .env file.
 */
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import { config } from "dotenv";

config();

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const BUCKET = process.env.R2_BUCKET_NAME || "falak-crm";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function main() {
  console.log(`Setting CORS on bucket: ${BUCKET}`);

  await s3.send(
    new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["*"],
            AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag", "Content-Length", "Content-Type"],
            MaxAgeSeconds: 86400,
          },
        ],
      },
    })
  );

  console.log("CORS configured successfully.");

  const result = await s3.send(new GetBucketCorsCommand({ Bucket: BUCKET }));
  console.log("Current CORS rules:", JSON.stringify(result.CORSRules, null, 2));
}

main().catch(console.error);
