#!/usr/bin/env bash

# ========================================
# SOPS Decrypt Script
# Birthday Message Scheduler
# ========================================
#
# Decrypts environment files using SOPS + age
#
# Usage:
#   ./scripts/sops/decrypt.sh [environment]
#
# Arguments:
#   environment - (optional) development, test, or production
#                 If not provided, decrypts all environments
#
# Examples:
#   ./scripts/sops/decrypt.sh              # Decrypt all
#   ./scripts/sops/decrypt.sh development  # Decrypt dev only
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
    echo "If you're a new developer:"
    echo "  1. Ask your team lead for the SOPS_AGE_KEY"
    echo "  2. Save it to ~/.config/sops/age/keys.txt"
    echo ""
    echo "Or see docs/DEVELOPER_SETUP.md for more information"
    exit 1
fi

# Function to decrypt a file
decrypt_file() {
    local env=$1
    local source_file=".env.${env}.enc"
    local target_file=".env.${env}"

    if [ ! -f "$source_file" ]; then
        warn "Encrypted file $source_file not found, skipping..."
        return 0
    fi

    info "Decrypting $source_file -> $target_file"

    if sops --decrypt "$source_file" > "$target_file"; then
        info "✓ Successfully decrypted $env environment"

        # Set proper permissions
        chmod 600 "$target_file"
        info "✓ Set permissions (600) for $target_file"
    else
        error "✗ Failed to decrypt $env environment"
        return 1
    fi
}

# Main logic
main() {
    local environment="${1:-}"

    info "Starting SOPS decryption..."
    echo ""

    if [ -n "$environment" ]; then
        # Decrypt specific environment
        case "$environment" in
            development|dev)
                decrypt_file "development"
                ;;
            test)
                decrypt_file "test"
                ;;
            production|prod)
                decrypt_file "production"
                ;;
            *)
                error "Invalid environment: $environment"
                echo "Valid options: development, test, production"
                exit 1
                ;;
        esac
    else
        # Decrypt all environments
        info "Decrypting all environments..."
        echo ""

        decrypt_file "development"
        decrypt_file "test"
        decrypt_file "production"
    fi

    echo ""
    info "Decryption complete!"
    echo ""
    info "Decrypted files:"
    ls -lh .env.development .env.test .env.production 2>/dev/null || true
    echo ""
    warn "Never commit the decrypted .env files to git!"
}

main "$@"
