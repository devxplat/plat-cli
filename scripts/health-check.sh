#!/bin/bash

# =============================================================================
# 🔍 CloudSQL PostgreSQL Migration Tool - Health Check
# =============================================================================
# Este script verifica se tudo está funcionando corretamente no sistema
#
# Uso: ./health-check.sh
# =============================================================================

set -e  # Exit on any error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Função para log colorido
log_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_header() {
    echo -e "${PURPLE}🔍 $1${NC}"
    echo "=================================================="
}

# Contadores
TOTAL_CHECKS=0
PASSED_CHECKS=0
WARNINGS=0
ERRORS=0

# Função para incrementar contadores
count_result() {
    ((TOTAL_CHECKS++))
    case "$1" in
        "pass") ((PASSED_CHECKS++)) ;;
        "warn") ((WARNINGS++)) ;;
        "error") ((ERRORS++)) ;;
    esac
}

# Função para verificar comando
check_command() {
    local cmd="$1"
    local name="$2"
    local version_cmd="$3"
    
    if command -v "$cmd" >/dev/null 2>&1; then
        if [ -n "$version_cmd" ]; then
            local version=$($version_cmd 2>/dev/null || echo "unknown")
            log_success "$name: $version"
        else
            log_success "$name: Instalado"
        fi
        count_result "pass"
        return 0
    else
        log_error "$name: Não encontrado"
        count_result "error"
        return 1
    fi
}

# Função para verificar arquivo
check_file() {
    local file="$1"
    local name="$2"
    local optional="${3:-false}"
    
    if [ -f "$file" ]; then
        log_success "$name: Encontrado ($file)"
        count_result "pass"
        return 0
    elif [ -d "$file" ]; then
        log_success "$name: Diretório encontrado ($file)"
        count_result "pass"
        return 0
    else
        if [ "$optional" = "true" ]; then
            log_warning "$name: Não encontrado ($file) - Opcional"
            count_result "warn"
        else
            log_error "$name: Não encontrado ($file)"
            count_result "error"
        fi
        return 1
    fi
}

# Função para verificar conectividade
check_connectivity() {
    local host="$1"
    local name="$2"
    
    if ping -c 1 -W 3 "$host" >/dev/null 2>&1; then
        log_success "$name: Conectividade OK"
        count_result "pass"
        return 0
    else
        log_warning "$name: Sem conectividade"
        count_result "warn"
        return 1
    fi
}

# Função para verificar portas
check_port() {
    local host="$1"
    local port="$2"
    local name="$3"
    
    if timeout 3 bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null; then
        log_success "$name: Porta $port acessível em $host"
        count_result "pass"
        return 0
    else
        log_warning "$name: Porta $port não acessível em $host"
        count_result "warn"
        return 1
    fi
}

# Verificação do sistema operacional
check_system() {
    log_header "Sistema Operacional"
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        log_success "OS: $PRETTY_NAME"
        count_result "pass"
        
        # Verificar se é Debian/Ubuntu
        case "$ID" in
            debian|ubuntu)
                log_success "Distribuição suportada: $ID"
                count_result "pass"
                ;;
            *)
                log_warning "Distribuição não testada: $ID"
                count_result "warn"
                ;;
        esac
    else
        log_error "Não foi possível detectar o sistema operacional"
        count_result "error"
    fi
    
    # Verificar arquitetura
    local arch=$(uname -m)
    case "$arch" in
        x86_64|amd64)
            log_success "Arquitetura: $arch (suportada)"
            count_result "pass"
            ;;
        *)
            log_warning "Arquitetura: $arch (não testada)"
            count_result "warn"
            ;;
    esac
    
    # Verificar espaço em disco
    local available=$(df -h . | awk 'NR==2 {print $4}' | sed 's/[^0-9]//g')
    if [ "$available" -gt 1000 ]; then  # > 1GB
        log_success "Espaço disponível: $(df -h . | awk 'NR==2 {print $4}')"
        count_result "pass"
    else
        log_warning "Pouco espaço disponível: $(df -h . | awk 'NR==2 {print $4}')"
        count_result "warn"
    fi
}

# Verificação de comandos essenciais
check_essential_commands() {
    log_header "Comandos Essenciais"
    
    check_command "node" "Node.js" "node --version"
    check_command "npm" "npm" "npm --version"
    check_command "pg_dump" "pg_dump" "pg_dump --version | head -1"
    check_command "pg_restore" "pg_restore" "pg_restore --version | head -1"
    
    # Comandos opcionais
    echo
    log_info "Comandos opcionais:"
    check_command "yarn" "Yarn" "yarn --version"
    check_command "gcloud" "Google Cloud SDK" "gcloud --version | head -1"
    check_command "git" "Git" "git --version"
}

# Verificação do plat-cli
check_rdpgmig() {
    log_header "plat-cli"
    
    check_command "plat-cli" "CLI Global" "plat-cli --version"
    check_file "$HOME/plat-cli" "Diretório do projeto"
    check_file "$HOME/plat-cli/bin/plat-cli" "Executável"
    check_file "$HOME/plat-cli/package.json" "package.json"
    check_file "/usr/local/bin/plat-cli" "Link simbólico global"
    
    # Verificar se o projeto está funcional
    if [ -d "$HOME/plat-cli" ]; then
        cd "$HOME/plat-cli"
        
        # Verificar dependências
        if [ -d "node_modules" ]; then
            log_success "Dependências Node.js: Instaladas"
            count_result "pass"
        else
            log_warning "Dependências Node.js: Não instaladas"
            count_result "warn"
        fi
        
        # Verificar testes (se possível)
        if command -v npx >/dev/null 2>&1; then
            log_info "Executando testes..."
            if npx ava >/dev/null 2>&1; then
                log_success "Testes: Passaram"
                count_result "pass"
            else
                log_warning "Testes: Falharam ou não encontrados"
                count_result "warn"
            fi
        fi
        
        cd - >/dev/null
    fi
}

# Verificação de configuração
check_configuration() {
    log_header "Configuração"
    
    check_file "$HOME/.config/plat-cli" "Diretório de configuração" "true"
    check_file "$HOME/.config/plat-cli/example.env" "Template de configuração" "true"
    check_file "$HOME/.config/plat-cli/.env" "Arquivo de configuração" "true"
    
    # Verificar variáveis de ambiente críticas
    echo
    log_info "Variáveis de ambiente:"
    
    if [ -n "$PGUSER" ]; then
        log_success "PGUSER: Definido ($PGUSER)"
        count_result "pass"
    else
        log_warning "PGUSER: Não definido"
        count_result "warn"
    fi
    
    if [ -n "$PGPASSWORD" ]; then
        log_success "PGPASSWORD: Definido (oculto por segurança)"
        count_result "pass"
    else
        log_warning "PGPASSWORD: Não definido"
        count_result "warn"
    fi
    
    if [ -n "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
        if [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
            log_success "GOOGLE_APPLICATION_CREDENTIALS: Arquivo encontrado"
            count_result "pass"
        else
            log_error "GOOGLE_APPLICATION_CREDENTIALS: Arquivo não encontrado ($GOOGLE_APPLICATION_CREDENTIALS)"
            count_result "error"
        fi
    else
        log_warning "GOOGLE_APPLICATION_CREDENTIALS: Não definido"
        count_result "warn"
    fi
    
    # Verificar configuração de conexão
    if [ "$USE_CLOUD_SQL_PROXY" = "true" ]; then
        log_info "Modo de conexão: Cloud SQL Proxy"
        count_result "pass"
    elif [ -n "$CLOUDSQL_SOURCE_IP" ] || [ -n "$CLOUDSQL_TARGET_IP" ]; then
        log_info "Modo de conexão: IP Público"
        count_result "pass"
    else
        log_info "Modo de conexão: IP Privado (padrão)"
        count_result "pass"
    fi
}

# Verificação de conectividade de rede
check_network() {
    log_header "Conectividade de Rede"
    
    check_connectivity "8.8.8.8" "Internet (Google DNS)"
    check_connectivity "packages.cloud.google.com" "Google Cloud APIs"
    check_connectivity "registry.npmjs.org" "npm Registry"
    
    # Verificar portas comuns
    echo
    log_info "Verificando portas:"
    check_port "google.com" "443" "HTTPS"
    
    # Se tiver IPs configurados, testar conectividade
    if [ -n "$CLOUDSQL_SOURCE_IP" ]; then
        check_port "$CLOUDSQL_SOURCE_IP" "5432" "CloudSQL Source"
    fi
    
    if [ -n "$CLOUDSQL_TARGET_IP" ]; then
        check_port "$CLOUDSQL_TARGET_IP" "5432" "CloudSQL Target"
    fi
}

# Verificação de autenticação GCP
check_gcp_auth() {
    log_header "Autenticação Google Cloud"
    
    if command -v gcloud >/dev/null 2>&1; then
        # Verificar se está autenticado
        if gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q "@"; then
            local account=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1)
            log_success "Conta ativa: $account"
            count_result "pass"
        else
            log_warning "Nenhuma conta GCP ativa"
            count_result "warn"
        fi
        
        # Verificar projeto padrão
        local project=$(gcloud config get-value project 2>/dev/null)
        if [ -n "$project" ]; then
            log_success "Projeto padrão: $project"
            count_result "pass"
        else
            log_warning "Nenhum projeto padrão definido"
            count_result "warn"
        fi
        
        # Verificar permissões (tentativa básica)
        if gcloud projects list --limit=1 >/dev/null 2>&1; then
            log_success "Permissões básicas: OK"
            count_result "pass"
        else
            log_warning "Possível problema com permissões GCP"
            count_result "warn"
        fi
    else
        log_warning "Google Cloud SDK não instalado"
        count_result "warn"
    fi
}

# Verificação de performance
check_performance() {
    log_header "Performance"
    
    # Verificar memória disponível
    local memory=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    if [ "$memory" -gt 500 ]; then
        log_success "Memória disponível: ${memory}MB"
        count_result "pass"
    else
        log_warning "Pouca memória disponível: ${memory}MB"
        count_result "warn"
    fi
    
    # Verificar load average
    local load=$(uptime | awk -F'load average:' '{ print $2 }' | cut -d, -f1 | xargs)
    local load_int=$(echo "$load" | cut -d. -f1)
    
    if [ "$load_int" -lt 2 ]; then
        log_success "Load average: $load"
        count_result "pass"
    else
        log_warning "Load average alto: $load"
        count_result "warn"
    fi
    
    # Teste de velocidade do Node.js
    local node_test_start=$(date +%s%N)
    node -e "console.log('test')" >/dev/null 2>&1
    local node_test_end=$(date +%s%N)
    local node_test_time=$(((node_test_end - node_test_start) / 1000000))
    
    if [ "$node_test_time" -lt 500 ]; then
        log_success "Node.js startup: ${node_test_time}ms"
        count_result "pass"
    else
        log_warning "Node.js startup lento: ${node_test_time}ms"
        count_result "warn"
    fi
}

# Relatório final
show_report() {
    echo
    log_header "📊 Relatório Final"
    echo
    
    local success_rate=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    
    echo "📈 Estatísticas:"
    echo "  • Total de verificações: $TOTAL_CHECKS"
    echo "  • Sucessos: $PASSED_CHECKS"
    echo "  • Avisos: $WARNINGS"
    echo "  • Erros: $ERRORS"
    echo "  • Taxa de sucesso: $success_rate%"
    echo
    
    # Classificação da saúde
    if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -le 2 ]; then
        log_success "🎉 Sistema SAUDÁVEL - Pronto para uso!"
        echo "  ✅ plat-cli está totalmente funcional"
    elif [ "$ERRORS" -le 2 ] && [ "$success_rate" -ge 70 ]; then
        log_warning "⚠️ Sistema PARCIALMENTE FUNCIONAL"
        echo "  🔧 Alguns ajustes podem ser necessários"
        echo "  💡 Verifique os erros/avisos acima"
    else
        log_error "❌ Sistema com PROBLEMAS"
        echo "  🛠️ Correções necessárias antes do uso"
        echo "  📞 Consulte a documentação ou execute ./setup-debian.sh"
    fi
    
    echo
    
    # Sugestões
    if [ "$ERRORS" -gt 0 ] || [ "$WARNINGS" -gt 3 ]; then
        log_info "🔧 Sugestões:"
        echo "  • Execute: ./setup-debian.sh (para reinstalação)"
        echo "  • Configure: source ~/.config/plat-cli/.env"
        echo "  • Autentique: gcloud auth login"
        echo "  • Teste: plat-cli test-connection --help"
    fi
    
    echo
    log_info "Para mais ajuda: cat INSTALL-DEBIAN.md"
}

# Função principal
main() {
    echo
    echo "🔍 CloudSQL PostgreSQL Migration Tool - Health Check"
    echo "===================================================="
    echo
    
    # Executar todas as verificações
    check_system
    echo
    check_essential_commands
    echo
    check_rdpgmig
    echo
    check_configuration
    echo
    check_network
    echo
    check_gcp_auth
    echo
    check_performance
    
    # Mostrar relatório final
    show_report
}

# Executar se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
