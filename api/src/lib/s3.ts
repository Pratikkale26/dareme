import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";
import { randomUUID } from "crypto";

const s3 = new S3Client({
    region: env.AWS_REGION,
    endpoint: `https://${env.AWS_REGION}.digitaloceanspaces.com`,
    credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: false,
});

const ALLOWED_TYPES: Record<string, string> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

const MAX_FILE_SIZE: Record<string, number> = {
    video: 100 * 1024 * 1024, // 100MB
    image: 10 * 1024 * 1024,  // 10MB
};

/**
 * Generate a presigned URL for direct client-side upload to S3/Spaces.
 */
export async function generatePresignedUploadUrl(
    userId: string,
    contentType: string,
    fileSize: number
): Promise<{ uploadUrl: string; fileKey: string; publicUrl: string }> {
    const ext = ALLOWED_TYPES[contentType];
    if (!ext) {
        throw new Error(`Unsupported content type: ${contentType}. Allowed: ${Object.keys(ALLOWED_TYPES).join(", ")}`);
    }

    const mediaCategory = contentType.startsWith("video/") ? "video" : "image";
    const maxSize = MAX_FILE_SIZE[mediaCategory];
    if (maxSize && fileSize > maxSize) {
        throw new Error(`File too large. Max ${mediaCategory} size: ${maxSize / (1024 * 1024)}MB`);
    }

    const timestamp = Date.now();
    const uuid = randomUUID().slice(0, 8);
    const fileKey = `proofs/${userId}/${timestamp}-${uuid}.${ext}`;

    const command = new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: fileKey,
        ContentType: contentType,
        ContentLength: fileSize,
        ACL: "public-read",
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min
    const publicUrl = `https://${env.AWS_S3_BUCKET}.${env.AWS_REGION}.digitaloceanspaces.com/${fileKey}`;

    return { uploadUrl, fileKey, publicUrl };
}

export { s3 };
