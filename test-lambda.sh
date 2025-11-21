#!/bin/bash
# ← AWS LAMBDA FAST CLIPPING — TEST SCRIPT
# Test the Lambda function with a sample video clip

set -e

FUNCTION_NAME="clip-youtube-video"
REGION="us-east-1"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Testing Lambda Function${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Test payload (short clip from a YouTube video)
# Using a popular Creative Commons video
PAYLOAD='{
  "videoId": "jNQXAC9IVRw",
  "startTime": "0:05",
  "endTime": "0:10",
  "title": "Test Clip"
}'

echo -e "${BLUE}📤 Sending test request...${NC}"
echo -e "${YELLOW}Payload:${NC}"
echo "$PAYLOAD" | jq .

echo -e "\n${BLUE}⏳ Invoking Lambda (this may take 10-30 seconds)...${NC}\n"

# Invoke Lambda
RESPONSE=$(aws lambda invoke \
    --function-name $FUNCTION_NAME \
    --region $REGION \
    --payload "$PAYLOAD" \
    --cli-binary-format raw-in-base64-out \
    /tmp/lambda-response.json \
    --query 'StatusCode' \
    --output text 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Lambda invocation failed!${NC}"
    echo "$RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Lambda invocation completed (Status: $RESPONSE)${NC}\n"

# Parse response
if [ -f /tmp/lambda-response.json ]; then
    echo -e "${BLUE}📥 Response:${NC}"
    cat /tmp/lambda-response.json | jq .

    # Check if successful
    STATUS_CODE=$(cat /tmp/lambda-response.json | jq -r '.statusCode // 500')

    if [ "$STATUS_CODE" = "200" ]; then
        DOWNLOAD_URL=$(cat /tmp/lambda-response.json | jq -r '.body' | jq -r '.downloadUrl')

        echo -e "\n${GREEN}========================================${NC}"
        echo -e "${GREEN}✓ TEST SUCCESSFUL!${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo -e "${BLUE}Download URL:${NC}"
        echo -e "${GREEN}$DOWNLOAD_URL${NC}"
        echo -e "\n${YELLOW}Open this URL in your browser to download the clip!${NC}\n"
    else
        echo -e "\n${RED}❌ Test failed with status code: $STATUS_CODE${NC}"
        cat /tmp/lambda-response.json | jq -r '.body' | jq .
        exit 1
    fi

    rm /tmp/lambda-response.json
else
    echo -e "${RED}❌ No response file generated${NC}"
    exit 1
fi
