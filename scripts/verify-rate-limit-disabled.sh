#!/bin/bash
# Verification script to confirm rate limiting is disabled in performance environment
# This script checks container logs for the rate limiting status

set -e

echo "=========================================="
echo "Rate Limiting Verification Script"
echo "=========================================="
echo ""

# Check if containers are running
if ! docker ps --filter "name=perf-api" --format "{{.Names}}" | grep -q "perf-api"; then
    echo "ERROR: No perf-api containers are running"
    echo "Please start the performance environment first:"
    echo "  docker-compose -f docker-compose.perf.yml up -d"
    exit 1
fi

echo "Checking rate limiting status in API containers..."
echo ""

# Check each API container
for i in {1..5}; do
    container="perf-api-$i"
    echo "=== Checking $container ==="

    # Check if container exists
    if ! docker ps --format "{{.Names}}" | grep -q "^$container$"; then
        echo "  WARNING: Container $container is not running"
        continue
    fi

    # Check container logs for rate limiting status
    echo "  Looking for rate limiting configuration in logs..."

    # Look for the rate limiting configuration check log
    if docker logs "$container" 2>&1 | grep -q "Rate limiting configuration check"; then
        echo "  ✓ Found rate limiting configuration log"
        docker logs "$container" 2>&1 | grep "Rate limiting configuration check" | tail -1
    else
        echo "  ⚠ No rate limiting configuration log found yet (container may still be starting)"
    fi

    # Look for the disabled message
    if docker logs "$container" 2>&1 | grep -q "Rate limiting is DISABLED"; then
        echo "  ✓ CONFIRMED: Rate limiting is DISABLED"
    elif docker logs "$container" 2>&1 | grep -q "Rate limiting ENABLED"; then
        echo "  ✗ ERROR: Rate limiting is ENABLED (should be disabled!)"
        echo "  Full rate limiting logs:"
        docker logs "$container" 2>&1 | grep -i "rate limit" | tail -5
    else
        echo "  ⚠ Could not determine rate limiting status from logs"
    fi

    echo ""
done

echo "=========================================="
echo "Testing API endpoint for rate limit headers"
echo "=========================================="
echo ""

# Wait for nginx to be ready
echo "Waiting for nginx to be ready..."
sleep 2

# Make a test request and check for rate limit headers
echo "Making test request to API..."
response=$(curl -s -i http://localhost/health 2>&1 || echo "CURL_FAILED")

if echo "$response" | grep -q "CURL_FAILED"; then
    echo "ERROR: Could not connect to API (is nginx running?)"
    exit 1
fi

echo "Response headers:"
echo "$response" | grep -i "x-ratelimit" || echo "  ✓ No x-ratelimit headers found (GOOD - rate limiting is disabled)"

if echo "$response" | grep -qi "x-ratelimit-limit"; then
    echo ""
    echo "✗ ERROR: Rate limit headers detected!"
    echo "This means rate limiting is still active."
    echo ""
    echo "Full response headers:"
    echo "$response" | head -20
    exit 1
else
    echo ""
    echo "✓ SUCCESS: No rate limit headers in response"
    echo "Rate limiting is properly disabled for performance testing"
fi

echo ""
echo "=========================================="
echo "Verification Complete"
echo "=========================================="
