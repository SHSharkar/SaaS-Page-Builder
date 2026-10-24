#!/bin/sh
set -eu

cmd="${1:-status}"

check_services() {
  pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1 || {
    printf '[FAILED] PostgreSQL 18 is not reachable on 127.0.0.1:5432\n' >&2
    exit 1
  }
  valkey-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1 || {
    printf '[FAILED] Valkey is not reachable on 127.0.0.1:6379\n' >&2
    exit 1
  }
}

case "$cmd" in
  status)
    check_services
    printf '[SUCCESS] PostgreSQL 18 and Valkey are healthy\n'
    ;;
  migrate)
    check_services
    bun run db:migrate
    ;;
  seed)
    check_services
    bun run db:migrate
    bun run db:seed:development
    ;;
  verify)
    check_services
    bun run verify
    ;;
  dev)
    check_services
    bun run db:migrate
    bun run db:seed:development
    exec bun run dev
    ;;
  *)
    printf 'Usage: %s {status|migrate|seed|verify|dev}\n' "$0" >&2
    exit 1
    ;;
esac
