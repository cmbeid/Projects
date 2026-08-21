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

# --- 0. Preflight -----------------------------------------------------------
# Fail here, with a useful message, rather than halfway through creating things.
if ! command -v aws >/dev/null 2>&1; then
  echo "The AWS CLI is not installed. Either install it:" >&2
  echo "  https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html" >&2
  echo "or follow the click-through steps in .github/aws/README.md." >&2
  exit 1
fi

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "AWS credentials are missing, expired, or invalid." >&2
  echo "Run 'aws configure' (or export AWS_PROFILE) with an identity that can" >&2
  echo "create IAM roles, then run this again." >&2
  exit 1
fi

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
echo "Identity      : $(aws sts get-caller-identity --query Arn --output text)"
echo

# A typo in the bucket name would produce a role that silently cannot deploy.
if ! aws s3api head-bucket --bucket "${S3_BUCKET}" >/dev/null 2>&1; then
  echo "Warning: cannot see bucket '${S3_BUCKET}' with these credentials." >&2
  echo "         Continuing anyway — the role's policy does not require the" >&2
  echo "         bucket to be visible to you right now — but check the name." >&2
  echo >&2
fi

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
echo "Next, in each repository that deploys:"
echo "  Settings -> Secrets and variables -> Actions -> Variables tab"
echo "  -> New repository variable"
echo "     Name:  AWS_ROLE_ARN"
echo "     Value: arn:aws:iam::${account_id}:role/${ROLE_NAME}"
echo
echo "That is a variable, not a secret. Once set, the workflow stops using"
echo "access keys and you can delete them."
