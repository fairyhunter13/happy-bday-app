#!/bin/bash
#
# Database Backup Script
# Creates a PostgreSQL dump with timestamp
#
# Usage: ./scripts/backup-database.sh [backup_name]
#
set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-birthday-app-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-birthday_app}"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)

# Custom backup name or use timestamp
BACKUP_NAME="${1:-birthday_app_${TIMESTAMP}}"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.dump"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== PostgreSQL Backup Script ===${NC}"
echo "Timestamp: ${TIMESTAMP}"
echo "Database: ${POSTGRES_DB}"
echo "Backup file: ${BACKUP_FILE}"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Check if PostgreSQL container is running
if ! docker ps | grep -q "${POSTGRES_CONTAINER}"; then
  echo -e "${RED}ERROR: PostgreSQL container '${POSTGRES_CONTAINER}' is not running${NC}"
  exit 1
fi

# Perform backup
echo -e "${YELLOW}Creating backup...${NC}"
docker exec "${POSTGRES_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -F c -f "/tmp/${BACKUP_NAME}.dump"

# Copy backup from container to host
docker cp "${POSTGRES_CONTAINER}:/tmp/${BACKUP_NAME}.dump" "${BACKUP_FILE}"

# Remove temporary file from container
docker exec "${POSTGRES_CONTAINER}" rm "/tmp/${BACKUP_NAME}.dump"

# Verify backup file exists and has content
if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo -e "${RED}ERROR: Backup file was not created${NC}"
  exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)

echo -e "${GREEN}✓ Backup completed successfully${NC}"
echo "  File: ${BACKUP_FILE}"
echo "  Size: ${BACKUP_SIZE}"

# Calculate checksum for verification
CHECKSUM=$(sha256sum "${BACKUP_FILE}" | cut -d' ' -f1)
echo "  SHA256: ${CHECKSUM}"

# Save metadata
cat > "${BACKUP_FILE}.meta" <<EOF
{
  "backup_file": "${BACKUP_NAME}.dump",
  "database": "${POSTGRES_DB}",
  "timestamp": "${TIMESTAMP}",
  "size": "${BACKUP_SIZE}",
  "checksum": "${CHECKSUM}"
}
EOF

echo -e "${GREEN}✓ Metadata saved to ${BACKUP_FILE}.meta${NC}"

# Clean up old backups (keep last 30 days)
echo -e "${YELLOW}Cleaning up old backups (>30 days)...${NC}"
find "${BACKUP_DIR}" -name "*.dump" -mtime +30 -delete
find "${BACKUP_DIR}" -name "*.meta" -mtime +30 -delete

# List recent backups
echo ""
echo "Recent backups:"
ls -lh "${BACKUP_DIR}"/*.dump 2>/dev/null | tail -5 || echo "  No backups found"

echo ""
echo -e "${GREEN}=== Backup Complete ===${NC}"
