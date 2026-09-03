# Go Modules & Dependencies

Go modules are Go's built-in dependency management system. They provide reproducible builds, version pinning, and a standard way to share code. This chapter covers everything from initializing a module to managing private dependencies and vendoring.

## What You Will Learn

- Initialize and manage Go modules with `go mod`
- Understand `go.mod` and `go.sum` files
- Add, update, and remove dependencies
- Use module proxies and handle private modules
- Vendor dependencies for offline builds

## Prerequisites

- [Setup & Installation](setup-installation.md) — Go 1.22+ installed
- [Your First Program](first-program.md) — Basic Go program structure

---

## What Is a Module?

A Go module is a collection of Go packages that are versioned together as a single unit. The module is defined by a `go.mod` file in the root directory, which specifies:

- The module path (how others import it)
- The Go version required
- All dependencies and their versions

=== "The Code"

    ```go
    // File: main.go
    package main

    import (
        "fmt"
        "github.com/google/uuid"
    )

    func main() {
        id := uuid.New()
        fmt.Printf("Generated UUID: %s\n", id.String())
    }
    ```

=== "The Explanation"

    - **Module path**: `github.com/user/myproject` — this is how your module is identified and imported by others
    - **External dependency**: `github.com/google/uuid` — Go will download this automatically when you run `go mod tidy`
    - **`go.mod`**: Created by `go mod init`, lists your module path and all required dependencies
    - **`go.sum`**: Auto-generated checksum file that ensures dependency integrity

=== "The Terminal Output"

    ```bash
    $ go mod init github.com/user/myproject
    go: creating new go.mod: module github.com/user/myproject

    $ go mod tidy
    go: finding github.com/google/uuid latest
    go: added github.com/google/uuid v1.6.0

    $ go run main.go
    Generated UUID: 550e8400-e29b-41d4-a716-446655440000
    ```

---

## Initializing a Module

The `go mod init` command creates a new module and its `go.mod` file.

```bash
# Initialize a new module
$ go mod init github.com/user/myproject

# This creates go.mod:
module github.com/user/myproject

go 1.22
```

!!! go "Module Path Naming"

    Your module path should match where the code will be hosted:
    - GitHub: `github.com/user/repo`
    - GitLab: `gitlab.com/user/repo`
    - Bitbucket: `bitbucket.org/user/repo`
    - Self-hosted: `go.example.com/user/repo`

    The module path is how other developers import your code.

---

## Understanding go.mod

The `go.mod` file is the heart of your module. Here is a real-world example:

```
module github.com/user/webapp

go 1.22

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/jackc/pgx/v5 v5.5.0
    github.com/redis/go-redis/v9 v9.3.0
    golang.org/x/crypto v0.17.0
)

require (
    github.com/bytedance/sonic v1.10.0 // indirect
    github.com/chenzhuoyu/base64x v0.0.0-20230717121745-296ad89f973d // indirect
    github.com/gabriel-vasile/mimetype v1.4.2 // indirect
    // ... more indirect dependencies
)

replace (
    github.com/old/module => github.com/new/module v1.0.0
)

exclude (
    github.com/broken/module v1.2.3
)
```

| Directive | Purpose |
|-----------|---------|
| `module` | Declares the module path |
| `go` | Minimum Go version required |
| `require` | Direct dependencies and their versions |
| `// indirect` | Dependencies pulled in by your direct dependencies |
| `replace` | Redirect a module to a different location |
| `exclude` | Prevent a specific module version from being used |

---

## Understanding go.sum

The `go.sum` file contains cryptographic hashes of every dependency. It ensures that downloads are not tampered with.

```
github.com/google/uuid v1.6.0 h1:NIvaJronO95cG5UuLlNnWMcgrttcz7PCkzCITzEhtxUw=
github.com/google/uuid v1.6.0/go.mod h1:TIyPZe4MgqvfeYDBFedMoGGpEw/LqOeaOT+nhxU+yHo=
```

| Column | Meaning |
|--------|---------|
| Module path | The dependency being checksummed |
| Version | The specific version |
| Hash | SHA-256 hash of the module's source code |
| `/go.mod` | Hash of just the `go.mod` file |

!!! danger "Never Edit go.sum"

    The `go.sum` file is auto-generated. Manual edits will cause checksum verification failures. If you need to regenerate it, delete the file and run `go mod tidy`.

---

## Adding Dependencies

=== "Using go get"

    ```bash
    # Add the latest version of a dependency
    $ go get github.com/gin-gonic/gin@latest

    # Add a specific version
    $ go get github.com/gin-gonic/gin@v1.9.1

    # Add a specific commit
    $ go get github.com/gin-gonic/gin@abc123

    # Update a specific dependency
    $ go get -u github.com/gin-gonic/gin

    # Update all dependencies
    $ go get -u ./...

    # View available versions
    $ go list -m -versions github.com/gin-gonic/gin
    ```

=== "Using go mod tidy"

    ```bash
    # Add all imports found in your code to go.mod
    # Remove dependencies no longer used
    $ go mod tidy

    # This is the recommended way to manage dependencies
    # It analyzes your code and updates go.mod automatically
    ```

=== "Removing Dependencies"

    ```bash
    # Remove a specific dependency
    $ go mod edit -droprequire github.com/unused/package
    $ go mod tidy

    # Or simply remove the import from your code and run:
    $ go mod tidy
    # tidy will remove unused dependencies automatically
    ```

---

## Working with Dependencies

=== "Viewing Dependencies"

    ```bash
    # List all direct and indirect dependencies
    $ go list -m all

    # List only direct dependencies
    $ go list -m -f '{{if not .Indirect}}{{.Path}}{{end}}' all

    # Show dependency graph
    $ go mod graph

    # Show why a dependency is needed
    $ go mod why github.com/jackc/pgx/v5

    # Verify all dependencies are downloaded
    $ go mod verify
    ```

=== "Updating Dependencies"

    ```bash
    # Update a specific dependency to latest minor/patch
    $ go get github.com/gin-gonic/gin@patch

    # Update to latest major version (if API compatible)
    $ go get github.com/gin-gonic/gin@minor

    # Update to a specific version
    $ go get github.com/gin-gonic/gin@v1.10.0

    # Update all dependencies
    $ go get -u ./...
    $ go mod tidy
    ```

=== "The Terminal Output"

    ```bash
    $ go list -m all
    github.com/user/webapp v0.0.0-00010101000000-000000000000
    github.com/gin-gonic/gin v1.9.1
    github.com/jackc/pgx/v5 v5.5.0
    github.com/redis/go-redis/v9 v9.3.0
    golang.org/x/crypto v0.17.0
    github.com/bytedance/sonic v1.10.0
    github.com/chenzhuoyu/base64x v0.0.0-20230717121745-296ad89f973d
    ```

---

## Vendoring

Vendoring copies all dependencies into your repository so builds work without network access.

```bash
# Create the vendor directory
$ go mod vendor

# Build using vendored dependencies
$ go build -mod=vendor ./...

# Test using vendored dependencies
$ go test -mod=vendor ./...

# Verify vendor directory is consistent
$ go mod verify
```

!!! warning "When to Vendor"

    **Do vendor when:**
    - You need reproducible builds without network access
    - Your CI/CD pipeline has restricted network access
    - You want to pin exact dependency versions in version control

    **Do not vendor when:**
    - Your project is a library (consumers will use their own versions)
    - You are working on a small project with stable dependencies
    - You want to keep your repository small

---

## Module Proxies

Go uses a module proxy to download dependencies. The default proxy is `proxy.golang.org`.

```bash
# Check current proxy
$ go env GOPROXY
https://proxy.golang.org,direct

# Set a custom proxy
$ go env -w GOPROXY=https://goproxy.cn,direct

# Use direct download (no proxy)
$ go env -w GOPROXY=direct

# Use multiple proxies (comma-separated, fallback with |)
$ go env -w GOPROXY=https://proxy.company.com,https://proxy.golang.org,direct
```

| Proxy | Use Case |
|-------|----------|
| `https://proxy.golang.org` | Default, fast, global CDN |
| `https://goproxy.cn` | China mirror |
| `https://goproxy.io` | Alternative mirror |
| `direct` | Download directly from source |
| Custom | Corporate proxies, internal mirrors |

---

## Private Modules

For proprietary code, you need to bypass the public proxy.

```bash
# Set GOPRIVATE for your organization
$ go env -w GOPRIVATE=github.com/yourcompany/*

# Or set individually
$ go env -w GONOSUMCHECK=github.com/yourcompany/*
$ go env -w GONOPROXY=github.com/yourcompany/*

# For git authentication (SSH)
$ git config --global url."git@github.com:".insteadOf "https://github.com/"

# For HTTPS with token
$ git config --global url."https://token@github.com/".insteadOf "https://github.com/"
```

=== "GOPRIVATE Explained"

    ```bash
    # GOPRIVATE is a comma-separated list of patterns
    # For these patterns:
    # 1. go get skips the module proxy
    # 2. go get skips checksum verification
    # 3. go get uses direct git access

    # Examples:
    go env -w GOPRIVATE=github.com/yourcompany/*
    go env -w GOPRIVATE=*.internal.company.com,github.com/yourcompany/*
    ```

=== "Authentication Setup"

    ```bash
    # SSH key (recommended)
    # 1. Add your SSH key to GitHub/GitLab
    # 2. Configure git to use SSH for your private domain:
    $ git config --global url."git@github.com:".insteadOf "https://github.com/"

    # Netrc file (~/.netrc)
    machine github.com
    login oauth2
    token ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

    # GONOSUMDB — skip sum database for private modules
    $ go env -w GONOSUMDB=github.com/yourcompany/*
    ```

---

## Complete Module Example

Here is a real-world module setup for a web API:

=== "The Code"

    ```go
    // File: main.go
    package main

    import (
        "context"
        "log"
        "net/http"
        "os"
        "os/signal"
        "syscall"
        "time"

        "github.com/gin-gonic/gin"
    )

    func main() {
        r := gin.Default()

        r.GET("/health", func(c *gin.Context) {
            c.JSON(http.StatusOK, gin.H{
                "status": "ok",
                "time":   time.Now().Format(time.RFC3339),
            })
        })

        srv := &http.Server{
            Addr:    ":8080",
            Handler: r,
        }

        go func() {
            if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
                log.Fatalf("listen: %s\n", err)
            }
        }()

        // Graceful shutdown
        quit := make(chan os.Signal, 1)
        signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
        <-quit
        log.Println("Shutting down server...")

        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()
        if err := srv.Shutdown(ctx); err != nil {
            log.Fatalf("Server forced to shutdown: %s\n", err)
        }

        log.Println("Server exiting")
    }
    ```

=== "Module Files"

    ```
    // go.mod
    module github.com/user/webapp

    go 1.22

    require github.com/gin-gonic/gin v1.9.1

    require (
        github.com/bytedance/sonic v1.10.0 // indirect
        github.com/chenzhuoyu/base64x v0.0.0-20230717121745-296ad89f973d // indirect
        github.com/gabriel-vasile/mimetype v1.4.2 // indirect
        github.com/go-playground/locales v0.14.1 // indirect
        github.com/go-playground/universal-translator v0.18.1 // indirect
        github.com/go-playground/validator/v10 v10.15.0 // indirect
        github.com/goccy/go-json v0.10.2 // indirect
        github.com/json-iterator/go v1.1.12 // indirect
        github.com/klauspost/cpuid/v2 v2.2.5 // indirect
        github.com/leodido/go-urn v1.2.4 // indirect
        github.com/mattn/go-isatty v0.0.19 // indirect
        github.com/modern-go/concurrent v0.0.0-20180228061459-e0a39a4cb421 // indirect
        github.com/modern-go/reflect2 v1.0.2 // indirect
        github.com/pelletier/go-toml/v2 v2.0.9 // indirect
        github.com/twitchyliquid64/golang-asm v0.15.1 // indirect
        github.com/ugorji/go/codec v1.2.11 // indirect
        golang.org/x/arch v0.5.0 // indirect
        golang.org/x/crypto v0.14.0 // indirect
        golang.org/x/net v0.17.0 // indirect
        golang.org/x/sys v0.13.0 // indirect
        golang.org/x/text v0.13.0 // indirect
        google.golang.org/protobuf v1.31.0 // indirect
        gopkg.in/yaml.v3 v3.0.1 // indirect
    )
    ```

=== "The Terminal Output"

    ```bash
    # Initialize the module
    $ go mod init github.com/user/webapp

    # Install gin
    $ go get github.com/gin-gonic/gin@latest

    # Tidy up
    $ go mod tidy

    # Run the server
    $ go run main.go
    [GIN-debug] Listening and serving HTTP on :8080

    # Test it
    $ curl http://localhost:8080/health
    {"status":"ok","time":"2024-01-15T10:30:00Z"}

    # Gracefully stop with Ctrl+C
    ^C
    Shutting down server...
    Server exiting
    ```

---

## Best Practices

| Practice | Recommendation |
|----------|---------------|
| **Initialize early** | Run `go mod init` as the first step in any new project |
| **Use go mod tidy** | Run after every dependency change to keep go.mod clean |
| **Pin versions** | Use `go get pkg@v1.2.3` for critical dependencies |
| **Vendor in CI** | Use `-mod=vendor` in CI for reproducible builds |
| **GOPRIVATE** | Set for all internal/corporate modules |
| **go.sum in VCS** | Always commit go.sum to version control |
| **Avoid replace** | Use `replace` only temporarily; upstream your fixes |
| **Update regularly** | Run `go get -u ./...` periodically to stay current |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `module not found` | Check module path in `go.mod` matches the import |
| `version not found` | Check available versions with `go list -m -versions` |
| `checksum mismatch` | Delete `go.sum`, run `go mod tidy` |
| `cannot download` | Check `GOPROXY`, network, and firewall settings |
| `private module not found` | Set `GOPRIVATE` and configure git authentication |
| `vendor out of sync` | Run `go mod vendor` to regenerate vendor directory |
| `go.sum has unexpected hash` | Delete `go.sum` and run `go mod tidy` |
| `missing go.sum entry` | Run `go mod tidy` to add the entry |

## Summary

- Modules are initialized with `go mod init <module-path>`
- `go.mod` declares dependencies; `go.sum` verifies integrity
- `go get` adds/updates dependencies; `go mod tidy` cleans up
- Vendoring copies dependencies for offline builds
- `GOPRIVATE` bypasses the public proxy for internal modules
- Always commit `go.mod` and `go.sum` to version control

## Next Steps

- [Project Structure](project-structure.md) — Organize your module into a standard layout
- [Basic Syntax & Types](basic-syntax.md) — Learn Go's type system
- [IDE Setup & Tooling](ide-setup.md) — Configure your editor for module development
