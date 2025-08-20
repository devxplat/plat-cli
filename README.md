# plat-cli

[![build status](https://img.shields.io/travis/com/epicvinny/plat-cli.svg)](https://travis-ci.com/epicvinny/plat-cli)
[![code coverage](https://img.shields.io/codecov/c/github/epicvinny/plat-cli.svg)](https://codecov.io/gh/epicvinny/plat-cli)
[![code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![made with lass](https://img.shields.io/badge/made_with-lass-95CC28.svg)](https://lass.js.org)
[![license](https://img.shields.io/github/license/epicvinny/plat-cli.svg)](LICENSE)

> Platform Engineering DevEx CLI - Simplify complex cloud operations with modern TUI and classic CLI interfaces

## 🚀 Quick Start

```bash
# Install globally
yarn global add plat-cli

# Launch interactive TUI (recommended)
plat-cli

# Or use classic CLI for automation
plat-cli gcp cloudsql migrate --source-project prod --source-instance db1 --target-project prod --target-instance db2
```

## ✨ Features

- **🎯 CloudSQL PostgreSQL Migration** - Seamless database migrations between instances
- **🖥️ Dual Interface** - Interactive TUI with Ink or Classic CLI for scripts
- **📦 Batch Operations** - Migrate multiple databases in parallel (N:1, N:N)
- **🔄 Smart Strategies** - Auto-detect optimal migration patterns
- **📊 Real-time Progress** - Live progress tracking with ETA
- **💾 Local Cache** - SQLite-powered persistent cache for better performance of configurations and inputs
- **🔁 Auto Retry** - Intelligent retry with exponential backoff
- **🎨 Modern UX** - Beautiful TUI with React and @inkjs/ui components

## 📦 Installation

### Prerequisites

- Node.js >= 18
- PostgreSQL client tools (`pg_dump`, `pg_restore`)
- Google Cloud credentials (for CloudSQL operations)

### Install

```bash
# Global installation (recommended) inside the plat-cli folder
yarn global add .

# Or with npm inside the plat-cli folder
npm install -g .

# Local project installation inside the plat-cli folder
yarn add .
```

## 🎮 Usage Modes

### Interactive TUI Mode (Default)

Simply run `plat-cli` without arguments to launch the modern TUI:

```bash
plat-cli
```

Navigate with arrow keys, select options, and follow the guided workflow.

**Features:**

- Visual navigation menu
- Form-based configuration
- Real-time validation
- Progress visualization
- Batch migration support

### Classic CLI Mode

Perfect for automation, CI/CD, and scripts:

```bash
# Single database migration
plat-cli gcp cloudsql migrate \
  --source-project my-project \
  --source-instance source-db \
  --target-project my-project \
  --target-instance target-db \
  --databases app_db,analytics_db

# Batch migration from file
plat-cli gcp cloudsql migrate \
  --sources-file instances.txt \
  --target-project production \
  --target-instance consolidated-db \
  --strategy consolidate
```

## 📚 Core Commands

### CloudSQL Migration

```bash
# Test connection
plat-cli gcp cloudsql test-connection \
  --project my-project \
  --instance my-instance

# List databases
plat-cli gcp cloudsql list-databases \
  --project my-project \
  --instance my-instance

# Migrate with dry-run
plat-cli gcp cloudsql migrate \
  --source-project prod \
  --source-instance db-v1 \
  --target-project prod \
  --target-instance db-v2 \
  --include-all \
  --dry-run
```

### Migration Strategies

| Strategy        | Description                 | Use Case                    |
| --------------- | --------------------------- | --------------------------- |
| `simple`        | Direct 1:1 migration        | Single instance migrations  |
| `consolidate`   | N:1 consolidation           | Merge multiple DBs into one |
| `version-based` | Group by PostgreSQL version | Version-specific migrations |
| `custom`        | Custom mapping file         | Complex migration patterns  |

## ⚙️ Configuration

### Environment Variables

Create a `.env` file:

```bash
# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Connection method (choose one)
USE_CLOUD_SQL_PROXY=true
```

### Batch Migration Example

Create `instances.txt`:

```
instance-1
instance-2
project:instance-3
```

Run batch migration:

```bash
plat-cli gcp cloudsql migrate \
  --sources-file instances.txt \
  --target-project production \
  --target-instance main-db \
  --strategy consolidate \
  --conflict-resolution prefix
```

### Configuration File

Use JSON for complex configurations:

```json
{
  "source": {
    "project": "my-project",
    "instance": "source-db",
    "databases": ["app", "analytics"]
  },
  "target": {
    "project": "my-project",
    "instance": "target-db"
  },
  "options": {
    "strategy": "simple",
    "retryAttempts": 3,
    "jobs": 2
  }
}
```

```bash
plat-cli gcp cloudsql migrate --config migration.json
```

## 🛠️ Advanced Features

### Batch Migration Strategies

**N:1 Consolidation**

```bash
# Merge multiple instances into one
plat-cli gcp cloudsql migrate \
  --sources-file instances.txt \
  --target-instance consolidated-db \
  --strategy consolidate \
  --conflict-resolution prefix
```

**Version-based Migration**

```bash
# Group by PostgreSQL version
plat-cli gcp cloudsql migrate \
  --mapping-file version-mapping.json \
  --strategy version-based
```

### Progress Tracking

The CLI provides real-time progress with:

- Overall progress percentage
- Current operation status
- ETA calculation
- Transfer speed metrics
- Per-database progress

### Dry Run Mode

Test your configuration without making changes:

```bash
plat-cli gcp cloudsql migrate \
  --source-instance db1 \
  --target-instance db2 \
  --dry-run
```

## 🔧 Development

```bash
# Clone repository
git clone https://github.com/devxplat/plat-cli.git
cd plat-cli

# Install dependencies
yarn install

# Run in development
yarn dev

# Run tests
yarn test

# Lint code
yarn lint
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

AGPLv3 © [devxplat](https://github.com/devxplat)

## 🔗 Links

- [Documentation](https://github.com/devxplat/plat-cli/wiki)
- [Issues](https://github.com/devxplat/plat-cli/issues)
- [Changelog](https://github.com/devxplat/plat-cli/releases)

---

**Built with ❤️ for Platform Engineers and SREs by DevX Platform**
