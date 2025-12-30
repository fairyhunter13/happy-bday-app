#!/bin/bash
#
# Automatic Partition Creation Script
# Constitutional Requirement: Database partitioning automation
#
# Purpose: Automatically create next month's partition for message_logs table
# Schedule: Run monthly via cron (1st day of month at 00:00 UTC)
# Performance Impact: Prevents table scan failures when no partition exists
#
# Usage:
#   ./scripts/create-partitions.sh
#   or: bash scripts/create-partitions.sh
#
# Cron Entry (add to crontab):
#   0 0 1 * * /app/scripts/create-partitions.sh >> /var/log/partition-creation.log 2>&1

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database connection parameters (override with environment variables)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-birthday_app}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres_dev_password}"

# Export for psql
export PGPASSWORD="$DB_PASSWORD"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Partition Creation Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S UTC')"
echo "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo ""

# Function to create partition for a given month
create_partition() {
  local partition_date=$1
  local next_month=$2
  local partition_name="message_logs_${partition_date//-/_}"

  echo -e "${YELLOW}Creating partition: ${partition_name}${NC}"
  echo "  Date range: ${partition_date} to ${next_month}"

  # Check if partition already exists
  partition_exists=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = '${partition_name}'
    );" | tr -d ' ')

  if [ "$partition_exists" = "t" ]; then
    echo -e "${YELLOW}  ⚠️  Partition already exists, skipping${NC}"
    return 0
  fi

  # Create the partition
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
    CREATE TABLE IF NOT EXISTS ${partition_name} PARTITION OF message_logs
      FOR VALUES FROM ('${partition_date}') TO ('${next_month}');

    -- Analyze the new partition for query planner
    ANALYZE ${partition_name};
EOF

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✅ Partition created successfully${NC}"
  else
    echo -e "${RED}  ❌ Failed to create partition${NC}"
    return 1
  fi
}

# Calculate dates
current_month=$(date '+%Y-%m-01')
next_month=$(date -d "$current_month +1 month" '+%Y-%m-01')
next_next_month=$(date -d "$current_month +2 months" '+%Y-%m-01')

echo "Current month: $current_month"
echo "Creating partitions for:"
echo "  - Next month:      $next_month"
echo "  - Two months ahead: $next_next_month"
echo ""

# Create partitions
create_partition "$next_month" "$next_next_month"
next_next_next_month=$(date -d "$current_month +3 months" '+%Y-%m-01')
create_partition "$next_next_month" "$next_next_next_month"

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Partition Summary${NC}"
echo -e "${GREEN}========================================${NC}"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
  SELECT
    tablename AS partition_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    n_live_tup AS row_count
  FROM pg_stat_user_tables
  WHERE tablename LIKE 'message_logs_%'
  ORDER BY tablename DESC
  LIMIT 5;
EOF

echo ""
echo -e "${GREEN}✅ Partition creation completed${NC}"
echo "Next run: $(date -d 'next month' '+%Y-%m-01 00:00:00 UTC')"
echo ""

# Cleanup
unset PGPASSWORD
