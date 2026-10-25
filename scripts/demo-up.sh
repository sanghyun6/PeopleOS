#!/usr/bin/env bash
# Bring Moss search live before a demo: start scripts/moss-server.ts, open a public
# tunnel (localhost.run via ssh), point Convex MOSS_SEARCH_URL at it, and verify that
# venue_search is answered by Moss rather than the keyword fallback.
#   scripts/demo-up.sh          start everything and verify
#   scripts/demo-up.sh --check  report whether server, tunnel and Convex URL are alive
#   scripts/demo-up.sh --down   stop the server and the tunnel
# Never prints key values. State (pids, logs) lives in .demo-up/ (gitignored).
set -uo pipefail

cd "$(dirname "$0")/.."
STATE=.demo-up
PORT=8787
[ -f .env.local ] && PORT=$(grep -E '^MOSS_SERVER_PORT=' .env.local | tail -1 | cut -d= -f2 | tr -d '"' || true)
PORT=${PORT:-8787}
QUERY=${DEMO_QUERY:-"where do I sleep"}
mkdir -p "$STATE"

alive() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }
local_ok() { curl -fsS -m 3 "http://localhost:$PORT/health" >/dev/null 2>&1; }
# The relay answers 200 on /health only while the tunnel reaches our server.
tunnel_ok() { [ "$(curl -s -m 8 -o /dev/null -w '%{http_code}' "$1/health")" = "200" ]; }
say() { printf '%s\n' "$*"; }

stop_pid() {
  alive "$1" || { rm -f "$1"; return; }
  kill "$(cat "$1")" 2>/dev/null
  rm -f "$1"
}

down() {
  stop_pid "$STATE/tunnel.pid"
  stop_pid "$STATE/server.pid"
  # tsx spawns a child node process; clear anything still holding the port.
  local stray; stray=$(lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null || true)
  [ -n "$stray" ] && kill $stray 2>/dev/null
  rm -f "$STATE/url"
  say "down: moss server and tunnel stopped"
}

# Calls the Convex venue_search webhook and prints the outcome (never the secret).
verify() {
  # A fresh tunnel or a cold Convex action can fail once; retry before reporting.
  local rc=0 try
  for try in 1 2 3; do
    verify_once && return 0
    rc=$?
    sleep 2
  done
  return $rc
}

verify_once() {
  local site secret out outcome latency
  site=$(grep -E '^NEXT_PUBLIC_CONVEX_SITE_URL=' .env.local | cut -d= -f2- | tr -d '"')
  [ -n "$site" ] || { say "verify: NEXT_PUBLIC_CONVEX_SITE_URL missing in .env.local"; return 2; }
  secret=$(npx convex env get CARTESIA_TOOL_SECRET 2>/dev/null || true)
  local auth=(); [ -n "$secret" ] && auth=(-H "Authorization: Bearer $secret")
  out=$(curl -sS -m 15 -X POST "$site/cartesia/venue_search" -H 'Content-Type: application/json' "${auth[@]}" \
    -d "{\"query\":\"$QUERY\",\"call_id\":\"demo-up\"}" 2>&1)
  outcome=$(printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.outcome||"error:"+(j.message||"?"))}catch{console.log("error:bad response")}})')
  latency=$(printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).latencyMs??"?")}catch{console.log("?")}})')
  case "$outcome" in
    found|no_match) say "verify: MOSS OK (outcome=$outcome, ${latency}ms, query \"$QUERY\")"; return 0 ;;
    fallback) say "verify: FALLBACK (keyword search answered, Moss not reached; ${latency}ms)"; return 1 ;;
    *) say "verify: FAILED ($outcome)"; return 2 ;;
  esac
}

check() {
  local rc=0 url convex
  if local_ok; then say "server: up on :$PORT"; else say "server: DOWN"; rc=1; fi
  url=$(cat "$STATE/url" 2>/dev/null || true)
  if [ -z "$url" ]; then say "tunnel: none recorded"; rc=1
  elif alive "$STATE/tunnel.pid" && tunnel_ok "$url"; then say "tunnel: up ($url)"
  else say "tunnel: DEAD ($url)"; rc=1; fi
  convex=$(npx convex env get MOSS_SEARCH_URL 2>/dev/null || true)
  if [ -n "$url" ] && [ "$convex" = "$url" ]; then say "convex: MOSS_SEARCH_URL matches tunnel"
  else say "convex: MOSS_SEARCH_URL does not match tunnel"; rc=1; fi
  verify || rc=1
  [ $rc -eq 0 ] && say "all good" || say "not healthy: run scripts/demo-up.sh"
  return $rc
}

up() {
  down >/dev/null
  say "1/4 starting moss server on :$PORT"
  nohup npx tsx scripts/moss-server.ts >"$STATE/server.log" 2>&1 &
  echo $! >"$STATE/server.pid"
  for _ in $(seq 1 90); do local_ok && break; alive "$STATE/server.pid" || break; sleep 1; done
  local_ok || { say "server did not come up; see $STATE/server.log"; tail -5 "$STATE/server.log"; exit 1; }

  say "2/4 opening tunnel (localhost.run)"
  : >"$STATE/tunnel.log"
  nohup ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes \
    -R "80:localhost:$PORT" nokey@localhost.run >"$STATE/tunnel.log" 2>&1 &
  echo $! >"$STATE/tunnel.pid"
  local url=""
  for _ in $(seq 1 40); do
    url=$(grep -oE 'https://[a-zA-Z0-9.-]+\.(lhr\.life|localhost\.run)' "$STATE/tunnel.log" | grep -v '^https://admin\.' | tail -1)
    [ -n "$url" ] && break
    alive "$STATE/tunnel.pid" || break
    sleep 1
  done
  [ -n "$url" ] || { say "no tunnel URL found; see $STATE/tunnel.log"; exit 1; }
  echo "$url" >"$STATE/url"
  say "    tunnel: $url"

  say "3/4 setting convex MOSS_SEARCH_URL"
  npx convex env set MOSS_SEARCH_URL "$url" >/dev/null || { say "convex env set failed"; exit 1; }
  # Server auth must match: if a token exists locally, mirror it to Convex (value not printed).
  local tok; tok=$(grep -E '^MOSS_SEARCH_TOKEN=' .env.local | cut -d= -f2- | tr -d '"')
  [ -n "$tok" ] && npx convex env set MOSS_SEARCH_TOKEN "$tok" >/dev/null

  say "4/4 verifying venue_search"
  sleep 2
  verify
}

case "${1:-}" in
  --down) down ;;
  --check) check ;;
  "") up ;;
  *) say "usage: $0 [--check|--down]"; exit 64 ;;
esac
