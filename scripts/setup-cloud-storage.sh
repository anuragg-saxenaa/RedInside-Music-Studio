#!/usr/bin/env bash
# One-time setup: creates Railway object storage bucket, wires S3 creds into
# both local config/.env and Railway service vars, sets STORAGE_DRIVER=r2.
# Run once: bash scripts/setup-cloud-storage.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/config/.env"
BUCKET_NAME="redinside-storage"

echo "==> Checking Railway login..."
if ! railway whoami &>/dev/null; then
  echo "    Not logged in — opening browser login..."
  railway login --browser
fi
echo "    Logged in as: $(railway whoami)"

echo ""
echo "==> Linking Railway project..."
railway link --project e4ebb35d-aaa2-4449-9090-650e61a3659c --environment production 2>/dev/null || true

echo ""
echo "==> Creating bucket (skip if exists)..."
railway bucket create "$BUCKET_NAME" --region sjc --json 2>/dev/null || echo "    (bucket may already exist, continuing)"

echo ""
echo "==> Fetching bucket credentials..."
CREDS_JSON=$(railway bucket credentials --bucket "$BUCKET_NAME" --json)
echo "    Got credentials."

# Parse credentials
ENDPOINT=$(echo "$CREDS_JSON"   | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('endpoint',''))")
ACCESS_KEY=$(echo "$CREDS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessKeyId',''))")
SECRET_KEY=$(echo "$CREDS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('secretAccessKey',''))")
BUCKET=$(echo "$CREDS_JSON"     | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('bucket', d.get('name','')))")

if [ -z "$ACCESS_KEY" ]; then
  echo "ERROR: Could not parse credentials. Raw JSON:"
  echo "$CREDS_JSON"
  exit 1
fi

# Extract account ID from endpoint (https://<accountId>.r2.cloudflarestorage.com or similar)
ACCOUNT_ID=$(echo "$ENDPOINT" | python3 -c "
import sys, re
url = sys.stdin.read().strip()
m = re.search(r'https?://([^./:]+)', url)
print(m.group(1) if m else 'railway')
")

echo "    Endpoint:   $ENDPOINT"
echo "    Bucket:     $BUCKET"
echo "    AccountID:  $ACCOUNT_ID"

echo ""
echo "==> Updating local config/.env..."
python3 - "$ENV_FILE" "$ACCOUNT_ID" "$ACCESS_KEY" "$SECRET_KEY" "$BUCKET" "$ENDPOINT" << 'PYEOF'
import sys, re

env_file, account_id, access_key, secret_key, bucket, endpoint = sys.argv[1:]

with open(env_file, 'r') as f:
    content = f.read()

# Remove existing R2/storage driver lines
content = re.sub(r'^(STORAGE_DRIVER|R2_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_BUCKET_NAME|R2_ENDPOINT)=.*\n?', '', content, flags=re.MULTILINE)
# Remove blank lines at end then add one newline
content = content.rstrip() + '\n'

block = f"""
# Cloud Storage (Railway S3 — shared local + prod)
STORAGE_DRIVER=r2
R2_ACCOUNT_ID={account_id}
R2_ACCESS_KEY_ID={access_key}
R2_SECRET_ACCESS_KEY={secret_key}
R2_BUCKET_NAME={bucket}
"""
content += block

with open(env_file, 'w') as f:
    f.write(content)
print("    .env updated.")
PYEOF

echo ""
echo "==> Setting Railway service environment variables..."
railway variables set \
  STORAGE_DRIVER=r2 \
  "R2_ACCOUNT_ID=$ACCOUNT_ID" \
  "R2_ACCESS_KEY_ID=$ACCESS_KEY" \
  "R2_SECRET_ACCESS_KEY=$SECRET_KEY" \
  "R2_BUCKET_NAME=$BUCKET"

echo ""
echo "========================================"
echo "  DONE — cloud storage fully wired!"
echo "========================================"
echo ""
echo "  Bucket:   $BUCKET"
echo "  Endpoint: $ENDPOINT"
echo ""
echo "  Next:"
echo "    1. Restart local backend: cd backend && npm run dev"
echo "    2. Railway auto-redeploying with R2 — wait ~1 min"
echo "    3. All MP3s and artwork now in shared cloud bucket"
echo "    4. Local <-> production fully in sync"
