# Setup & Installation

Before writing a single line of Go, you need a properly configured development environment. This chapter walks you through installing Go 1.22+, understanding the toolchain, verifying your setup, and configuring your IDE for productive development.

## What You Will Learn

- Install Go 1.22+ on macOS, Linux, and Windows
- Understand GOPATH, GOROOT, and how Go organizes code
- Verify your installation with diagnostic commands
- Set up your IDE for Go development
- Troubleshoot common installation issues

## Prerequisites

- A computer running macOS, Linux, or Windows
- Command-line access (Terminal on macOS/Linux, PowerShell on Windows)
- Administrative privileges for system-wide installation

---

## Installing Go

### Download Go

Visit [go.dev/dl](https://go.dev/dl/) and download the latest Go 1.22+ installer for your operating system.

=== "macOS"

    ```bash
    # Option 1: Download the .pkg installer from go.dev/dl
    # Double-click the installer and follow the prompts

    # Option 2: Using Homebrew (recommended)
    $ brew install go

    # Verify installation
    $ go version
    go version go1.22.0 darwin/arm64
    ```

=== "Linux"

    ```bash
    # Download the tarball
    $ wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz

    # Remove any previous Go installation and extract
    $ sudo rm -rf /usr/local/go
    $ sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz

    # Add Go to your PATH (add to ~/.bashrc or ~/.zshrc)
    $ export PATH=$PATH:/usr/local/go/bin

    # Verify installation
    $ go version
    go version go1.22.0 linux/amd64
    ```

=== "Windows"

    ```powershell
    # Option 1: Download the .msi installer from go.dev/dl
    # Double-click the installer and follow the prompts

    # Option 2: Using Chocolatey
    > choco install golang

    # Option 3: Using winget
    > winget install GoLang.Go

    # Verify installation (open a new terminal)
    > go version
    go version go1.22.0 windows/amd64
    ```

=== "From Source"

    ```bash
    # Clone the Go repository
    $ git clone https://go.googlesource.com/go
    $ cd go/src

    # Build Go (requires a working Go installation)
    $ ./make.bash

    # The built Go binary will be in ../bin/go
    $ ../bin/go version
    ```

---

## Understanding Go's Environment

Go uses several environment variables to organize code and dependencies. Understanding these is essential for troubleshooting.

### GOPATH

The `GOPATH` is the workspace root where Go stores downloaded modules, compiled packages, and binaries.

```bash
# Check your GOPATH
$ go env GOPATH
/Users/yourname/go

# The default is $HOME/go on all platforms
```

!!! go "Go 1.22+ Feature"

    Since Go 1.16, module-aware mode is the default. You no longer need to set `GOPATH` manually for most projects. The `GOPATH` still exists but primarily stores the module cache (`$GOPATH/pkg/mod`) and installed binaries (`$GOPATH/bin`).

### GOROOT

The `GOROOT` is where the Go toolchain is installed. This is set automatically and rarely needs manual configuration.

```bash
# Check your GOROOT
$ go env GOROOT
/usr/local/go

# This directory contains the standard library, compiler, and tools
```

### Key Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `GOPATH` | Module cache and installed binaries | `$HOME/go` |
| `GOROOT` | Go toolchain installation | Auto-detected |
| `GOBIN` | Directory for `go install` binaries | `$GOPATH/bin` |
| `GO111MODULE` | Module mode (`on`, `off`, `auto`) | `on` |
| `GONOSUMCHECK` | Modules to skip checksum verification | Empty |
| `GONOPROXY` | Modules to fetch directly (no proxy) | Empty |
| `GOPRIVATE` | Shortcut for `GONOSUMCHECK` + `GONOPROXY` | Empty |
| `GOPROXY` | Module proxy URL | `https://proxy.golang.org,direct` |

---

## The go Command

The `go` command is your primary interface to the Go toolchain. Here are the essential subcommands:

### Building and Running

```bash
# Compile and run a Go file
$ go run main.go

# Compile and run all .go files in current directory
$ go run .

# Build a binary without running it
$ go build -o myapp

# Build with version information embedded
$ go build -ldflags "-X main.version=1.0.0" -o myapp

# Install a binary to $GOBIN
$ go install github.com/user/cmd/myapp@latest
```

### Module Management

```bash
# Initialize a new module
$ go mod init github.com/user/myproject

# Add a dependency
$ go get github.com/gin-gonic/gin@latest

# Remove unused dependencies
$ go mod tidy

# Download all dependencies
$ go mod download

# View dependency graph
$ go mod graph

# Verify dependencies have expected content
$ go mod verify
```

### Testing and Quality

```bash
# Run all tests
$ go test ./...

# Run tests with verbose output
$ go test -v ./...

# Run tests with race detector
$ go test -race ./...

# Run benchmarks
$ go test -bench=. ./...

# Format all Go files
$ gofmt -w .

# Vet code for suspicious constructs
$ go vet ./...
```

---

## Verifying Your Installation

Run these commands to confirm everything is working:

=== "Basic Verification"

    ```bash
    # Check Go version
    $ go version
    go version go1.22.0 darwin/arm64

    # Check environment
    $ go env
    GO111MODULE="on"
    GOARCH="arm64"
    GOBIN=""
    GOCACHE="/Users/yourname/Library/Caches/go-build"
    GOENV="/Users/yourname/.config/go/env"
    GOEXE=""
    GOFLAGS=""
    GOHOSTARCH="arm64"
    GOHOSTOS="darwin"
    GONOSUMCHECK=""
    GONOPROXY=""
    GONOSUMDB=""
    GOOS="darwin"
    GOPATH="/Users/yourname/go"
    GOPROXY="https://proxy.golang.org,direct"
    GOROOT="/usr/local/go"
    GOSUMDB="sum.golang.org"
    GOTMPDIR=""
    GOTOOLDIR="/usr/local/go/pkg/tool/darwin_arm64"
    GCCGO="gccgo"
    AR="ar"
    CC="clang"
    CXX="clang++"
    CGO_ENABLED="1"
    GOMOD="/dev/null"
    GOWORK=""
    CGO_CFLAGS="-O2 -g"
    CGO_CPPFLAGS=""
    CGO_CXXFLAGS="-O2 -g"
    CGO_FFLAGS="-O2 -g"
    CGO_LDFLAGS="-O2 -g"
    PKG_CONFIG="pkg-config"
    ```

=== "Test Program"

    ```go
    // save as hello_test.go
    package main

    import "testing"

    func TestHello(t *testing.T) {
        got := "Go"
        want := "Go"
        if got != want {
            t.Errorf("got %q, want %q", got, want)
        }
    }
    ```

    ```bash
    # Run the test
    $ go test -v .
    === RUN   TestHello
    --- PASS: TestHello (0.00s)
    PASS
    ok      github.com/user/hello    0.001s
    ```

---

## IDE Setup

### VS Code + Go Extension

VS Code is the most popular free editor for Go development.

=== "Installation"

    ```bash
    # Install VS Code from https://code.visualstudio.com

    # Open VS Code and install the Go extension
    # Command Palette (Cmd+Shift+P / Ctrl+Shift+P) → "Extensions: Install Extensions"
    # Search for "Go" and install the official Go extension

    # The extension will prompt you to install tools:
    # gopls, go-delve, go-staticcheck, golangci-lint, etc.
    # Click "Install" to install all recommended tools
    ```

=== "Settings"

    ```json
    // settings.json
    {
        "go.useLanguageServer": true,
        "go.lintTool": "staticcheck",
        "go.lintFlags": ["-checks=all", "-strict"],
        "go.formatTool": "goimports",
        "go.testFlags": ["-v", "-race"],
        "go.coverOnSave": true,
        "go.coverageDecorator": {
            "type": "highlight"
        },
        "[go]": {
            "editor.formatOnSave": true,
            "editor.codeActionsOnSave": {
                "source.organizeImports": true
            }
        }
    }
    ```

### GoLand

GoLand is JetBrains' commercial IDE for Go.

=== "Installation"

    ```bash
    # Download from https://www.jetbrains.com/go/
    # Or install via JetBrains Toolbox

    # macOS (Homebrew)
    $ brew install --cask goland

    # Verify installation
    $ open -a "GoLand"
    ```

=== "Configuration"

    GoLand includes everything out of the box:
    - Built-in debugger (Delve integration)
    - Code completion and refactoring
    - Test runner with coverage
    - Database tools
    - Version control integration

    No additional configuration is needed — GoLand auto-detects your Go installation.

---

## Common Issues

### Permission Denied

```bash
# If you see permission errors on Linux/macOS:
$ sudo chown -R $(whoami) /usr/local/go
$ sudo chown -R $(whoami) $HOME/go

# Or avoid sudo by using Homebrew on macOS:
$ brew install go
```

### Command Not Found

```bash
# Ensure Go is in your PATH
# Add to ~/.bashrc, ~/.zshrc, or ~/.profile:
export PATH=$PATH:/usr/local/go/bin
export PATH=$PATH:$HOME/go/bin

# Reload your shell
$ source ~/.zshrc  # or ~/.bashrc
```

### Module Proxy Issues

```bash
# If you cannot download modules (corporate firewall, China, etc.)
$ go env -w GOPROXY=https://goproxy.cn,direct

# Or bypass the proxy entirely for specific modules
$ go env -w GOPRIVATE=github.com/yourcompany/*
```

### Stale Cache

```bash
# Clean the build cache
$ go clean -cache

# Clean the module cache
$ go clean -modcache

# Clean everything
$ go clean -all
```

---

## Best Practices

| Practice | Recommendation |
|----------|---------------|
| **Go version** | Always use the latest stable Go release |
| **Module mode** | Keep `GO111MODULE=on` (default since Go 1.16) |
| **GOPATH** | Use the default `$HOME/go`; avoid custom paths |
| **GOPROXY** | Use `https://proxy.golang.org,direct` for public modules |
| **GOPRIVATE** | Set for internal/corporate modules |
| **IDE** | Choose one and configure linting and formatting on save |
| **Updates** | Run `go get -u ./...` periodically to update dependencies |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `go: command not found` | Add `/usr/local/go/bin` to your `PATH` |
| `permission denied` | Fix directory ownership with `chown` or use `brew install go` |
| `cannot find module` | Run `go mod tidy` and verify `GOPROXY` is set correctly |
| `go vet` errors | Fix the reported issues; they indicate real bugs |
| IDE not detecting packages | Restart the language server: `Cmd+Shift+P` → "Go: Restart Language Server" |
| Slow compilation | Run `go clean -cache` to clear stale build artifacts |
| Module download timeout | Check network, set `GOPROXY` to a closer mirror |
| `go.sum` mismatch | Delete `go.sum` and run `go mod tidy` to regenerate |

## Summary

- Go is installed from official binaries, package managers, or source
- `GOPATH` stores modules and binaries; `GOROOT` is the toolchain
- The `go` command handles building, testing, formatting, and module management
- VS Code with the Go extension or GoLand are the recommended IDEs
- Verify your installation with `go version` and `go env`
- Set `GOPRIVATE` for corporate modules to avoid proxy issues

## Next Steps

- [Your First Program](first-program.md) — Write and run your first Go program
- [Go Modules & Dependencies](go-modules.md) — Understand Go's dependency management
- [Project Structure](project-structure.md) — Organize your Go codebase
- [IDE Setup & Tooling](ide-setup.md) — Deep dive into editor configuration and linting
