# ← AWS LAMBDA FAST CLIPPING — REPLACES ALL LOCAL PROCESSING — WORKS INSTANTLY
# Lambda function for serverless YouTube video clipping using FFMPEG + yt-dlp
# Runtime: Python 3.12 | Timeout: 90s | Memory: 3008 MB

import json
import boto3
import subprocess
import os
import urllib.parse
import logging
from datetime import datetime

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize S3 client
s3 = boto3.client('s3')
BUCKET = 'youtube-clip-generator'

def time_to_seconds(time_str):
    """Convert MM:SS or HH:MM:SS to seconds"""
    parts = time_str.split(':')
    if len(parts) == 2:  # MM:SS
        return int(parts[0]) * 60 + int(parts[1])
    elif len(parts) == 3:  # HH:MM:SS
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    return int(time_str)

def lambda_handler(event, context):
    """
    Main Lambda handler for video clipping
    Expects: {videoId, startTime, endTime, title}
    Returns: {downloadUrl, title}
    """
    try:
        # Parse request body
        if 'body' in event:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event

        logger.info(f"Received request: {json.dumps(body)}")

        # Extract parameters
        video_id = body.get('videoId')
        start_time = body.get('startTime')
        end_time = body.get('endTime')
        title = body.get('title', 'clip')

        # Validate required fields
        if not all([video_id, start_time, end_time]):
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                'body': json.dumps({'error': 'Missing required fields: videoId, startTime, endTime'})
            }

        # Convert timestamps to seconds
        start_seconds = time_to_seconds(start_time)
        end_seconds = time_to_seconds(end_time)
        duration = end_seconds - start_seconds

        if duration <= 0:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'End time must be after start time'})
            }

        logger.info(f"Processing clip: {video_id} from {start_seconds}s to {end_seconds}s ({duration}s)")

        # Generate unique filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        clip_id = f"{video_id}_{start_seconds}_{end_seconds}_{timestamp}.mp4"
        output_file = f'/tmp/{clip_id}'

        # Construct YouTube URL
        youtube_url = f"https://www.youtube.com/watch?v={video_id}"

        # Step 1: Get direct stream URL with yt-dlp
        logger.info(f"Getting stream URL for: {youtube_url}")
        try:
            result = subprocess.run([
                '/opt/bin/yt-dlp',  # Path when using layer
                '--get-url',
                '-f', 'best[ext=mp4]/best',  # Prefer MP4 format
                '--no-check-certificates',
                youtube_url
            ], capture_output=True, text=True, timeout=30)

            if result.returncode != 0:
                logger.error(f"yt-dlp error: {result.stderr}")
                raise Exception(f"Failed to get video URL: {result.stderr}")

            direct_url = result.stdout.strip().split('\n')[0]  # Get first URL
            logger.info(f"Got stream URL: {direct_url[:100]}...")

        except subprocess.TimeoutExpired:
            logger.error("yt-dlp timeout")
            raise Exception("Video URL retrieval timed out")
        except Exception as e:
            logger.error(f"yt-dlp failed: {str(e)}")
            raise Exception(f"Failed to retrieve video: {str(e)}")

        # Step 2: Trim with ffmpeg (fast copy mode)
        logger.info(f"Trimming video with ffmpeg")
        try:
            ffmpeg_result = subprocess.run([
                '/opt/bin/ffmpeg',  # Path when using layer
                '-ss', str(start_seconds),  # Seek to start (fast)
                '-i', direct_url,
                '-t', str(duration),  # Duration
                '-c', 'copy',  # Fast copy (no re-encoding)
                '-avoid_negative_ts', 'make_zero',
                '-y',  # Overwrite
                output_file
            ], capture_output=True, text=True, timeout=60)

            if ffmpeg_result.returncode != 0:
                logger.error(f"ffmpeg error: {ffmpeg_result.stderr}")
                # Try with re-encoding as fallback
                logger.info("Trying with re-encoding...")
                ffmpeg_result = subprocess.run([
                    '/opt/bin/ffmpeg',
                    '-ss', str(start_seconds),
                    '-i', direct_url,
                    '-t', str(duration),
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-c:a', 'aac',
                    '-y',
                    output_file
                ], capture_output=True, text=True, timeout=60)

                if ffmpeg_result.returncode != 0:
                    raise Exception(f"FFMPEG failed: {ffmpeg_result.stderr}")

            # Verify file was created
            if not os.path.exists(output_file):
                raise Exception("Output file was not created")

            file_size = os.path.getsize(output_file)
            logger.info(f"Created clip: {output_file} ({file_size} bytes)")

        except subprocess.TimeoutExpired:
            logger.error("ffmpeg timeout")
            raise Exception("Video processing timed out")
        except Exception as e:
            logger.error(f"ffmpeg failed: {str(e)}")
            raise Exception(f"Video processing failed: {str(e)}")

        # Step 3: Upload to S3
        logger.info(f"Uploading to S3: s3://{BUCKET}/clips/{clip_id}")
        try:
            s3.upload_file(
                output_file,
                BUCKET,
                f"clips/{clip_id}",
                ExtraArgs={
                    'ACL': 'public-read',
                    'ContentType': 'video/mp4',
                    'ContentDisposition': f'attachment; filename="{urllib.parse.quote(title)}.mp4"'
                }
            )
            logger.info("Upload successful")
        except Exception as e:
            logger.error(f"S3 upload failed: {str(e)}")
            raise Exception(f"Upload to S3 failed: {str(e)}")
        finally:
            # Clean up temp file
            if os.path.exists(output_file):
                os.remove(output_file)
                logger.info(f"Cleaned up temp file: {output_file}")

        # Generate public URL
        public_url = f"https://{BUCKET}.s3.amazonaws.com/clips/{clip_id}"

        logger.info(f"✓ Success! Public URL: {public_url}")

        # Return success response
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': json.dumps({
                'downloadUrl': public_url,
                'title': title,
                'duration': duration,
                'fileSize': file_size if 'file_size' in locals() else None
            })
        }

    except Exception as e:
        logger.error(f"Lambda execution failed: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': json.dumps({
                'error': str(e),
                'message': 'Video clipping failed. Please try again.'
            })
        }
