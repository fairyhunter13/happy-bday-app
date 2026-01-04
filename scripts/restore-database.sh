#!/bin/bash
#
# Database Restore Script
# Restores PostgreSQL database from a dump file
#
# Usage: ./scripts/restore-database.sh <backup_file>
#
set -euo pipefail

# Configuration
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-birthday-app-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-birthday_app}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [[ $# -lt 1 ]]; then
  echo -e "${RED}ERROR: Missing backup file argument${NC}"
  echo "Usage: $0 <backup_file>"
  echo ""
  echo "Example:"
  echo "  $0 ./backups/postgres/birthday_app_2026-01-04_00-00-00.dump"
  exit 1
fi

BACKUP_FILE="$1"

echo -e "${GREEN}=== PostgreSQL Restore Script ===${NC}"
echo "Backup file: ${BACKUP_FILE}"
echo "Database: ${POSTGRES_DB}"
echo ""

# Verify backup file exists
if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo -e "${RED}ERROR: Backup file '${BACKUP_FILE}' not found${NC}"
  exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "Backup size: ${BACKUP_SIZE}"

# Verify checksum if metadata exists
META_FILE="${BACKUP_FILE}.meta"
if [[ -f "${META_FILE}" ]]; then
  echo -e "${YELLOW}Verifying backup checksum...${NC}"
  EXPECTED_CHECKSUM=$(jq -r '.checksum' "${META_FILE}")
  ACTUAL_CHECKSUM=$(sha256sum "${BACKUP_FILE}" | cut -d' ' -f1)

  if [[ "${EXPECTED_CHECKSUM}" != "${ACTUAL_CHECKSUM}" ]]; then
    echo -e "${RED}ERROR: Checksum mismatch!${NC}"
    echo "  Expected: ${EXPECTED_CHECKSUM}"
    echo "  Actual:   ${ACTUAL_CHECKSUM}"
    echo -e "${RED}Backup file may be corrupted. Aborting restore.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Checksum verified${NC}"
fi

# Check if PostgreSQL container is running
if ! docker ps | grep -q "${POSTGRES_CONTAINER}"; then
  echo -e "${RED}ERROR: PostgreSQL container '${POSTGRES_CONTAINER}' is not running${NC}"
  exit 1
fi

# Warning and confirmation
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will REPLACE the entire '${POSTGRES_DB}' database${NC}"
echo -e "${YELLOW}⚠️  All current data will be LOST${NC}"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " -r
echo

if [[ ! $REPLY =~ ^yes$ ]]; then
  echo -e "${YELLOW}Restore cancelled${NC}"
  exit 0
fi

# Create safety backup of current database before restore
echo -e "${YELLOW}Creating safety backup of current database...${NC}"
SAFETY_BACKUP="/tmp/pre-restore-safety-$(date +%Y%m%d-%H%M%S).dump"
docker exec "${POSTGRES_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -F c -f "${SAFETY_BACKUP}" || true
echo -e "${GREEN}✓ Safety backup created: ${SAFETY_BACKUP}${NC}"

# Copy backup file to container
BACKUP_FILENAME=$(basename "${BACKUP_FILE}")
TMP_BACKUP="/tmp/${BACKUP_FILENAME}"

echo -e "${YELLOW}Copying backup to container...${NC}"
docker cp "${BACKUP_FILE}" "${POSTGRES_CONTAINER}:${TMP_BACKUP}"
echo -e "${GREEN}✓ Backup copied${NC}"

# Drop existing connections
echo -e "${YELLOW}Terminating active connections...${NC}"
docker exec "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();
"

# Drop and recreate database
echo -e "${YELLOW}Dropping and recreating database...${NC}"
docker exec "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"
docker exec "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d postgres -c "CREATE DATABASE ${POSTGRES_DB};"
echo -e "${GREEN}✓ Database recreated${NC}"

# Restore from backup
echo -e "${YELLOW}Restoring database from backup...${NC}"
echo "This may take several minutes depending on backup size..."

if docker exec "${POSTGRES_CONTAINER}" pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v "${TMP_BACKUP}"; then
  echo -e "${GREEN}✓ Database restore completed successfully${NC}"
else
  echo -e "${RED}ERROR: Restore failed${NC}"
  echo -e "${YELLOW}Attempting to restore from safety backup...${NC}"
  docker exec "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"
  docker exec "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d postgres -c "CREATE DATABASE ${POSTGRES_DB};"
  docker exec "${POSTGRES_CONTAINER}" pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" "${SAFETY_BACKUP}"
  echo -e "${YELLOW}Safety backup restored. Please investigate restore failure.${NC}"
  exit 1
fi

# Clean up temporary files
docker exec "${POSTGRES_CONTAINER}" rm "${TMP_BACKUP}"

# Verify restoration
echo -e "${YELLOW}Verifying restoration...${NC}"
USER_COUNT=$(docker exec "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT COUNT(*) FROM users;")
LOG_COUNT=$(docker exec "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT COUNT(*) FROM message_logs;")

echo "  Users: ${USER_COUNT}"
echo "  Message logs: ${LOG_COUNT}"

# Run vacuum analyze
echo -e "${YELLOW}Running VACUUM ANALYZE...${NC}"
docker exec "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "VACUUM ANALYZE;"
echo -e "${GREEN}✓ Database optimized${NC}"

echo ""
echo -e "${GREEN}=== Restore Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Verify data integrity with application queries"
echo "2. Restart application services if needed:"
echo "   docker-compose restart api workers"
echo "3. Monitor application logs for any errors"
echo "4. Remove safety backup when confirmed working:"
echo "   docker exec ${POSTGRES_CONTAINER} rm ${SAFETY_BACKUP}"
