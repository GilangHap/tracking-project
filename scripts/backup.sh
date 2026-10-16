#!/bin/sh
# Backup harian Postgres: pg_dump format custom + gzip, retensi 7 hari.
# Dijalankan oleh service `backup` di docker-compose (cron 02:00).
set -eu

STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="/backups/tracker-${STAMP}.dump.gz"

pg_dump -Fc | gzip > "${FILE}.tmp"
mv "${FILE}.tmp" "${FILE}"

# Retensi: hapus file lebih tua dari 7 hari
find /backups -maxdepth 1 -name 'tracker-*.dump.gz' -mtime +7 -delete

echo "backup ok: ${FILE} ($(du -h "${FILE}" | cut -f1))"
