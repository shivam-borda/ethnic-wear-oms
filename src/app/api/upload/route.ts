import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const region = process.env.AWS_REGION || "ap-south-1";
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const bucketName = process.env.AWS_S3_BUCKET_NAME;

    // Check credentials
    if (!accessKeyId || !secretAccessKey || !bucketName) {
      return NextResponse.json(
        {
          error: "AWS S3 credentials missing. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME in .env.local",
        },
        { status: 500 }
      );
    }

    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = file.name.split(".").pop() || "jpg";
    const key = `ethnic-oms/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: file.type || "image/jpeg",
    });

    await s3Client.send(command);

    const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

    return NextResponse.json({
      url: publicUrl,
      key,
      file_name: file.name,
    });
  } catch (err: unknown) {
    console.error("S3 Upload Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload file to Amazon S3" },
      { status: 500 }
    );
  }
}
