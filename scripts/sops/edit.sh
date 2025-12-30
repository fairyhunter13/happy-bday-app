#!/usr/bin/env bash

# ========================================
# SOPS Edit Script
# Birthday Message Scheduler
# ========================================
#
# Opens encrypted file in editor and re-encrypts on save
#
# Usage:
#   ./scripts/sops/edit.sh <environment>
#
# Arguments:
#   environment - development or test
#
# Examples:
#   ./scripts/sops/edit.sh development
#   ./scripts/sops/edit.sh test
# ========================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

cd "$PROJECT_ROOT"

# Function to print colored messages
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if SOPS is installed
if ! command -v sops &> /dev/null; then
    error "SOPS is not installed. Please install it first:"
    echo "  macOS:   brew install sops"
    echo "  Linux:   Download from https://github.com/getsops/sops/releases"
    exit 1
fi

# Check if age keys exist
if [ ! -f "$HOME/.config/sops/age/keys.txt" ]; then
    error "Age keys not found at $HOME/.config/sops/age/keys.txt"
    echo ""
    echo "Please see docs/DEVELOPER_SETUP.md for setup instructions"
    exit 1
fi

# Main logic
main() {
    local environment="${1:-}"

    if [ -z "$environment" ]; then
        error "Environment argument required"
        echo "Usage: $0 <environment>"
        echo "  environment: development or test"
        exit 1
    fi

    local env_name=""
    case "$environment" in
        development|dev)
            env_name="development"
            ;;
        test)
            env_name="test"
            ;;
        *)
            error "Invalid environment: $environment"
            echo "Valid options: development, test"
            exit 1
            ;;
    esac

    local encrypted_file=".env.${env_name}.enc"

    if [ ! -f "$encrypted_file" ]; then
        error "Encrypted file not found: $encrypted_file"
        exit 1
    fi

    info "Opening $encrypted_file in editor..."
    info "SOPS will decrypt, open in editor, and re-encrypt on save"
    echo ""

    # Use SOPS editor mode - it handles decryption, editing, and re-encryption
    if sops "$encrypted_file"; then
        info "✓ File saved and re-encrypted successfully"
        echo ""
        warn "Remember to commit the changes:"
        echo "  git add $encrypted_file"
        echo "  git commit -m 'Update $env_name environment secrets'"
    else
        error "✗ Failed to edit file"
        exit 1
    fi
}

main "$@"
