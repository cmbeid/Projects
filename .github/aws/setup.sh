#!/usr/bin/env bash
#
# One-time AWS setup so every GitHub repo under this account can deploy to S3
# without any stored credentials.
#
# Creates:
#   1. an IAM OIDC identity provider for GitHub Actions (one per AWS account)
#   2. an IAM role that any repo owned by GITHUB_OWNER_ID may assume
#   3. an inline policy letting that role write to the bucket
#
# Run it once, with admin AWS credentials. It is idempotent — running it again
# updates the policies in place rather than failing.
#
# Afterwards there is nothing to add to GitHub: the role ARN it prints is not a
# secret. Put it in a repository (or organization) variable named AWS_ROLE_ARN,
# or paste it straight into a workflow.

set -euo pipefail

GITHUB_OWNER_ID="${GITHUB_OWNER_ID:-822434}"   # numeric id of the GitHub user/org
S3_BUCKET="${S3_BUCKET:-s3.cmbeid.com}"
ROLE_NAME="${ROLE_NAME:-github-actions-s3-deploy}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
account_id="$(aws sts get-caller-identity --query Account --output text)"
provider_arn="arn:aws:iam::${account_id}:oidc-provider/token.actions.githubusercontent.com"

echo "AWS account   : ${account_id}"
echo "GitHub owner  : ${GITHUB_OWNER_ID}"
echo "Bucket        : ${S3_BUCKET}"
echo "Role          : ${ROLE_NAME}"
echo

# --- 1. OIDC provider -------------------------------------------------------
# There can only be one provider per URL per account, so this is a no-op after
# the first run. No thumbprint is passed: since July 2023 IAM validates GitHub's
# certificate against its own trusted root CAs, and the field is optional.
if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "${provider_arn}" >/dev/null 2>&1; then
  echo "OIDC provider already exists, leaving it alone."
else
  echo "Creating OIDC provider..."
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com >/dev/null
fi

# --- 2. Role ----------------------------------------------------------------
trust="$(mktemp)"
sed -e "s|__AWS_ACCOUNT_ID__|${account_id}|g" \
    -e "s|__GITHUB_OWNER_ID__|${GITHUB_OWNER_ID}|g" \
    "${here}/trust-policy.json" > "${trust}"

if aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  echo "Role exists, updating its trust policy..."
  aws iam update-assume-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-document "file://${trust}"
else
  echo "Creating role..."
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --description "GitHub Actions deploys for repos owned by ${GITHUB_OWNER_ID}" \
    --max-session-duration 3600 \
    --assume-role-policy-document "file://${trust}" >/dev/null
fi

# --- 3. Permissions ---------------------------------------------------------
perms="$(mktemp)"
sed -e "s|__S3_BUCKET__|${S3_BUCKET}|g" "${here}/s3-deploy-policy.json" > "${perms}"

aws iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name "s3-deploy-${S3_BUCKET//./-}" \
  --policy-document "file://${perms}"

rm -f "${trust}" "${perms}"

echo
echo "Done. Use this role ARN — it is not a secret:"
echo
echo "  arn:aws:iam::${account_id}:role/${ROLE_NAME}"
echo
echo "Set it as a repository or organization variable named AWS_ROLE_ARN and"
echo "the deploy workflow will stop using access keys."
