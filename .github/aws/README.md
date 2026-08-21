# Account-wide AWS access for GitHub Actions

One IAM role, assumable by **every repository owned by this GitHub account**,
with **no secrets stored in GitHub at all**. Set it up once; new repos need
nothing beyond a workflow that names the role.

This replaces per-repo access keys. There is nothing to copy into each new
repository and nothing to rotate.

## How it works

GitHub Actions can mint a short-lived, signed OIDC token describing the job
that asked for it — which repo, which branch, which environment. AWS is
configured to trust that issuer, and an IAM role's trust policy says which of
those tokens it will accept. The job trades the token for credentials that
expire in an hour.

The trust policy keys on **`repository_owner_id`** — the numeric id of the
GitHub account, `822434` — rather than on repository names. That choice matters:

- it covers every repo under the account, including ones created later, with no
  further AWS changes;
- it survives repository renames and transfers;
- it is unaffected by GitHub's July 2026 switch to *immutable subject claims*,
  which changed the `sub` claim for newly created repos from
  `repo:owner/repo:ref:refs/heads/main` to
  `repo:owner@822434/repo@123456:ref:refs/heads/main`. A trust policy matching
  `sub` against `repo:cmbeid/*` silently stops working for new repos. One
  matching `repository_owner_id` does not.

## Setup, with a script

Run once, with AWS credentials that can create IAM roles. Both scripts do the
same thing and drive the AWS CLI; pick whichever suits your machine.

**Windows** — `setup.ps1` is self-contained, so it also works copied anywhere:

```powershell
.\.github\aws\setup.ps1

# or with different targets
.\.github\aws\setup.ps1 -S3Bucket other-bucket -RoleName my-role
```

**macOS / Linux** — `setup.sh` reads the two policy files beside it, so run it
from a checkout:

```bash
.github/aws/setup.sh
S3_BUCKET=other-bucket ROLE_NAME=my-role .github/aws/setup.sh
```

Either checks its prerequisites first, then creates the OIDC provider, the role
and the S3 policy, and prints the role ARN. Both are idempotent — re-run to
change the bucket or widen permissions — and both name the inline policy
identically, so running one after the other does not leave duplicates.

### If you are on Windows PowerShell 5.1

`setup.ps1` supports it. Two 5.1-specific behaviours it works around, in case
you adapt the script:

- 5.1 turns a native command's stderr into an `ErrorRecord`, which under
  `$ErrorActionPreference = 'Stop'` becomes a terminating `NativeCommandError`
  even when the command succeeded. The AWS CLI is invoked with that preference
  scoped down, and success is judged by exit code alone.
- stderr and stdout are separated by record type rather than merged, because
  the CLI writes warnings to stderr even on success and merging them corrupts
  the JSON it writes to stdout.

## Setup, in the AWS console

Same result, if you would rather click. Roughly five minutes.

**1. Add the identity provider** — IAM → Identity providers → Add provider

- Provider type: **OpenID Connect**
- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`
- Click **Get thumbprint** if it insists. IAM validates this endpoint against
  its own trusted root CAs, so the stored value is not what actually secures
  it. If asked for one explicitly, GitHub's two documented intermediates are
  `6938fd4d98bab03faadb97b34396831e3780aea1` and
  `1c58a3a8518e8759bf075b76b750d4f2df264fcd` — supply both.

If it says a provider with that URL already exists, you are done with this
step — there is only ever one per account.

**2. Create the role** — IAM → Roles → Create role

- Trusted entity type: **Web identity**
- Identity provider: the one just created
- Audience: `sts.amazonaws.com`
- Skip the GitHub org/repo boxes — they generate a `sub` condition, which is
  the fragile kind. The next step replaces it.
- Skip permissions for now, name it `github-actions-s3-deploy`, create.

**3. Fix the trust policy** — open the role → Trust relationships → Edit

Replace the whole document with the contents of `trust-policy.json`,
substituting your 12-digit AWS account id for `__AWS_ACCOUNT_ID__` and leaving
`__GITHUB_OWNER_ID__` as `822434`.

**4. Attach permissions** — the role → Permissions → Add permissions →
Create inline policy → JSON

Paste `s3-deploy-policy.json`, replacing both `__S3_BUCKET__` placeholders
with `s3.cmbeid.com`. Name it anything.

Copy the role ARN from the top of the role page.

## Wiring up a repository

Add a **repository variable** (Settings → Secrets and variables → Actions →
Variables) named `AWS_ROLE_ARN`, set to the ARN the script printed:

```
arn:aws:iam::<account-id>:role/github-actions-s3-deploy
```

A variable, not a secret — the ARN is not sensitive, and it identifies rather
than authenticates. You can equally hardcode it in the workflow.

The workflow then needs two things, both already present in
`deploy-alchemy-forge.yml`:

```yaml
permissions:
  id-token: write        # lets the job request the OIDC token

- uses: aws-actions/configure-aws-credentials@v6
  with:
    role-to-assume: ${{ vars.AWS_ROLE_ARN }}
    aws-region: us-east-1
```

`deploy-alchemy-forge.yml` uses the role when `AWS_ROLE_ARN` is set and falls
back to `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` when it is not, so
switching over is a one-variable change and reversible.

## What this grants, and to whom

Any workflow in any repo owned by this account can assume the role, and the
role can read, write and delete objects in the target bucket — nothing else.

Pull requests from forks cannot use it: `id-token: write` is not granted to
fork PR runs, so no token is issued. The practical exposure is that anyone able
to push a workflow to one of your own repositories gets write access to that
bucket.

To narrow it, add a second condition to the trust policy so only jobs that
declare the `AWS` environment qualify:

```json
"token.actions.githubusercontent.com:environment": "AWS"
```

Jobs without `environment: AWS` are then denied, because the claim is absent.
`deploy-alchemy-forge.yml` already declares it. The cost is that every future
deploy workflow must remember to.

## Files

| | |
| --- | --- |
| `setup.ps1` | One-time AWS setup, Windows. Self-contained |
| `setup.sh` | The same, for macOS and Linux |
| `trust-policy.json` | Who may assume the role |
| `s3-deploy-policy.json` | What the role may do |

Both policies are templates — `setup.sh` substitutes the account id, owner id
and bucket name before uploading them.

## The alternative, and why not

GitHub has no account-level Actions secrets for personal accounts: secrets
exist only per repository or per environment. Organization-level secrets do
solve sharing, but they require moving repos into an Organization, and for
**private** repos org secrets need a paid plan (Team or above). They also still
leave you with long-lived keys to rotate. OIDC avoids all of it.
