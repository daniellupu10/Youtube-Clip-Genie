import fsp from "fs/promises";
import fs from "fs";
import { spawn } from "child_process";
import https from "https";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION;
const bucketName = process.env.BUCKET_NAME;
const ytDlpPath = "/tmp/yt-dlp";
const s3 = new S3Client({ region });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function downloadYtDlp() {
  try {
    await fsp.stat(ytDlpPath);
    console.log("yt-dlp already exists in /tmp");
    return;
  } catch {
    console.log("Downloading yt-dlp...");
    // Fix: Add JSDoc to explicitly type the promise, which resolves the error on the parameter-less resolve() call.
    /** @type {Promise<void>} */
    const downloadCompletePromise = new Promise((resolve, reject) => {
      const file = fs.createWriteStream(ytDlpPath);
      https.get("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp", (res) => {
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      }).on("error", (err) => {
        fs.unlink(ytDlpPath, () => {});
        reject(err);
      });
    });
    await downloadCompletePromise;
    await fsp.chmod(ytDlpPath, 0o755);
    console.log("yt-dlp downloaded and made executable.");
  }
}

async function clipVideo(videoId, startTime, endTime, title) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const safeFilename = `${title.replace(/[^a-z0-9_-]/gi, "_").slice(0, 50)}_${Date.now()}.mp4`;
  const tempFile = `/tmp/${safeFilename}`;

  const args = [
    videoUrl,
    "--download-sections", `*${startTime}-${endTime}`,
    "-f", "best[ext=mp4]/best",
    "-o", tempFile,
    "--force-keyframes-at-cuts",
    "--no-playlist",
  ];

  console.log("Running yt-dlp with args:", args.join(" "));
  // Fix: Explicitly type the promise and await it on a separate line to fix type inference for procResult.
  /** @type {Promise<{code: number | null, stdout: string, stderr: string}>} */
  const procPromise = new Promise((resolve, reject) => {
    const proc = spawn(ytDlpPath, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data) => (stdout += data.toString()));
    proc.stderr.on("data", (data) => (stderr += data.toString()));
    proc.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    proc.on("error", (err) => {
      reject(err);
    });
  });

  const procResult = await procPromise;

  console.log(`yt-dlp exited with code ${procResult.code}.`);
  console.log('yt-dlp stdout:', procResult.stdout);
  console.log('yt-dlp stderr:', procResult.stderr);

  if (procResult.code !== 0) {
    throw new Error(`yt-dlp failed: ${procResult.stderr}`);
  }

  try {
    await fsp.stat(tempFile);
    console.log("Output file found at", tempFile);
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new Error(`yt-dlp reported success, but output file was not created. Stderr: ${procResult.stderr}`);
    }
    throw e;
  }

  const fileData = await fsp.readFile(tempFile);
  await fsp.unlink(tempFile);
  return { fileData, safeFilename };
}

export const handler = async (event) => {
  if ((event.requestContext?.http?.method ?? event.httpMethod) === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { videoId, startTime, endTime, title } = body;

    if (!videoId || !startTime || !endTime || !title) {
      throw new Error("Missing required parameters.");
    }
    if (!bucketName) {
      throw new Error("BUCKET_NAME environment variable is not set.");
    }

    await downloadYtDlp();
    const { fileData, safeFilename } = await clipVideo(videoId, startTime, endTime, title);

    console.log(`Uploading ${safeFilename} to S3 bucket ${bucketName}...`);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: safeFilename,
        Body: fileData,
        ContentType: "video/mp4",
      })
    );
    console.log("S3 upload successful.");

    const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${encodeURIComponent(safeFilename)}`;

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ downloadUrl: publicUrl }),
    };
  } catch (err) {
    console.error("Handler Error:", err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};