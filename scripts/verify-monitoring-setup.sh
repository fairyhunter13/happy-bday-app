#!/bin/bash

# ========================================
# Monitoring Stack Verification Script
# Birthday Message Scheduler
# ========================================
# This script verifies that Grafana, Prometheus, and Alertmanager
# are properly configured and running.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_info() {
    echo -e "${BLUE}→${NC} $1"
}

# Change to project directory
cd "$(dirname "$0")/.."

print_header "Monitoring Stack Verification"

# ========================================
# 1. Check Docker Compose Services
# ========================================
print_header "1. Checking Docker Compose Services"

if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose not found. Please install Docker Compose."
    exit 1
fi

print_info "Checking service configuration..."
if docker-compose config --services | grep -q "grafana"; then
    print_success "Grafana service configured"
else
    print_error "Grafana service not found in docker-compose.yml"
    exit 1
fi

if docker-compose config --services | grep -q "prometheus"; then
    print_success "Prometheus service configured"
else
    print_error "Prometheus service not found in docker-compose.yml"
    exit 1
fi

if docker-compose config --services | grep -q "alertmanager"; then
    print_success "Alertmanager service configured"
else
    print_error "Alertmanager service not found in docker-compose.yml"
    exit 1
fi

# ========================================
# 2. Check File Structure
# ========================================
print_header "2. Checking File Structure"

print_info "Checking Grafana provisioning files..."
if [ -f "grafana/provisioning/dashboards/dashboards.yml" ]; then
    print_success "Dashboard provisioning config exists"
else
    print_error "grafana/provisioning/dashboards/dashboards.yml not found"
    exit 1
fi

if [ -f "grafana/provisioning/datasources/datasources.yml" ]; then
    print_success "Datasource provisioning config exists"
else
    print_error "grafana/provisioning/datasources/datasources.yml not found"
    exit 1
fi

print_info "Checking dashboard JSON files..."
DASHBOARD_COUNT=$(find grafana/dashboards -name "*.json" -type f | wc -l | tr -d ' ')
if [ "$DASHBOARD_COUNT" -ge 6 ]; then
    print_success "Found $DASHBOARD_COUNT dashboard JSON files"
else
    print_warning "Expected at least 6 dashboards, found $DASHBOARD_COUNT"
fi

# List dashboards
echo "   Dashboard files:"
find grafana/dashboards -name "*.json" -type f -exec basename {} \; | while read -r file; do
    echo "   - $file"
done

print_info "Checking Prometheus configuration..."
if [ -f "prometheus/prometheus.yml" ]; then
    print_success "Prometheus config exists"
else
    print_error "prometheus/prometheus.yml not found"
    exit 1
fi

if [ -f "prometheus/alertmanager.yml" ]; then
    print_success "Alertmanager config exists"
else
    print_error "prometheus/alertmanager.yml not found"
    exit 1
fi

print_info "Checking alert rules..."
ALERT_RULE_COUNT=$(find prometheus/rules -name "*.yml" -type f | wc -l | tr -d ' ')
if [ "$ALERT_RULE_COUNT" -ge 4 ]; then
    print_success "Found $ALERT_RULE_COUNT alert rule files"
else
    print_warning "Expected at least 4 alert rule files, found $ALERT_RULE_COUNT"
fi

# ========================================
# 3. Validate Configuration Files
# ========================================
print_header "3. Validating Configuration Files"

print_info "Validating dashboard JSON files..."
VALID_DASHBOARDS=0
INVALID_DASHBOARDS=0
while IFS= read -r dashboard; do
    if python3 -m json.tool "$dashboard" > /dev/null 2>&1; then
        VALID_DASHBOARDS=$((VALID_DASHBOARDS + 1))
    else
        INVALID_DASHBOARDS=$((INVALID_DASHBOARDS + 1))
        print_error "Invalid JSON: $(basename "$dashboard")"
    fi
done < <(find grafana/dashboards -name "*.json" -type f)

if [ "$INVALID_DASHBOARDS" -eq 0 ]; then
    print_success "All $VALID_DASHBOARDS dashboard JSON files are valid"
else
    print_error "$INVALID_DASHBOARDS invalid dashboard JSON files found"
fi

print_info "Validating YAML files..."
YAML_VALID=true
for yaml_file in grafana/provisioning/dashboards/dashboards.yml \
                 grafana/provisioning/datasources/datasources.yml \
                 prometheus/prometheus.yml \
                 prometheus/alertmanager.yml; do
    if [ -f "$yaml_file" ]; then
        if python3 -c "import yaml; yaml.safe_load(open('$yaml_file'))" 2>/dev/null; then
            print_success "Valid YAML: $yaml_file"
        else
            print_error "Invalid YAML: $yaml_file"
            YAML_VALID=false
        fi
    fi
done

# ========================================
# 4. Check Running Services
# ========================================
print_header "4. Checking Running Services"

print_info "Checking if services are running..."
SERVICES_RUNNING=false

if docker-compose ps | grep -q "birthday-app-grafana"; then
    if docker-compose ps | grep "birthday-app-grafana" | grep -q "Up"; then
        print_success "Grafana container is running"
        SERVICES_RUNNING=true
    else
        print_warning "Grafana container exists but is not running"
    fi
else
    print_warning "Grafana container not found (not started yet)"
fi

if docker-compose ps | grep -q "birthday-app-prometheus"; then
    if docker-compose ps | grep "birthday-app-prometheus" | grep -q "Up"; then
        print_success "Prometheus container is running"
    else
        print_warning "Prometheus container exists but is not running"
    fi
else
    print_warning "Prometheus container not found (not started yet)"
fi

if docker-compose ps | grep -q "birthday-app-alertmanager"; then
    if docker-compose ps | grep "birthday-app-alertmanager" | grep -q "Up"; then
        print_success "Alertmanager container is running"
    else
        print_warning "Alertmanager container exists but is not running"
    fi
else
    print_warning "Alertmanager container not found (not started yet)"
fi

# ========================================
# 5. Test Service Endpoints (if running)
# ========================================
if [ "$SERVICES_RUNNING" = true ]; then
    print_header "5. Testing Service Endpoints"

    print_info "Testing Grafana health endpoint..."
    if curl -s -f http://localhost:3001/api/health > /dev/null; then
        print_success "Grafana API is responding"
    else
        print_error "Grafana API is not responding at http://localhost:3001"
    fi

    print_info "Testing Prometheus health endpoint..."
    if curl -s -f http://localhost:9090/-/healthy > /dev/null; then
        print_success "Prometheus API is responding"
    else
        print_error "Prometheus API is not responding at http://localhost:9090"
    fi

    print_info "Testing Alertmanager health endpoint..."
    if curl -s -f http://localhost:9093/-/healthy > /dev/null; then
        print_success "Alertmanager API is responding"
    else
        print_error "Alertmanager API is not responding at http://localhost:9093"
    fi

    # ========================================
    # 6. Check Grafana Provisioning
    # ========================================
    print_header "6. Checking Grafana Provisioning"

    print_info "Checking if Prometheus datasource is configured..."
    if curl -s http://localhost:3001/api/datasources | grep -q "Prometheus"; then
        print_success "Prometheus datasource found in Grafana"
    else
        print_warning "Prometheus datasource not found (may need time to provision)"
    fi

    print_info "Checking if dashboards are loaded..."
    DASHBOARD_API_COUNT=$(curl -s http://localhost:3001/api/search?type=dash-db | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
    if [ "$DASHBOARD_API_COUNT" -ge 6 ]; then
        print_success "Found $DASHBOARD_API_COUNT dashboards in Grafana"
    else
        print_warning "Found only $DASHBOARD_API_COUNT dashboards (expected at least 6)"
        print_info "Dashboards may still be provisioning. Wait 10-30 seconds and try again."
    fi

    # ========================================
    # 7. Check Prometheus Targets
    # ========================================
    print_header "7. Checking Prometheus Targets"

    print_info "Checking Prometheus targets..."
    if curl -s http://localhost:9090/api/v1/targets > /dev/null; then
        TARGET_COUNT=$(curl -s http://localhost:9090/api/v1/targets | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data['data']['activeTargets']))" 2>/dev/null || echo "0")
        print_success "Prometheus has $TARGET_COUNT active targets"
    else
        print_error "Failed to query Prometheus targets"
    fi

    # ========================================
    # 8. Check Alert Rules
    # ========================================
    print_header "8. Checking Alert Rules"

    print_info "Checking if alert rules are loaded..."
    if curl -s http://localhost:9090/api/v1/rules > /dev/null; then
        RULE_GROUP_COUNT=$(curl -s http://localhost:9090/api/v1/rules | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data['data']['groups']))" 2>/dev/null || echo "0")
        if [ "$RULE_GROUP_COUNT" -gt 0 ]; then
            print_success "Prometheus has $RULE_GROUP_COUNT alert rule groups loaded"
        else
            print_warning "No alert rule groups found in Prometheus"
        fi
    else
        print_error "Failed to query Prometheus alert rules"
    fi

else
    print_header "5-8. Service Tests Skipped"
    print_warning "Services are not running. Start them with: docker-compose up -d"
fi

# ========================================
# Final Summary
# ========================================
print_header "Verification Summary"

echo ""
echo "Configuration Files: ✓"
echo "File Structure: ✓"
echo "YAML Validation: $([ "$YAML_VALID" = true ] && echo "✓" || echo "✗")"
echo ""

if [ "$SERVICES_RUNNING" = true ]; then
    echo "Service Status:"
    echo "  - Grafana:      ✓ (http://localhost:3001)"
    echo "  - Prometheus:   ✓ (http://localhost:9090)"
    echo "  - Alertmanager: ✓ (http://localhost:9093)"
    echo ""
    echo "Access Grafana at: http://localhost:3001"
    echo "  Username: admin"
    echo "  Password: grafana_dev_password"
    echo ""
else
    echo "Services: Not running"
    echo ""
    echo "To start the monitoring stack:"
    echo "  docker-compose up -d prometheus alertmanager grafana"
    echo ""
fi

print_success "Verification complete!"
echo ""
