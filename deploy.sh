#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

IMAGE="${IMAGE:-borrageiros/haxball-tikitaka}"
CONTAINER_NAME="${CONTAINER_NAME:-haxball-tikitaka}"
ENV_FILE="${ENV_FILE:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.example to .env and fill in values." >&2
  exit 1
fi

echo "Building image: $IMAGE"
docker build -t "$IMAGE" .

shell_escape() {
  local value=$1
  value=${value//\'/\'\\\'\'}
  printf "'%s'" "$value"
}

mapfile -t ENV_LINES < <(
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" || true
)

if [[ ${#ENV_LINES[@]} -eq 0 ]]; then
  echo "No environment variables found in $ENV_FILE." >&2
  exit 1
fi

HAS_TOKEN=0
for line in "${ENV_LINES[@]}"; do
  key=${line%%=*}
  value=${line#*=}
  if [[ "$key" == "TOKEN" || "$key" == "HAXBALL_TOKEN" ]] && [[ -n "${value// }" ]]; then
    HAS_TOKEN=1
    break
  fi
done

if [[ "$HAS_TOKEN" -eq 0 ]]; then
  echo "Warning: TOKEN / HAXBALL_TOKEN is empty in $ENV_FILE." >&2
  echo "Without a token the container cannot create a room in detached mode." >&2
fi

echo
echo "Copy and paste:"
echo
echo "Note: --network host is required so players can connect (WebRTC/UDP)."
echo "Stop any local yarn start first (same token cannot host two rooms)."
echo
printf 'docker run -d \\\n'
printf '  --name %s \\\n' "$CONTAINER_NAME"
printf '  --network host \\\n'
printf '  --restart unless-stopped \\\n'

for line in "${ENV_LINES[@]}"; do
  key=${line%%=*}
  value=${line#*=}
  if [[ -z "$value" ]]; then
    continue
  fi
  printf '  -e %s=%s \\\n' "$key" "$(shell_escape "$value")"
done

printf '  %s\n' "$IMAGE"
echo
echo "Then: docker logs -f $CONTAINER_NAME"
