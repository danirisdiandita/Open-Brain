#!/usr/bin/env bash
# Test the folder tree endpoint
# Usage: bash todo/test-folder-tree.sh <email> <password> <org_id> [base_url]

set -e

if [ $# -lt 3 ]; then
  echo "Usage: bash todo/test-folder-tree.sh <email> <password> <org_id> [base_url]"
  echo "  base_url defaults to http://localhost:8000/api/v1"
  exit 1
fi

EMAIL="$1"
PASSWORD="$2"
ORG_ID="$3"
BASE_URL="${4:-http://localhost:8000/api/v1}"

echo "=== 1. Login as $EMAIL ==="
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

ACCESS_TOKEN=$(echo "$LOGIN_RESP" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "ERROR: Login failed. Response:"
  echo "$LOGIN_RESP"
  exit 1
fi

echo "Token: ${ACCESS_TOKEN:0:20}..."
echo
echo "=== 2. GET /organizations/$ORG_ID/folders/tree ==="
curl -s -X GET "$BASE_URL/organizations/$ORG_ID/folders/tree" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -m json.tool
