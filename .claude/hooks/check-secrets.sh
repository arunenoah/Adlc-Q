#!/usr/bin/env bash
#
# Claude Code PreToolUse hook — scans staged files for secrets before git commit/push.
# Exit code 2 = block the action. Stderr is shown to the user.
#

set -euo pipefail

# Read the tool input from stdin (JSON with tool_name + tool_input)
INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null || echo "")
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

# Only check git commit and git push commands
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

case "$COMMAND" in
  *"git commit"*|*"git push"*)
    ;;
  *)
    exit 0
    ;;
esac

# Get staged files (empty list is fine — nothing to check)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

VIOLATIONS=""

while IFS= read -r file; do
  [ -z "$file" ] && continue
  # Skip binary files
  if file --mime "$file" 2>/dev/null | grep -q "charset=binary"; then
    continue
  fi

  # 1. Block .env files from being committed
  case "$file" in
    .env|.env.*|**/.env|**/.env.*)
      VIOLATIONS="${VIOLATIONS}\n  - ${file} (environment file)"
      continue
      ;;
  esac

  # Skip non-text files that might cause false positives
  case "$file" in
    *.lock|*.png|*.jpg|*.jpeg|*.gif|*.svg|*.ico|*.woff|*.woff2|*.ttf|*.eot|*.pdf)
      continue
      ;;
  esac

  # 2. Scan file contents for secret patterns
  CONTENT=$(cat "$file" 2>/dev/null || true)
  [ -z "$CONTENT" ] && continue

  # AWS Access Key IDs
  if echo "$CONTENT" | grep -qE 'AKIA[0-9A-Z]{16}'; then
    VIOLATIONS="${VIOLATIONS}\n  - ${file} (AWS Access Key ID)"
  fi

  # AWS Secret Keys (40 char base64)
  if echo "$CONTENT" | grep -qE '['\''"][A-Za-z0-9/+=]{40}['\''"]'; then
    # Only flag if near AWS context
    if echo "$CONTENT" | grep -qiE 'aws|secret|key'; then
      VIOLATIONS="${VIOLATIONS}\n  - ${file} (possible AWS Secret Key)"
    fi
  fi

  # Generic API keys and tokens (assigned values)
  if echo "$CONTENT" | grep -qE '(api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token|secret[_-]?key)\s*[=:]\s*['\''"][A-Za-z0-9_.\/+=-]{20,}['\''"]' ; then
    VIOLATIONS="${VIOLATIONS}\n  - ${file} (hardcoded API key/token)"
  fi

  # Stripe live keys
  if echo "$CONTENT" | grep -qE 'sk_live_[A-Za-z0-9]{20,}'; then
    VIOLATIONS="${VIOLATIONS}\n  - ${file} (Stripe live secret key)"
  fi

  # Private keys
  if echo "$CONTENT" | grep -q -e 'BEGIN.*PRIVATE KEY'; then
    VIOLATIONS="${VIOLATIONS}\n  - ${file} (private key)"
  fi

  # Database connection strings with passwords
  if echo "$CONTENT" | grep -qE '(mysql|postgres|mongodb|redis)://[^:]+:[^@]+@'; then
    VIOLATIONS="${VIOLATIONS}\n  - ${file} (database connection string with password)"
  fi

  # JWT tokens
  if echo "$CONTENT" | grep -qE 'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'; then
    VIOLATIONS="${VIOLATIONS}\n  - ${file} (JWT token)"
  fi

  # FLK API credentials
  if echo "$CONTENT" | grep -qiE '(flk[_-]?(api[_-]?key|secret|token))\s*[=:]\s*['\''"][^\s'\''\"]{10,}['\''"]'; then
    VIOLATIONS="${VIOLATIONS}\n  - ${file} (FLK API credential)"
  fi

  # Password assignments
  if echo "$CONTENT" | grep -qiE '(password|passwd|pwd)\s*[=:]\s*['\''"][^\s'\''\"]{8,}['\''"]'; then
    # Skip common false positives
    if ! echo "$CONTENT" | grep -qiE '(password|passwd|pwd)\s*[=:]\s*['\''\"]*(env\(|process\.env|config\(|getenv|null|empty|placeholder|example|changeme|your_)'; then
      VIOLATIONS="${VIOLATIONS}\n  - ${file} (hardcoded password)"
    fi
  fi

done <<< "$STAGED_FILES"

if [ -n "$VIOLATIONS" ]; then
  echo "BLOCKED: Potential secrets detected in staged files:" >&2
  echo -e "$VIOLATIONS" >&2
  echo "" >&2
  echo "Remove the secrets and try again. Use .env files or AWS Parameter Store for sensitive values." >&2
  exit 2
fi

exit 0
