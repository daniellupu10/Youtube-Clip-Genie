#!/bin/bash
# ← AWS LAMBDA FAST CLIPPING — DEPLOYMENT SCRIPT — PRODUCTION READY
# Deploy Lambda function for serverless YouTube video clipping
# Run this script to create/update the Lambda function

set -e  # Exit on error

# Configuration
FUNCTION_NAME="clip-youtube-video"
RUNTIME="python3.12"
HANDLER="lambda_function.lambda_handler"
TIMEOUT=90
MEMORY=3008
REGION="us-east-1"
BUCKET="youtube-clip-generator"

# FFMPEG Layer ARN (pre-built for us-east-1, updated 2025)
FFMPEG_LAYER_ARN="arn:aws:lambda:us-east-1:331865373084:layer:ffmpeg-yt-dlp:10"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AWS Lambda Deployment Script${NC}"
echo -e "${BLUE}  Function: ${FUNCTION_NAME}${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first:${NC}"
    echo "   curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip'"
    echo "   unzip awscliv2.zip && sudo ./aws/install"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Run:${NC}"
    echo "   aws configure"
    exit 1
fi

echo -e "${GREEN}✓ AWS credentials configured${NC}"

# Create deployment package
echo -e "\n${BLUE}📦 Creating deployment package...${NC}"

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copy Lambda function
cp lambda_function.py $TEMP_DIR/

# Create ZIP
cd $TEMP_DIR
zip -r lambda_deployment.zip lambda_function.py > /dev/null
cd - > /dev/null

echo -e "${GREEN}✓ Deployment package created: $(du -h $TEMP_DIR/lambda_deployment.zip | cut -f1)${NC}"

# Check if IAM role exists
ROLE_NAME="lambda-video-clipper-role"
echo -e "\n${BLUE}🔐 Checking IAM role...${NC}"

if ! aws iam get-role --role-name $ROLE_NAME &> /dev/null; then
    echo -e "${YELLOW}⚠️  Role not found. Creating IAM role: ${ROLE_NAME}${NC}"

    # Create trust policy
    cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    # Create role
    aws iam create-role \
        --role-name $ROLE_NAME \
        --assume-role-policy-document file:///tmp/trust-policy.json \
        > /dev/null

    # Attach basic Lambda execution policy
    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

    # Create and attach S3 access policy
    cat > /tmp/s3-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::${BUCKET}/clips/*"
    }
  ]
}
EOF

    aws iam put-role-policy \
        --role-name $ROLE_NAME \
        --policy-name S3ClipAccess \
        --policy-document file:///tmp/s3-policy.json

    echo -e "${GREEN}✓ IAM role created: ${ROLE_NAME}${NC}"
    echo -e "${YELLOW}⏳ Waiting 10 seconds for IAM role to propagate...${NC}"
    sleep 10
else
    echo -e "${GREEN}✓ IAM role exists: ${ROLE_NAME}${NC}"
fi

# Get role ARN
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)
echo -e "${GREEN}✓ Role ARN: ${ROLE_ARN}${NC}"

# Check if Lambda function exists
echo -e "\n${BLUE}🚀 Deploying Lambda function...${NC}"

if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION &> /dev/null; then
    echo -e "${YELLOW}⚠️  Function exists. Updating code...${NC}"

    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --region $REGION \
        --zip-file fileb://$TEMP_DIR/lambda_deployment.zip \
        > /dev/null

    echo -e "${GREEN}✓ Function code updated${NC}"

    echo -e "${BLUE}⚙️  Updating configuration...${NC}"

    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --region $REGION \
        --runtime $RUNTIME \
        --handler $HANDLER \
        --timeout $TIMEOUT \
        --memory-size $MEMORY \
        --layers $FFMPEG_LAYER_ARN \
        --environment "Variables={S3_BUCKET=$BUCKET}" \
        > /dev/null

    echo -e "${GREEN}✓ Function configuration updated${NC}"

else
    echo -e "${YELLOW}⚠️  Function not found. Creating new function...${NC}"

    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --region $REGION \
        --runtime $RUNTIME \
        --role $ROLE_ARN \
        --handler $HANDLER \
        --timeout $TIMEOUT \
        --memory-size $MEMORY \
        --zip-file fileb://$TEMP_DIR/lambda_deployment.zip \
        --layers $FFMPEG_LAYER_ARN \
        --environment "Variables={S3_BUCKET=$BUCKET}" \
        > /dev/null

    echo -e "${GREEN}✓ Function created${NC}"
fi

# Get function details
FUNCTION_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text)

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✓ DEPLOYMENT SUCCESSFUL!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${BLUE}Function Name:${NC} $FUNCTION_NAME"
echo -e "${BLUE}Function ARN:${NC} $FUNCTION_ARN"
echo -e "${BLUE}Runtime:${NC} $RUNTIME"
echo -e "${BLUE}Memory:${NC} $MEMORY MB"
echo -e "${BLUE}Timeout:${NC} $TIMEOUT seconds"
echo -e "${BLUE}Region:${NC} $REGION"
echo -e "${BLUE}S3 Bucket:${NC} $BUCKET"

# Check if API Gateway exists
echo -e "\n${BLUE}🔍 Checking API Gateway integration...${NC}"
echo -e "${YELLOW}Current endpoint in config.ts:${NC}"
cat services/config.ts

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}NEXT STEPS:${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "1. ${YELLOW}Set up API Gateway${NC} (if not already done):"
echo -e "   - Go to AWS Console → API Gateway"
echo -e "   - Create HTTP API or REST API"
echo -e "   - Create POST route /export-mp4"
echo -e "   - Integrate with Lambda: $FUNCTION_NAME"
echo -e "   - Deploy to production stage"
echo -e ""
echo -e "2. ${YELLOW}Update services/config.ts${NC} with your API Gateway URL:"
echo -e "   export const API_CONFIG = {"
echo -e "     EXPORT_MP4_ENDPOINT: 'https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/export-mp4',"
echo -e "   };"
echo -e ""
echo -e "3. ${YELLOW}Test the Lambda function:${NC}"
echo -e "   ./test-lambda.sh"
echo -e ""
echo -e "4. ${YELLOW}Deploy your frontend:${NC}"
echo -e "   git add . && git commit -m 'feat: AWS Lambda serverless video clipping'"
echo -e "   git push origin $(git branch --show-current)"
echo -e ""

echo -e "${GREEN}✓ Done! Your serverless video clipper is ready!${NC}\n"
