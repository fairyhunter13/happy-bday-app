#!/usr/bin/env bash

# ========================================
# SOPS Encrypt Script
# Birthday Message Scheduler
# ========================================
#
# Encrypts environment files using SOPS + age
#
# Usage:
#   ./scripts/sops/encrypt.sh [environment]
#
# Arguments:
#   environment - (optional) development or test
#                 If not provided, encrypts all environments
#
# Examples:
#   ./scripts/sops/encrypt.sh              # Encrypt all
#   ./scripts/sops/encrypt.sh development  # Encrypt dev only
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
    echo "Please generate age keys first:"
    echo "  mkdir -p ~/.config/sops/age"
    echo "  age-keygen -o ~/.config/sops/age/keys.txt"
    exit 1
fi

# Function to encrypt a file
encrypt_file() {
    local env=$1
    local source_file=".env.${env}"
    local target_file=".env.${env}.enc"

    if [ ! -f "$source_file" ]; then
        warn "Source file $source_file not found, skipping..."
        return 0
    fi

    info "Encrypting $source_file -> $target_file"

    if sops --encrypt "$source_file" > "$target_file"; then
        info "✓ Successfully encrypted $env environment"

        # Verify the encrypted file can be decrypted
        if sops --decrypt "$target_file" > /dev/null 2>&1; then
            info "✓ Verified encryption for $env environment"
        else
            error "✗ Encryption verification failed for $env"
            return 1
        fi
    else
        error "✗ Failed to encrypt $env environment"
        return 1
    fi
}

# Main logic
main() {
    local environment="${1:-}"

    info "Starting SOPS encryption..."
    echo ""

    if [ -n "$environment" ]; then
        # Encrypt specific environment
        case "$environment" in
            development|dev)
                encrypt_file "development"
                ;;
            test)
                encrypt_file "test"
                ;;
            *)
                error "Invalid environment: $environment"
                echo "Valid options: development, test"
                exit 1
                ;;
        esac
    else
        # Encrypt all environments
        info "Encrypting all environments..."
        echo ""

        encrypt_file "development"
        encrypt_file "test"
    fi

    echo ""
    info "Encryption complete!"
    echo ""
    info "Encrypted files:"
    ls -lh .env.*.enc 2>/dev/null || true
    echo ""
    warn "Remember to commit the encrypted files to git:"
    echo "  git add .env.*.enc .sops.yaml"
    echo "  git commit -m 'Add encrypted environment files'"
}

main "$@"
