#!/bin/bash
# Deploy Node.js Lambda function for video clipping
# This deploys the existing lambda/index.mjs file

set -e

# Configuration
FUNCTION_NAME="export-mp4-clipper"
RUNTIME="nodejs20.x"
HANDLER="index.handler"
TIMEOUT=90
MEMORY=3008
REGION="us-east-1"
BUCKET="youtube-clip-generator"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Deploying Node.js Lambda${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    exit 1
fi

echo -e "${GREEN}✓ AWS credentials configured${NC}"

# Create deployment package
echo -e "\n${BLUE}📦 Creating deployment package...${NC}"

cd lambda
npm init -y 2>/dev/null || true
npm install @aws-sdk/client-s3 2>/dev/null || true

zip -r ../lambda-nodejs.zip . > /dev/null
cd ..

echo -e "${GREEN}✓ Package created: $(du -h lambda-nodejs.zip | cut -f1)${NC}"

# Check/create IAM role
ROLE_NAME="lambda-video-clipper-role"
echo -e "\n${BLUE}🔐 Checking IAM role...${NC}"

if ! aws iam get-role --role-name $ROLE_NAME &> /dev/null; then
    echo -e "${YELLOW}Creating IAM role...${NC}"

    cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

    aws iam create-role \
        --role-name $ROLE_NAME \
        --assume-role-policy-document file:///tmp/trust-policy.json > /dev/null

    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

    cat > /tmp/s3-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:PutObjectAcl"],
    "Resource": "arn:aws:s3:::${BUCKET}/*"
  }]
}
EOF

    aws iam put-role-policy \
        --role-name $ROLE_NAME \
        --policy-name S3Access \
        --policy-document file:///tmp/s3-policy.json

    echo -e "${YELLOW}Waiting for IAM role propagation...${NC}"
    sleep 10
fi

ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)
echo -e "${GREEN}✓ Role ARN: ${ROLE_ARN}${NC}"

# Deploy Lambda
echo -e "\n${BLUE}🚀 Deploying Lambda function...${NC}"

if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION &> /dev/null; then
    echo -e "${YELLOW}Updating existing function...${NC}"

    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --region $REGION \
        --zip-file fileb://lambda-nodejs.zip > /dev/null

    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --region $REGION \
        --runtime $RUNTIME \
        --handler $HANDLER \
        --timeout $TIMEOUT \
        --memory-size $MEMORY \
        --environment "Variables={AWS_REGION=$REGION,BUCKET_NAME=$BUCKET}" > /dev/null

    echo -e "${GREEN}✓ Function updated${NC}"
else
    echo -e "${YELLOW}Creating new function...${NC}"

    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --region $REGION \
        --runtime $RUNTIME \
        --role $ROLE_ARN \
        --handler $HANDLER \
        --timeout $TIMEOUT \
        --memory-size $MEMORY \
        --zip-file fileb://lambda-nodejs.zip \
        --environment "Variables={AWS_REGION=$REGION,BUCKET_NAME=$BUCKET}" > /dev/null

    echo -e "${GREEN}✓ Function created${NC}"
fi

# Cleanup
rm -f lambda-nodejs.zip

FUNCTION_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text)

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✓ DEPLOYMENT SUCCESSFUL!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${BLUE}Function Name:${NC} $FUNCTION_NAME"
echo -e "${BLUE}Function ARN:${NC} $FUNCTION_ARN"
echo -e "${BLUE}Runtime:${NC} $RUNTIME"

echo -e "\n${YELLOW}NEXT: Connect this Lambda to your API Gateway endpoint${NC}"
echo -e "${YELLOW}https://rybj0g2kpd.execute-api.us-east-1.amazonaws.com/export-mp4${NC}\n"
