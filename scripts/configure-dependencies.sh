#!/usr/bin/env bash

# =============================================================================
# 🚀 Platform Engineering CLI - Cross-Platform Dependencies Configuration
# =============================================================================
# Universal script to configure dependencies for plat-cli across different OS
# 
# Supports: Ubuntu, Debian, macOS, Windows 11
# Usage: ./configure-dependencies.sh [install|uninstall|check] [--options]
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# Script metadata
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_NAME="plat-cli-deps"
readonly CLI_NAME="plat-cli"

# Minimum requirements
readonly MIN_DISK_SPACE_MB=1000
readonly MIN_MEMORY_MB=512
readonly NODE_MIN_VERSION=18

# Global variables for detected OS
DETECTED_OS=""
PACKAGE_MANAGER=""
OS_VERSION=""
ARCH=""

# Command line arguments
OPERATION="install"
SKIP_TESTS=false
NO_INTERACTIVE=false
MINIMAL_INSTALL=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging setup - Cross-platform
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    LOG_FILE="${TEMP:-/tmp}/${SCRIPT_NAME}-$(date +%Y%m%d-%H%M%S).log"
else
    LOG_FILE="/tmp/${SCRIPT_NAME}-$(date +%Y%m%d-%H%M%S).log"
fi
exec 19>"$LOG_FILE"

# =============================================================================
# Logging Functions
# =============================================================================
log_to_file() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&19
}

log_info() {
    local msg="$1"
    echo -e "${CYAN}ℹ️  $msg${NC}"
    log_to_file "INFO: $msg"
}

log_success() {
    local msg="$1"
    echo -e "${GREEN}✅ $msg${NC}"
    log_to_file "SUCCESS: $msg"
}

log_warning() {
    local msg="$1"
    echo -e "${YELLOW}⚠️  $msg${NC}"
    log_to_file "WARNING: $msg"
}

log_error() {
    local msg="$1"
    echo -e "${RED}❌ $msg${NC}" >&2
    log_to_file "ERROR: $msg"
}

log_header() {
    local msg="$1"
    echo -e "${PURPLE}🔧 $msg${NC}"
    echo "=================================================="
    log_to_file "HEADER: $msg"
}

log_debug() {
    local msg="$1"
    [[ "${VERBOSE}" == "true" ]] && echo -e "${BLUE}🐛 $msg${NC}"
    log_to_file "DEBUG: $msg"
}

# =============================================================================
# Argument Parsing
# =============================================================================
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            install|uninstall|check)
                OPERATION="$1"
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --no-interactive)
                NO_INTERACTIVE=true
                shift
                ;;
            --minimal)
                MINIMAL_INSTALL=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    log_debug "Operation: $OPERATION, Minimal: $MINIMAL_INSTALL, Interactive: $([ "$NO_INTERACTIVE" = "true" ] && echo "false" || echo "true")"
}

show_help() {
    cat << EOF
${CLI_NAME} Dependencies Configuration Script v${SCRIPT_VERSION}

USAGE:
    $0 [OPERATION] [OPTIONS]

OPERATIONS:
    install     Install all dependencies (default)
    uninstall   Remove dependencies
    check       Check system health and dependencies

OPTIONS:
    --skip-tests        Skip running tests after installation
    --no-interactive    Non-interactive mode (use defaults)
    --minimal          Minimal installation (exclude optional components)
    --verbose, -v      Verbose output for debugging
    --help, -h         Show this help message

EXAMPLES:
    $0 install                    # Full installation
    $0 install --minimal          # Minimal installation
    $0 uninstall                  # Remove dependencies
    $0 check                      # Health check only
    $0 install --no-interactive   # Automated installation

SUPPORTED PLATFORMS:
    • Ubuntu 18.04+ / Debian 10+
    • macOS 10.15+ (Catalina)
    • Windows 11 with WSL2 or Git Bash

DEPENDENCIES INSTALLED:
    • Node.js ${NODE_MIN_VERSION}+
    • npm/yarn package managers
    • PostgreSQL client tools
    • Google Cloud SDK (optional)
EOF
}

# =============================================================================
# OS Detection Functions
# =============================================================================
detect_os() {
    log_info "Detecting operating system..."
    
    # Detect Windows (including Git Bash, Cygwin, PowerShell)
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]] || command -v powershell.exe >/dev/null 2>&1; then
        DETECTED_OS="windows"
        ARCH=$(uname -m 2>/dev/null || echo "x86_64")
        if command -v cmd.exe >/dev/null 2>&1; then
            OS_VERSION=$(cmd.exe /c "ver" 2>/dev/null | grep -o "Version [0-9\.]*" | cut -d' ' -f2 || echo "unknown")
        else
            OS_VERSION="unknown"
        fi
        # Determine package manager for Windows
        if command -v winget >/dev/null 2>&1; then
            PACKAGE_MANAGER="winget"
        elif command -v choco >/dev/null 2>&1; then
            PACKAGE_MANAGER="chocolatey"
        elif command -v scoop >/dev/null 2>&1; then
            PACKAGE_MANAGER="scoop"
        else
            PACKAGE_MANAGER="manual"
        fi
    # Detect WSL
    elif [[ -n "${WSL_DISTRO_NAME:-}" ]] || grep -qsi 'microsoft\|wsl' /proc/version 2>/dev/null; then
        DETECTED_OS="wsl"
        PACKAGE_MANAGER="apt"
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS_VERSION="$VERSION_ID"
        fi
        ARCH=$(uname -m)
    # Detect macOS
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        DETECTED_OS="macos"
        PACKAGE_MANAGER="brew"
        OS_VERSION=$(sw_vers -productVersion)
        ARCH=$(uname -m)
        # Check for Apple Silicon
        if [[ "$ARCH" == "arm64" ]]; then
            log_debug "Apple Silicon (M1/M2) detected"
        fi
    # Detect Linux distributions
    elif [[ -f /etc/os-release ]]; then
        . /etc/os-release
        case "$ID" in
            ubuntu)
                DETECTED_OS="ubuntu"
                PACKAGE_MANAGER="apt"
                OS_VERSION="$VERSION_ID"
                ;;
            debian)
                DETECTED_OS="debian"
                PACKAGE_MANAGER="apt"
                OS_VERSION="$VERSION_ID"
                ;;
            centos|rhel|fedora)
                DETECTED_OS="$ID"
                PACKAGE_MANAGER="yum"
                OS_VERSION="$VERSION_ID"
                ;;
            *)
                DETECTED_OS="linux"
                PACKAGE_MANAGER="unknown"
                OS_VERSION="$VERSION_ID"
                ;;
        esac
        ARCH=$(uname -m)
    else
        log_error "Unable to detect operating system"
        exit 1
    fi
    
    log_success "Detected: $DETECTED_OS $OS_VERSION ($ARCH)"
    log_debug "Package manager: $PACKAGE_MANAGER"
}

# =============================================================================
# System Requirements Check
# =============================================================================
check_system_requirements() {
    log_header "Checking System Requirements"
    
    # Check if running as root (not recommended)
    if [[ $EUID -eq 0 ]] && [[ "$DETECTED_OS" != "windows" ]]; then
        log_warning "Running as root is not recommended!"
        if [[ "$NO_INTERACTIVE" == "false" ]]; then
            read -p "Continue anyway? [y/N]: " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi
    
    # Check available disk space
    if [[ "$DETECTED_OS" != "windows" ]]; then
        local available_mb
        available_mb=$(df -m . | awk 'NR==2 {print $4}')
        log_debug "Available space: ${available_mb}MB"
        
        if [[ $available_mb -lt $MIN_DISK_SPACE_MB ]]; then
            log_error "Insufficient disk space: ${available_mb}MB available, ${MIN_DISK_SPACE_MB}MB required"
            exit 1
        fi
        log_success "Disk space: ${available_mb}MB available"
    fi
    
    # Check available memory
    if command -v free >/dev/null 2>&1; then
        local available_mem_mb
        available_mem_mb=$(free -m | awk 'NR==2{print $7}')
        log_debug "Available memory: ${available_mem_mb}MB"
        
        if [[ $available_mem_mb -lt $MIN_MEMORY_MB ]]; then
            log_warning "Low memory: ${available_mem_mb}MB available (recommended: ${MIN_MEMORY_MB}MB)"
        else
            log_success "Memory: ${available_mem_mb}MB available"
        fi
    fi
    
    # Check network connectivity
    log_info "Checking network connectivity..."
    if [[ "$DETECTED_OS" == "windows" ]]; then
        # Windows ping syntax
        if ping -n 1 8.8.8.8 >nul 2>&1; then
            log_success "Network connectivity OK"
        else
            log_error "No internet connection"
            exit 1
        fi
    else
        # Unix ping syntax
        if ping -c 1 -W 5 8.8.8.8 >/dev/null 2>&1; then
            log_success "Network connectivity OK"
        else
            log_error "No internet connection"
            exit 1
        fi
    fi
}

# =============================================================================
# Utility Functions
# =============================================================================
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

confirm_action() {
    if [[ "$NO_INTERACTIVE" == "true" ]]; then
        return 0
    fi
    
    local message="$1"
    local default="${2:-n}"
    
    if [ "$default" = "y" ]; then
        local prompt="[Y/n]"
    else
        local prompt="[y/N]"
    fi
    
    echo
    read -p "$message $prompt: " -n 1 -r
    echo
    
    if [ "$default" = "y" ]; then
        [[ ! $REPLY =~ ^[Nn]$ ]]
    else
        [[ $REPLY =~ ^[Yy]$ ]]
    fi
}

# =============================================================================
# Package Installation Functions by OS
# =============================================================================

# Ubuntu/Debian installation
install_deps_ubuntu() {
    log_header "Installing Dependencies - Ubuntu/Debian"
    
    # Update package lists
    log_info "Updating package lists..."
    sudo apt-get update -qq
    
    # Install basic dependencies
    local packages=(
        "curl" "wget" "gnupg2" "software-properties-common"
        "apt-transport-https" "ca-certificates" "lsb-release"
        "build-essential" "git" "unzip" "jq"
    )
    
    for package in "${packages[@]}"; do
        if ! dpkg -l "$package" >/dev/null 2>&1; then
            log_info "Installing $package..."
            sudo apt-get install -y "$package" -qq
        fi
    done
    
    # Install Node.js
    install_nodejs_ubuntu
    
    # Install PostgreSQL client
    install_postgresql_client_ubuntu
    
    # Install Google Cloud SDK (if not minimal)
    if [[ "$MINIMAL_INSTALL" == "false" ]]; then
        install_gcloud_ubuntu
    fi
    
    # Install Yarn (if not minimal)
    if [[ "$MINIMAL_INSTALL" == "false" ]]; then
        install_yarn_ubuntu
    fi
}

install_nodejs_ubuntu() {
    if command_exists node; then
        local current_version=$(node --version | sed 's/v//')
        local major_version=$(echo "$current_version" | cut -d. -f1)
        if [[ $major_version -ge $NODE_MIN_VERSION ]]; then
            log_success "Node.js $current_version already installed"
            return 0
        fi
    fi
    
    log_info "Installing Node.js ${NODE_MIN_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_MIN_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
}

install_postgresql_client_ubuntu() {
    if command_exists pg_dump && command_exists pg_restore; then
        log_success "PostgreSQL client already installed"
        return 0
    fi
    
    log_info "Installing PostgreSQL client..."
    # Use more secure method with key verification
    local temp_key=$(mktemp)
    if curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o "$temp_key"; then
        # Verify key fingerprint for security
        local key_fingerprint=$(gpg --dry-run --quiet --import --import-options import-show "$temp_key" 2>/dev/null | grep -E "^ +Key fingerprint" | cut -d'=' -f2 | tr -d ' ')
        local expected_fingerprint="B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8"
        
        if [[ "$key_fingerprint" == "$expected_fingerprint" ]]; then
            sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg < "$temp_key"
            echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
            sudo apt-get update -qq
            sudo apt-get install -y postgresql-client-15
            log_success "PostgreSQL client installed securely"
        else
            log_error "PostgreSQL key verification failed - potential security issue"
            return 1
        fi
    else
        log_error "Failed to download PostgreSQL key"
        return 1
    fi
    rm -f "$temp_key"
}

install_gcloud_ubuntu() {
    if command_exists gcloud; then
        log_success "Google Cloud SDK already installed"
        return 0
    fi
    
    log_info "Installing Google Cloud SDK..."
    curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
    echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee /etc/apt/sources.list.d/google-cloud-sdk.list
    sudo apt-get update -qq
    sudo apt-get install -y google-cloud-cli
}

install_yarn_ubuntu() {
    if command_exists yarn; then
        log_success "Yarn already installed"
        return 0
    fi
    
    log_info "Installing Yarn..."
    sudo npm install -g yarn --silent
}

# macOS installation
install_deps_macos() {
    log_header "Installing Dependencies - macOS"
    
    # Check if Homebrew is installed
    if ! command_exists brew; then
        log_info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add to PATH for current session
        if [[ -x "/opt/homebrew/bin/brew" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [[ -x "/usr/local/bin/brew" ]]; then
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    fi
    
    # Update Homebrew
    log_info "Updating Homebrew..."
    brew update
    
    # Install Node.js
    install_nodejs_macos
    
    # Install PostgreSQL client
    install_postgresql_client_macos
    
    # Install Google Cloud SDK (if not minimal)
    if [[ "$MINIMAL_INSTALL" == "false" ]]; then
        install_gcloud_macos
    fi
    
    # Install Yarn (if not minimal)
    if [[ "$MINIMAL_INSTALL" == "false" ]]; then
        install_yarn_macos
    fi
}

install_nodejs_macos() {
    if command_exists node; then
        local current_version=$(node --version | sed 's/v//')
        local major_version=$(echo "$current_version" | cut -d. -f1)
        if [[ $major_version -ge $NODE_MIN_VERSION ]]; then
            log_success "Node.js $current_version already installed"
            return 0
        fi
    fi
    
    log_info "Installing Node.js..."
    
    # Optimize for Apple Silicon
    if [[ "$ARCH" == "arm64" ]]; then
        log_debug "Apple Silicon detected - using optimized installation"
        # Install latest LTS for better M1/M2 performance
        brew install node
    else
        # Intel Mac
        brew install node@${NODE_MIN_VERSION}
        brew link node@${NODE_MIN_VERSION} --force --overwrite
    fi
    
    # Verify installation
    if command_exists node && command_exists npm; then
        log_success "Node.js $(node --version) and npm $(npm --version) installed"
    else
        log_error "Node.js installation verification failed"
        return 1
    fi
}

install_postgresql_client_macos() {
    if command_exists pg_dump && command_exists pg_restore; then
        log_success "PostgreSQL client already installed"
        return 0
    fi
    
    log_info "Installing PostgreSQL client..."
    brew install postgresql@15
}

install_gcloud_macos() {
    if command_exists gcloud; then
        log_success "Google Cloud SDK already installed"
        return 0
    fi
    
    log_info "Installing Google Cloud SDK..."
    brew install --cask google-cloud-sdk
}

install_yarn_macos() {
    if command_exists yarn; then
        log_success "Yarn already installed"
        return 0
    fi
    
    log_info "Installing Yarn..."
    brew install yarn
}

# Windows installation
install_deps_windows() {
    log_header "Installing Dependencies - Windows"
    
    case "$PACKAGE_MANAGER" in
        "winget")
            install_with_winget
            ;;
        "chocolatey")
            install_with_chocolatey
            ;;
        "scoop")
            install_with_scoop
            ;;
        *)
            install_manual_windows
            ;;
    esac
}

install_with_winget() {
    log_info "Using winget package manager..."
    
    # Install Node.js with specific version for consistency
    if ! command_exists node; then
        log_info "Installing Node.js LTS..."
        if winget install OpenJS.NodeJS --silent --accept-source-agreements --accept-package-agreements; then
            log_success "Node.js installation initiated"
            # Add to PATH for current session
            export PATH="/c/Program Files/nodejs:$PATH"
        else
            log_error "Failed to install Node.js with winget"
            return 1
        fi
    fi
    
    # Install Git (if not present)
    if ! command_exists git; then
        log_info "Installing Git for Windows..."
        if winget install Git.Git --silent --accept-source-agreements --accept-package-agreements; then
            log_success "Git installation initiated"
        else
            log_warning "Git installation failed, continuing..."
        fi
    fi
    
    # Install PostgreSQL client tools
    if ! command_exists pg_dump || ! command_exists pg_restore; then
        log_info "Installing PostgreSQL client tools..."
        if winget install PostgreSQL.PostgreSQL --silent --accept-source-agreements --accept-package-agreements; then
            log_success "PostgreSQL installation initiated"
            # Add PostgreSQL bin to PATH
            export PATH="/c/Program Files/PostgreSQL/*/bin:$PATH"
        else
            log_warning "PostgreSQL installation failed - you may need to install manually"
        fi
    fi
    
    # Install Google Cloud SDK (if not minimal)
    if [[ "$MINIMAL_INSTALL" == "false" ]] && ! command_exists gcloud; then
        log_info "Installing Google Cloud SDK..."
        if winget install Google.CloudSDK --silent --accept-source-agreements --accept-package-agreements; then
            log_success "Google Cloud SDK installation initiated"
        else
            log_warning "Google Cloud SDK installation failed"
        fi
    fi
    
    # Refresh PATH and verify installations
    log_info "Refreshing environment variables..."
    if command -v refreshenv >/dev/null 2>&1; then
        refreshenv
    fi
}

install_with_chocolatey() {
    log_info "Using Chocolatey package manager..."
    
    # Install Node.js
    if ! command_exists node; then
        log_info "Installing Node.js..."
        choco install nodejs -y
    fi
    
    # Install Git (if not present)
    if ! command_exists git; then
        log_info "Installing Git..."
        choco install git -y
    fi
    
    # Install PostgreSQL client tools
    if ! command_exists pg_dump || ! command_exists pg_restore; then
        log_info "Installing PostgreSQL client tools..."
        choco install postgresql -y
    fi
    
    # Install Google Cloud SDK (if not minimal)
    if [[ "$MINIMAL_INSTALL" == "false" ]] && ! command_exists gcloud; then
        log_info "Installing Google Cloud SDK..."
        choco install gcloudsdk -y
    fi
}

install_with_scoop() {
    log_info "Using Scoop package manager..."
    
    # Install Node.js
    if ! command_exists node; then
        log_info "Installing Node.js..."
        scoop install nodejs
    fi
    
    # Install Git (if not present)
    if ! command_exists git; then
        log_info "Installing Git..."
        scoop install git
    fi
    
    # Install PostgreSQL client tools
    if ! command_exists pg_dump || ! command_exists pg_restore; then
        log_info "Installing PostgreSQL client tools..."
        scoop bucket add main
        scoop install postgresql
    fi
    
    # Install Google Cloud SDK (if not minimal)
    if [[ "$MINIMAL_INSTALL" == "false" ]] && ! command_exists gcloud; then
        log_info "Installing Google Cloud SDK..."
        scoop bucket add extras
        scoop install gcloud
    fi
}

install_manual_windows() {
    log_warning "No package manager detected. Manual installation required."
    echo
    echo "📋 Please install the following manually:"
    echo
    echo "1. 📦 Install a package manager first (recommended):"
    echo "   • winget: Comes with Windows 11"
    echo "   • Chocolatey: Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    echo "   • Scoop: Invoke-Expression (New-Object System.Net.WebClient).DownloadString('https://get.scoop.sh')"
    echo
    echo "2. 🟢 Node.js 18+: https://nodejs.org/en/download/"
    echo "3. 📁 Git: https://git-scm.com/download/win"
    echo "4. 🐘 PostgreSQL Client: https://www.postgresql.org/download/windows/"
    echo "5. ☁️ Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    echo
    echo "💡 After installation, restart your terminal and run:"
    echo "   ./scripts/configure-dependencies.sh check"
}

# =============================================================================
# CLI Project Setup
# =============================================================================
setup_cli_project() {
    log_header "Setting up ${CLI_NAME} project"
    
    local project_dir="$(dirname "$(dirname "$(realpath "$0")")")"
    log_debug "Project directory: $project_dir"
    
    cd "$project_dir"
    
    # Verify package.json exists
    if [[ ! -f "package.json" ]]; then
        log_error "package.json not found in project directory"
        exit 1
    fi
    
    # Install dependencies
    log_info "Installing project dependencies..."
    if command_exists yarn && [[ "$MINIMAL_INSTALL" == "false" ]]; then
        yarn install --silent
    else
        npm install --silent --no-audit --no-fund
    fi
    
    # Make CLI executable globally (Unix systems)
    if [[ "$DETECTED_OS" != "windows" ]]; then
        if [[ -f "bin/${CLI_NAME}" ]]; then
            log_info "Creating global symlink..."
            sudo ln -sf "$project_dir/bin/${CLI_NAME}" "/usr/local/bin/${CLI_NAME}"
            sudo chmod +x "$project_dir/bin/${CLI_NAME}"
        fi
    fi
    
    log_success "${CLI_NAME} project setup complete"
}

# =============================================================================
# Health Check Functions
# =============================================================================
run_health_check() {
    log_header "Running Health Check"
    
    local errors=0
    local warnings=0
    
    # Platform info
    log_info "Platform: $DETECTED_OS $OS_VERSION ($ARCH)"
    log_info "Package Manager: $PACKAGE_MANAGER"
    echo
    
    # Check Node.js
    if command_exists node; then
        local node_version=$(node --version | sed 's/v//')
        local major_version=$(echo "$node_version" | cut -d. -f1)
        if [[ $major_version -ge $NODE_MIN_VERSION ]]; then
            log_success "Node.js: v$node_version ✓"
        else
            log_warning "Node.js: v$node_version (requires v${NODE_MIN_VERSION}+)"
            ((warnings++))
        fi
    else
        log_error "Node.js: Not found"
        ((errors++))
    fi
    
    # Check npm
    if command_exists npm; then
        local npm_version=$(npm --version 2>/dev/null || echo "unknown")
        log_success "npm: $npm_version ✓"
        
        # Test npm functionality
        if npm --version >/dev/null 2>&1; then
            log_debug "npm functional test: ✓"
        else
            log_warning "npm may not be working correctly"
            ((warnings++))
        fi
    else
        log_error "npm: Not found"
        ((errors++))
    fi
    
    # Check yarn (optional)
    if command_exists yarn; then
        local yarn_version=$(yarn --version 2>/dev/null || echo "unknown")
        log_success "yarn: $yarn_version ✓"
    else
        log_info "yarn: Not installed (optional)"
    fi
    
    # Check PostgreSQL client with detailed testing
    if command_exists pg_dump && command_exists pg_restore; then
        local pg_version=$(pg_dump --version 2>/dev/null | head -1 | awk '{print $3}' || echo "unknown")
        log_success "PostgreSQL client: $pg_version ✓"
        
        # Test PostgreSQL client functionality
        if pg_dump --help >/dev/null 2>&1 && pg_restore --help >/dev/null 2>&1; then
            log_debug "PostgreSQL client functional test: ✓"
        else
            log_warning "PostgreSQL client may not be working correctly"
            ((warnings++))
        fi
    else
        log_error "PostgreSQL client: Not found (pg_dump/pg_restore required)"
        ((errors++))
        log_info "  Install with: PostgreSQL client tools"
    fi
    
    # Check Google Cloud SDK (optional)
    if command_exists gcloud; then
        local gcloud_version=$(gcloud --version 2>/dev/null | head -1 | awk '{print $4}' || echo "unknown")
        log_success "Google Cloud SDK: $gcloud_version ✓"
        
        # Test gcloud functionality
        if gcloud version >/dev/null 2>&1; then
            log_debug "Google Cloud SDK functional test: ✓"
        else
            log_warning "Google Cloud SDK may not be working correctly"
            ((warnings++))
        fi
    else
        log_info "Google Cloud SDK: Not installed (optional)"
    fi
    
    # Check Git (should be available)
    if command_exists git; then
        local git_version=$(git --version 2>/dev/null | awk '{print $3}' || echo "unknown")
        log_success "Git: $git_version ✓"
    else
        log_warning "Git: Not found (recommended for development)"
        ((warnings++))
    fi
    
    # Check CLI availability
    if command_exists "${CLI_NAME}"; then
        log_success "${CLI_NAME}: Available globally ✓"
        
        # Test CLI functionality
        if "${CLI_NAME}" --version >/dev/null 2>&1; then
            log_debug "${CLI_NAME} functional test: ✓"
        else
            log_warning "${CLI_NAME} may not be working correctly"
            ((warnings++))
        fi
    else
        log_warning "${CLI_NAME}: Not available globally"
        ((warnings++))
        
        # Check if it exists locally
        local project_dir="$(dirname "$(dirname "$(realpath "$0")" 2>/dev/null || echo ".")" 2>/dev/null || echo ".")"
        if [[ -f "$project_dir/bin/${CLI_NAME}" ]]; then
            log_info "  Found locally at: $project_dir/bin/${CLI_NAME}"
            log_info "  Run: sudo ln -sf \"$project_dir/bin/${CLI_NAME}\" \"/usr/local/bin/${CLI_NAME}\""
        fi
    fi
    
    # System resource checks
    echo
    log_info "System Resources:"
    
    # Memory check (if available)
    if command -v free >/dev/null 2>&1; then
        local available_mem=$(free -m 2>/dev/null | awk 'NR==2{print $7}' || echo "0")
        if [[ $available_mem -gt $MIN_MEMORY_MB ]]; then
            log_success "Memory: ${available_mem}MB available ✓"
        else
            log_warning "Memory: ${available_mem}MB available (low)"
            ((warnings++))
        fi
    fi
    
    # Disk space check
    if command -v df >/dev/null 2>&1; then
        local available_disk
        if [[ "$DETECTED_OS" == "windows" ]]; then
            # Windows doesn't have df, skip disk check
            log_debug "Disk space check skipped on Windows"
        else
            available_disk=$(df -m . 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
            if [[ $available_disk -gt $MIN_DISK_SPACE_MB ]]; then
                log_success "Disk space: ${available_disk}MB available ✓"
            else
                log_warning "Disk space: ${available_disk}MB available (low)"
                ((warnings++))
            fi
        fi
    fi
    
    # Summary
    echo
    log_header "Health Check Summary"
    
    local total_checks=$((errors + warnings + $(( [[ $errors -eq 0 && $warnings -eq 0 ]] && echo 10 || echo 0 )) ))
    local success_rate=$(( (total_checks - errors - warnings) * 100 / total_checks ))
    
    echo "📊 Results:"
    echo "  • Total components checked: $total_checks"
    echo "  • Errors (critical): $errors"
    echo "  • Warnings (minor): $warnings" 
    echo "  • Success rate: $success_rate%"
    echo
    
    if [[ $errors -eq 0 ]]; then
        if [[ $warnings -eq 0 ]]; then
            log_success "🎉 Perfect! All checks passed. System is ready."
            return 0
        elif [[ $warnings -le 2 ]]; then
            log_success "✅ System is functional with minor warnings."
            return 0
        else
            log_warning "⚠️ System functional but has several warnings ($warnings)"
            return 1
        fi
    else
        log_error "❌ System has $errors critical error(s). Needs attention."
        log_info "💡 Run: ./scripts/configure-dependencies.sh install"
        return 1
    fi
}

# =============================================================================
# Uninstallation Functions
# =============================================================================
uninstall_dependencies() {
    log_header "Uninstalling Dependencies"
    
    if ! confirm_action "Are you sure you want to uninstall dependencies?"; then
        log_info "Uninstallation cancelled"
        return 0
    fi
    
    case "$DETECTED_OS" in
        "ubuntu"|"debian")
            uninstall_ubuntu
            ;;
        "macos")
            uninstall_macos
            ;;
        "windows")
            uninstall_windows
            ;;
        *)
            log_error "Uninstallation not supported for $DETECTED_OS"
            exit 1
            ;;
    esac
}

uninstall_ubuntu() {
    log_info "Uninstalling Ubuntu/Debian packages..."
    
    # Remove CLI global link
    sudo rm -f "/usr/local/bin/${CLI_NAME}"
    
    if confirm_action "Remove Node.js?"; then
        sudo apt-get remove --purge -y nodejs npm
    fi
    
    if confirm_action "Remove PostgreSQL client?"; then
        sudo apt-get remove --purge -y postgresql-client-*
    fi
    
    if confirm_action "Remove Google Cloud SDK?"; then
        sudo apt-get remove --purge -y google-cloud-cli
        sudo rm -f /etc/apt/sources.list.d/google-cloud-sdk.list
    fi
    
    if confirm_action "Remove added repositories?"; then
        sudo rm -f /etc/apt/sources.list.d/nodesource.list
        sudo rm -f /etc/apt/sources.list.d/pgdg.list
    fi
    
    sudo apt-get autoremove -y
}

uninstall_macos() {
    log_info "Uninstalling macOS packages..."
    
    if confirm_action "Remove Node.js?"; then
        brew uninstall node@${NODE_MIN_VERSION} || true
        brew uninstall node || true
    fi
    
    if confirm_action "Remove PostgreSQL client?"; then
        brew uninstall postgresql@15 || true
    fi
    
    if confirm_action "Remove Google Cloud SDK?"; then
        brew uninstall --cask google-cloud-sdk || true
    fi
    
    if confirm_action "Remove Yarn?"; then
        brew uninstall yarn || true
    fi
}

uninstall_windows() {
    log_info "Uninstalling Windows packages..."
    
    case "$PACKAGE_MANAGER" in
        "winget")
            if confirm_action "Remove Node.js?"; then
                winget uninstall OpenJS.NodeJS
            fi
            if confirm_action "Remove PostgreSQL?"; then
                winget uninstall PostgreSQL.PostgreSQL
            fi
            if confirm_action "Remove Google Cloud SDK?"; then
                winget uninstall Google.CloudSDK
            fi
            ;;
        "chocolatey")
            if confirm_action "Remove Node.js?"; then
                choco uninstall nodejs -y
            fi
            if confirm_action "Remove PostgreSQL?"; then
                choco uninstall postgresql -y
            fi
            if confirm_action "Remove Google Cloud SDK?"; then
                choco uninstall gcloudsdk -y
            fi
            ;;
        "scoop")
            if confirm_action "Remove Node.js?"; then
                scoop uninstall nodejs
            fi
            if confirm_action "Remove PostgreSQL?"; then
                scoop uninstall postgresql
            fi
            if confirm_action "Remove Google Cloud SDK?"; then
                scoop uninstall gcloud
            fi
            ;;
        *)
            log_info "Please manually uninstall packages through Windows Settings > Apps"
            echo "Packages to remove:"
            echo "• Node.js"
            echo "• PostgreSQL"
            echo "• Google Cloud SDK"
            ;;
    esac
}

# =============================================================================
# Main Execution Functions
# =============================================================================
main() {
    echo
    echo "🚀 ${CLI_NAME} Dependencies Configuration v${SCRIPT_VERSION}"
    echo "================================================================================="
    echo "Operation: $OPERATION"
    [[ "$MINIMAL_INSTALL" == "true" ]] && echo "Mode: Minimal Installation"
    [[ "$NO_INTERACTIVE" == "true" ]] && echo "Mode: Non-interactive"
    [[ "$SKIP_TESTS" == "true" ]] && echo "Mode: Skip tests"
    echo
    
    log_info "Log file: $LOG_FILE"
    echo
    
    # Detect OS and check requirements
    detect_os
    check_system_requirements
    
    # Execute requested operation
    case "$OPERATION" in
        "install")
            perform_installation
            ;;
        "uninstall")
            uninstall_dependencies
            ;;
        "check")
            run_health_check
            ;;
        *)
            log_error "Unknown operation: $OPERATION"
            show_help
            exit 1
            ;;
    esac
}

perform_installation() {
    log_header "Starting Installation Process"
    
    # Install OS-specific dependencies
    case "$DETECTED_OS" in
        "ubuntu"|"debian"|"wsl")
            install_deps_ubuntu
            ;;
        "macos")
            install_deps_macos
            ;;
        "windows")
            install_deps_windows
            ;;
        *)
            log_error "Unsupported operating system: $DETECTED_OS"
            exit 1
            ;;
    esac
    
    # Setup CLI project
    setup_cli_project
    
    # Run health check
    if run_health_check; then
        show_next_steps
    else
        log_error "Installation completed with errors. Check the log file: $LOG_FILE"
        exit 1
    fi
}

show_next_steps() {
    echo
    log_header "🎉 Installation Complete!"
    echo
    log_info "Next steps:"
    echo
    echo "1. 📋 Test the installation:"
    echo "   ${CLI_NAME} --help"
    echo
    echo "2. 🔧 Configure your environment:"
    echo "   ${CLI_NAME} config --setup"
    echo
    echo "3. 🧪 Run a health check:"
    echo "   ./scripts/configure-dependencies.sh check"
    echo
    echo "4. 🚀 Start using the CLI:"
    echo "   ${CLI_NAME} --help"
    echo
    log_success "Ready to go! 🎯"
}

# Cleanup function
cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        log_error "Script failed! Check log: $LOG_FILE"
        echo
        echo "For debugging, run with --verbose"
    fi
    return $exit_code
}

trap cleanup EXIT

# =============================================================================
# Script Entry Point
# =============================================================================
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    parse_arguments "$@"
    main
fi