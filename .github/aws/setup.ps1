#Requires -Version 5.1
<#
.SYNOPSIS
    One-time AWS setup so every GitHub repo under this account can deploy to S3
    without any stored credentials.

.DESCRIPTION
    Creates three things, using the AWS CLI:

      1. an IAM OIDC identity provider for GitHub Actions (one per AWS account)
      2. an IAM role that any repo owned by -GitHubOwnerId may assume
      3. an inline policy letting that role write to the bucket

    Self-contained: the IAM policies are embedded, so this file can be run from
    anywhere. Idempotent — running it again updates the policies in place
    rather than failing.

    Afterwards there is nothing secret to add to GitHub. The role ARN it prints
    goes in a repository *variable* named AWS_ROLE_ARN.

.PARAMETER GitHubOwnerId
    Numeric id of the GitHub user or organisation that owns the repositories.
    Deliberately the numeric id rather than the name: it is immutable, so the
    trust policy survives renames, transfers, and GitHub's July 2026 switch to
    immutable OIDC subject claims.

.PARAMETER S3Bucket
    Bucket the role is allowed to write to.

.PARAMETER RoleName
    Name of the IAM role to create or update.

.EXAMPLE
    .\setup.ps1

.EXAMPLE
    .\setup.ps1 -S3Bucket other-bucket -RoleName my-deploy-role
#>
[CmdletBinding()]
param(
    [string] $GitHubOwnerId = '822434',
    [string] $S3Bucket      = 's3.cmbeid.com',
    [string] $RoleName      = 'github-actions-s3-deploy'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --- Helpers ----------------------------------------------------------------

# Runs the AWS CLI without letting stderr trip PowerShell's error handling, and
# hands back the exit code so callers can decide what a failure means. Some of
# the calls below are existence probes where a non-zero exit is the expected,
# uninteresting answer.
function Invoke-Aws {
    param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Arguments)

    $output = & aws @Arguments 2>&1
    [pscustomobject]@{
        ExitCode = $LASTEXITCODE
        Output   = ($output | Out-String).Trim()
    }
}

# Prints a plain, readable message and stops. Write-Error and throw both render
# with source-line squiggles and flatten multi-line text, which is no use to
# someone running this blind.
function Stop-WithMessage {
    param([Parameter(Mandatory = $true)] [string] $Message)

    Write-Host ''
    foreach ($line in ($Message -split "`r?`n")) {
        Write-Host $line -ForegroundColor Red
    }
    Write-Host ''
    exit 1
}

function Assert-Aws {
    param(
        [Parameter(Mandatory = $true)] [string] $Activity,
        [Parameter(ValueFromRemainingArguments = $true)] [string[]] $Arguments
    )

    $result = Invoke-Aws @Arguments
    if ($result.ExitCode -ne 0) {
        Stop-WithMessage "$Activity failed (aws exit code $($result.ExitCode)).`n`nThe CLI said:`n$($result.Output)"
    }
    $result.Output
}

# The AWS CLI reads policy documents from disk rather than the command line,
# which sidesteps Windows' quoting rules entirely. The encoding matters: a
# UTF-8 BOM makes the CLI's JSON parser reject the file.
function New-JsonTempFile {
    param([Parameter(Mandatory = $true)] [string] $Content)

    $path = Join-Path ([System.IO.Path]::GetTempPath()) ("aws-oidc-{0}.json" -f [guid]::NewGuid())
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, $Content, $utf8NoBom)
    $path
}

# --- Policy documents -------------------------------------------------------

$trustPolicyTemplate = @'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "GitHubActionsFromThisAccountOnly",
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::__AWS_ACCOUNT_ID__:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:repository_owner_id": "__GITHUB_OWNER_ID__"
        }
      }
    }
  ]
}
'@

$s3PolicyTemplate = @'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListTheBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::__S3_BUCKET__"
    },
    {
      "Sid": "WriteObjects",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:PutObjectAcl", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::__S3_BUCKET__/*"
    }
  ]
}
'@

# --- 0. Preflight -----------------------------------------------------------
# Fail here, with a useful message, rather than halfway through creating things.

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Stop-WithMessage @'
The AWS CLI is not installed, or is not on PATH.

Install it with:   winget install --id Amazon.AWSCLI
or download from:  https://awscli.amazonaws.com/AWSCLIV2.msi

If you have just installed it, open a new terminal so PATH is picked up.
Alternatively, follow the click-through steps in .github/aws/README.md.
'@
}

$identity = Invoke-Aws sts get-caller-identity --output json
if ($identity.ExitCode -ne 0) {
    Stop-WithMessage @"
AWS credentials are missing, expired, or invalid.

Run 'aws configure' (or set `$env:AWS_PROFILE) with an identity allowed to
create IAM roles, then run this again.

The CLI said:
$($identity.Output)
"@
}

$caller     = $identity.Output | ConvertFrom-Json
$accountId  = $caller.Account
$providerArn = "arn:aws:iam::${accountId}:oidc-provider/token.actions.githubusercontent.com"
$roleArn     = "arn:aws:iam::${accountId}:role/${RoleName}"

Write-Host ''
Write-Host "AWS account   : $accountId"
Write-Host "Identity      : $($caller.Arn)"
Write-Host "GitHub owner  : $GitHubOwnerId"
Write-Host "Bucket        : $S3Bucket"
Write-Host "Role          : $RoleName"
Write-Host ''

# A typo in the bucket name would produce a role that silently cannot deploy.
$bucketProbe = Invoke-Aws s3api head-bucket --bucket $S3Bucket
if ($bucketProbe.ExitCode -ne 0) {
    Write-Warning "Cannot see bucket '$S3Bucket' with these credentials. Continuing anyway - the role's policy does not require the bucket to be visible to you right now - but check the name."
    Write-Host ''
}

# --- 1. OIDC provider -------------------------------------------------------
# There can only be one provider per URL per account, so this is a no-op after
# the first run. No thumbprint is passed: since July 2023 IAM validates
# GitHub's certificate against its own trusted root CAs, and the field is
# optional.

$existingProvider = Invoke-Aws iam get-open-id-connect-provider `
    --open-id-connect-provider-arn $providerArn

if ($existingProvider.ExitCode -eq 0) {
    Write-Host 'OIDC provider already exists, leaving it alone.'
}
else {
    Write-Host 'Creating OIDC provider...'
    [void] (Assert-Aws -Activity 'Creating the OIDC provider' `
        iam create-open-id-connect-provider `
        --url https://token.actions.githubusercontent.com `
        --client-id-list sts.amazonaws.com)
}

# --- 2. Role ----------------------------------------------------------------

$trustPath = New-JsonTempFile -Content (
    $trustPolicyTemplate `
        -replace '__AWS_ACCOUNT_ID__', $accountId `
        -replace '__GITHUB_OWNER_ID__', $GitHubOwnerId
)

try {
    $existingRole = Invoke-Aws iam get-role --role-name $RoleName

    if ($existingRole.ExitCode -eq 0) {
        Write-Host 'Role exists, updating its trust policy...'
        [void] (Assert-Aws -Activity 'Updating the trust policy' `
            iam update-assume-role-policy `
            --role-name $RoleName `
            --policy-document "file://$trustPath")
    }
    else {
        Write-Host 'Creating role...'
        [void] (Assert-Aws -Activity 'Creating the role' `
            iam create-role `
            --role-name $RoleName `
            --description "GitHub Actions deploys for repos owned by $GitHubOwnerId" `
            --max-session-duration 3600 `
            --assume-role-policy-document "file://$trustPath")
    }

    # --- 3. Permissions -----------------------------------------------------

    # Dots become dashes so this matches the name setup.sh uses; otherwise
    # running both scripts would leave two duplicate inline policies behind.
    $policyName = 's3-deploy-' + ($S3Bucket -replace '[^A-Za-z0-9+=,@_-]', '-')
    $permsPath  = New-JsonTempFile -Content ($s3PolicyTemplate -replace '__S3_BUCKET__', $S3Bucket)

    try {
        Write-Host 'Attaching the S3 policy...'
        [void] (Assert-Aws -Activity 'Attaching the S3 policy' `
            iam put-role-policy `
            --role-name $RoleName `
            --policy-name $policyName `
            --policy-document "file://$permsPath")
    }
    finally {
        Remove-Item $permsPath -Force -ErrorAction SilentlyContinue
    }
}
finally {
    Remove-Item $trustPath -Force -ErrorAction SilentlyContinue
}

# --- Done -------------------------------------------------------------------

Write-Host ''
Write-Host 'Done. Use this role ARN - it is not a secret:' -ForegroundColor Green
Write-Host ''
Write-Host "    $roleArn" -ForegroundColor Cyan
Write-Host ''
Write-Host 'Next, in each repository that deploys:'
Write-Host '    Settings -> Secrets and variables -> Actions -> Variables tab'
Write-Host '    -> New repository variable'
Write-Host '       Name:  AWS_ROLE_ARN'
Write-Host "       Value: $roleArn"
Write-Host ''
Write-Host 'That is a variable, not a secret. Once set, the workflow stops using'
Write-Host 'access keys and you can delete them.'
Write-Host ''
