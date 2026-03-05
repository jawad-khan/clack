#!/bin/bash
set -euo pipefail

# Rebuild the base image (only needed when package.json or prisma schema changes)

GCP_PROJECT_ID="${GCP_PROJECT_ID:-ncvgl-gcp}"
IMAGE="us-central1-docker.pkg.dev/${GCP_PROJECT_ID}/cloud-run-source-deploy/slawk-base"

echo "Building base image..."
echo "  Image: ${IMAGE}:latest"
echo ""

gcloud builds submit . \
  --project "${GCP_PROJECT_ID}" \
  --config cloudbuild.base.yaml \
  --substitutions="_IMAGE=${IMAGE}"

echo ""
echo "Base image built and pushed: ${IMAGE}:latest"
