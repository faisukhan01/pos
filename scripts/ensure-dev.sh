#!/bin/bash
# Ensures the Nova POS dev server is responding on :3000.
# Usage: bash /home/z/my-project/scripts/ensure-dev.sh
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:3000 || true)
if [ "$code" != "200" ]; then
  cd /home/z/my-project
  setsid nohup bun run dev >> dev.log 2>&1 < /dev/null &
  for i in $(seq 1 40); do
    sleep 0.5
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:3000 || true)
    if [ "$code" = "200" ]; then break; fi
  done
fi
echo "dev-server: $code"
