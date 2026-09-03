# IDE Setup & Tooling

A well-configured IDE dramatically improves productivity. This chapter covers setting up VS Code or GoLand with Go support, configuring linters, formatters, and debugging tools, and using the `go` command-line tools effectively.

## What You Will Learn

- Set up VS Code with the official Go extension
- Configure GoLand for Go development
- Understand and use `gopls` (Go language server)
- Set up `go fmt`, `go vet`, and `staticcheck`
- Debug Go programs with Delve
- Configure formatting and linting on save

## Prerequisites

- [Setup & Installation](setup-installation.md) — Go 1.22+ installed
- [Your First Program](first-program.md) — Basic Go program structure

---

## VS Code + Go Extension

VS Code is the most popular free editor for Go. The official Go extension provides comprehensive language support.

=== "Installation"

    ```bash
    # 1. Install VS Code from https://code.visualstudio.com

    # 2. Open VS Code and install the Go extension
    #    - Open Command Palette: Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows/Linux)
    #    - Type "Extensions: Install Extensions"
    #    - Search for "Go" by Google
    #    - Click "Install"

    # 3. The extension will prompt you to install Go tools
    #    Click "Install" to install all recommended tools:
    #    - gopls (language server)
    #    - dlv (debugger)
    #    - staticcheck (linter)
    #    - goimports (import organizer)
    #    - golangci-lint (meta-linter)
    #    - and more...

    # 4. Verify tools are installed
    $ go install golang.org/x/tools/gopls@latest
    $ go install github.com/go-delve/delve/cmd/dlv@latest
    $ go install honnef.co/go/tools/cmd/staticcheck@latest
    $ go install golang.org/x/tools/cmd/goimports@latest
    ```

=== "Essential Settings"

    ```json
    // File: .vscode/settings.json (project-level)
    // Or: ~/Library/Application Support/Code/User/settings.json (user-level)
    {
        // Language server
        "go.useLanguageServer": true,
        "gopls": {
            "build.directoryFilters": ["-node_modules"],
            "ui.completion.usePlaceholders": true,
            "ui.diagnostic.staticcheck": true,
            "ui.semanticTokens": true
        },

        // Formatting
        "go.formatTool": "goimports",
        "go.formatFlags": ["-local", "github.com/user/myproject"],

        // Linting
        "go.lintTool": "staticcheck",
        "go.lintFlags": ["-checks=all", "-strict"],

        // Testing
        "go.testFlags": ["-v", "-race"],
        "go.testTimeout": "60s",

        // Coverage
        "go.coverOnSave": true,
        "go.coverOnSingleTest": true,
        "go.coverageDecorator": {
            "type": "highlight"
        },

        // Editor behavior
        "[go]": {
            "editor.formatOnSave": true,
            "editor.codeActionsOnSave": {
                "source.organizeImports": "explicit"
            },
            "editor.snippetSuggestions": "none",
            "editor.defaultFormatter": "golang.go"
        },

        // Debug
        "go.delveConfig": {
            "dlvLoadConfig": {
                "followPointers": true,
                "maxStringLen": 2048,
                "maxArrayValues": 64,
                "maxStructFields": -1
            },
            "apiVersion": 2
        }
    }
    ```

=== "Recommended Extensions"

    | Extension | Purpose |
    |-----------|---------|
    | **Go** (by Google) | Language support, debugging, testing |
    | **Error Lens** | Inline error highlighting |
    | **GitLens** | Git blame, history, annotations |
    | **EditorConfig** | Consistent formatting across editors |
    | **REST Client** | Test HTTP endpoints in-editor |
    | **YAML** | Go configuration file support |
    | **Markdown All in One** | Documentation editing |

    ```bash
    # Install extensions from command line
    $ code --install-extension golang.go
    $ code --install-extension username.errorlens
    $ code --install-extension eamodio.gitlens
    ```

---

## GoLand

GoLand is JetBrains' commercial IDE for Go. It includes everything out of the box.

=== "Installation"

    ```bash
    # Option 1: Download from https://www.jetbrains.com/go/

    # Option 2: JetBrains Toolbox (recommended)
    # Download from https://www.jetbrains.com/toolbox-app/

    # Option 3: Homebrew on macOS
    $ brew install --cask goland

    # Option 4: Snap on Linux
    $ snap install goland --classic

    # Open GoLand
    $ open -a "GoLand"  # macOS
    $ goland &          # Linux
    ```

=== "Configuration"

    GoLand auto-detects your Go installation and requires minimal configuration:

    **1. Set Go SDK:**
    - Go to `Go` → `Settings` → `Go` → `GOROOT`
    - Select your Go installation path (usually auto-detected)

    **2. Configure Linting:**
    - Go to `Go` → `Settings` → `Go` → `Linters`
    - Enable `staticcheck` and `golangci-lint`

    **3. Configure Run Configurations:**
    - Go to `Run` → `Edit Configurations`
    - Add Go run configuration for your main package

    **4. Import Settings from VS Code:**
    - GoLand can import VS Code settings
    - Go to `File` → `Import Settings`

=== "Key Features"

    | Feature | Description |
    |---------|-------------|
    | **Built-in Debugger** | Step through code, inspect variables, set breakpoints |
| **Test Runner** | Run tests with coverage directly from the editor |
    | **Refactoring** | Rename, extract, inline, and more |
    | **Database Tools** | Connect to databases without leaving the IDE |
    | **Version Control** | Git integration with visual diff and merge |
    | **Code Analysis** | Real-time error detection and quick fixes |

---

## gopls — The Go Language Server

`gopls` (pronounced "go plays") is the official Go language server. It powers code intelligence in VS Code, GoLand, Neovim, and other editors.

```bash
# Install gopls
$ go install golang.org/x/tools/gopls@latest

# Update gopls
$ go install golang.org/x/tools/gopls@latest

# Check version
$ gopls version
golang.org/x/tools/gopls v0.14.0

# Check configuration
$ gopls api-json | grep -A 5 "formatting"
```

=== "gopls Features"

    | Feature | Description |
    |---------|-------------|
    | **Code completion** | Auto-complete for types, functions, methods |
    | **Go to definition** | Jump to any symbol's definition |
    | **Find references** | Find all usages of a symbol |
    | **Hover** | Show type information and documentation |
    | **Signature help** | Function parameter hints |
    | **Diagnostics** | Real-time error and warning reporting |
    | **Code actions** | Quick fixes, refactoring suggestions |
    | **Formatting** | Automatic code formatting |
    | **Symbol search** | Search for types, functions, variables |
    | **Workspace symbols** | Search across your entire project |

=== "Troubleshooting gopls"

    ```bash
    # If gopls is slow, check for issues
    $ gopls -remote=auto -logfile=/tmp/gopls.log -remote.debug=:6060

    # Reset gopls cache
    $ go clean -cache

    # Check gopls logs in VS Code
    # Command Palette → "Go: Toggle Gopls Detailed Log"

    # If gopls cannot find packages, try:
    $ go mod tidy
    $ go clean -modcache
    $ go mod download
    ```

---

## go fmt — Code Formatting

Go has a canonical formatting style enforced by `gofmt`. All Go code should be formatted consistently.

```bash
# Format a single file
$ gofmt -w main.go

# Format all Go files in current directory
$ gofmt -w .

# Format all Go files in the project
$ gofmt -w ./...

# Check formatting without modifying
$ gofmt -l ./...

# Show diff of what would change
$ gofmt -d main.go

# Format with import organization (recommended)
$ goimports -w -local github.com/user/myproject .
```

!!! go "Use goimports Instead of gofmt"

    `goimports` runs `gofmt` and additionally organizes imports into groups (stdlib, external, internal). It is the standard tool for Go formatting.

=== "Formatting Rules"

    | Rule | Example |
    |------|---------|
    | Tabs for indentation | Never spaces |
    | Brace opening on same line | `func main() {` |
    | Line length | No enforced limit; prefer 100-120 chars |
    | Trailing comma in multi-line | Required: `[]int{1, 2, 3,}` |
    | Import grouping | Stdlib → External → Internal |
    | Blank line between functions | Required |

=== "Auto-Format on Save"

    ```bash
    # VS Code: Add to settings.json
    {
        "[go]": {
            "editor.formatOnSave": true,
            "editor.codeActionsOnSave": {
                "source.organizeImports": "explicit"
            },
            "editor.defaultFormatter": "golang.go"
        }
    }

    # Neovim: Add to init.lua
    vim.api.nvim_create_autocmd("BufWritePre", {
        pattern = "*.go",
        callback = function()
            vim.lsp.buf.format()
        end,
    })
    ```

---

## go vet — Static Analysis

`go vet` checks for suspicious code constructs that are likely bugs.

```bash
# Vet the current package
$ go vet ./...

# Vet with specific analyzers
$ go vet -vettool=$(which analyzer) ./...

# Common vet warnings
$ go vet ./...
# ./main.go:15:1: unreachable code
# ./main.go:22:2: missing comma in composite literal
# ./main.go:30:3: call of fmt.Sprintf has unnecessary Verb %!
```

| Warning | Meaning |
|---------|---------|
| `unreachable code` | Code after a `return`, `break`, or `continue` |
| `missing comma` | Missing comma in struct/slice/map literal |
| `printf format mismatch` | Format verb does not match argument type |
| `shadowed variable` | Variable declared with `:=` shadows an outer variable |
| `loop variable capture` | Loop variable captured in closure (fixed in Go 1.22) |

---

## staticcheck — Advanced Linting

`staticcheck` is a state-of-the-art linter for Go. It catches bugs, performance issues, and style violations.

```bash
# Install staticcheck
$ go install honnef.co/go/tools/cmd/staticcheck@latest

# Run on current package
$ staticcheck ./...

# Run with all checks
$ staticcheck -checks all ./...

# Run specific checks
$ staticcheck -checks SA4006 ./...

# Run and fail on warnings
$ staticcheck -fail ./...
```

=== "staticcheck Categories"

    | Category | Description | Examples |
    |----------|-------------|---------|
    | **SA** | Static analysis errors | Unused variables, unreachable code |
    | **S** | Style suggestions | Simplifications, code hygiene |
    | **QF** | Quick fixes | Auto-fixable suggestions |
    | **ST** | Style checks | Coding style violations |
    | **S1000** | Simplification | Use `strings.Contains` instead of `strings.Index` |

=== "Example staticcheck Output"

    ```bash
    $ staticcheck ./...
    main.go:10:5: variable 'count' is assigned but never used (SA4006)
    main.go:15:2: should use 'continue' instead of 'break' in for loop (S1003)
    main.go:22:1: error return value not checked (errcheck)
    main.go:30:2: redundant type conversion (S1034)

    # Quick fix available
    $ staticcheck -fix ./...
    ```

---

## golangci-lint — Meta-Linter

`golangci-lint` runs multiple linters in parallel for fast, comprehensive analysis.

```bash
# Install golangci-lint
$ curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(go env GOPATH)/bin golangci-lint

# Or with Homebrew
$ brew install golangci-lint

# Run all linters
$ golangci-lint run

# Run with specific linters
$ golangci-lint run --enable=staticcheck,govet,errcheck

# Run on specific files
$ golangci-lint run ./cmd/...

# Auto-fix issues
$ golangci-lint run --fix
```

=== ".golangci.yml Configuration"

    ```yaml
    # File: .golangci.yml
    run:
      timeout: 5m
      modules-download-mode: readonly

    linters:
      enable:
        - errcheck
        - gosimple
        - govet
        - ineffassign
        - staticcheck
        - unused
        - gocritic
        - gofmt
        - goimports
        - misspell
        - bodyclose
        - contextcheck
        - durationcheck
        - errname
        - errorlint
        - exportloopref
        - goconst
        - gocognit
        - gosec
        - makezero
        - nilerr
        - prealloc
        - predeclared
        - revive
        - sqlclosecheck
        - unconvert
        - unparam
        - wastedassign

    linters-settings:
      errcheck:
        check-type-assertions: true
        check-blank: false

      govet:
        enable-all: true

      goimports:
        local-prefixes: github.com/user/myproject

      goconst:
        min-len: 3
        min-occurrences: 3

      revive:
        rules:
          - name: blank-imports
          - name: context-as-argument
          - name: dot-imports
          - name: error-return
          - name: error-strings
          - name: error-naming
          - name: exported
          - name: increment-decrement
          - name: var-naming
          - name: package-comments

    issues:
      exclude-use-default: false
      max-issues-per-linter: 0
      max-same-issues: 0
    ```

---

## Debugging with Delve

Delve (`dlv`) is the Go debugger. It supports breakpoints, step execution, variable inspection, and more.

=== "Installation"

    ```bash
    # Install Delve
    $ go install github.com/go-delve/delve/cmd/dlv@latest

    # Verify installation
    $ dlv version
    Delve Debugger
    Version: 1.21.0
    Build:
    ```

=== "Debugging with VS Code"

    ```json
    // File: .vscode/launch.json
    {
        "version": "0.2.0",
        "configurations": [
            {
                "name": "Launch Package",
                "type": "go",
                "request": "launch",
                "mode": "auto",
                "program": "${workspaceFolder}",
                "args": [],
                "showLog": true
            },
            {
                "name": "Launch Test",
                "type": "go",
                "request": "launch",
                "mode": "test",
                "program": "${workspaceFolder}",
                "args": ["-test.v"],
                "showLog": true
            },
            {
                "name": "Launch Specific Test",
                "type": "go",
                "request": "launch",
                "mode": "test",
                "program": "${workspaceFolder}",
                "args": ["-test.run", "TestFunctionName", "-test.v"],
                "showLog": true
            }
        ]
    }
    ```

=== "Debugging with Delve CLI"

    ```bash
    # Debug a program
    $ dlv debug main.go

    # Debug tests
    $ dlv test ./...

    # Debug a running process
    $ dlv attach <pid>

    # Listen for remote debugger
    $ dlv debug --headless --listen=:2345 --api-version=2

    # Common Delve commands
    (dlv) break main.main          # Set breakpoint
    (dlv) break main.go:15         # Breakpoint at line
    (dlv) continue                 # Run to next breakpoint
    (dlv) next                     # Step over
    (dlv) step                     # Step into
    (dlv) stepout                  # Step out
    (dlv) print variableName       # Print variable
    (dlv) locals                   # Print all local variables
    (dlv) args                     # Print function arguments
    (dlv) goroutines               # List all goroutines
    (dlv) thread <id>              # Switch to thread
    (dlv) quit                     # Exit debugger
    ```

=== "VS Code Debug Toolbar"

    After configuring `launch.json`, you can:

    1. Press `F5` to start debugging
    2. Set breakpoints by clicking the gutter (left of line numbers)
    3. Use the debug toolbar:
       - **Continue** (F5): Run to next breakpoint
       - **Step Over** (F10): Execute current line
       - **Step Into** (F11): Enter function call
       - **Step Out** (Shift+F11): Exit current function
       - **Restart** (Ctrl+Shift+F5): Restart debugging
       - **Stop** (Shift+F5): Stop debugging

---

## Complete Tool Chain

Here is the recommended tool chain for Go development:

=== "Essential Tools"

    | Tool | Purpose | Install |
    |------|---------|---------|
    | **gopls** | Language server | `go install golang.org/x/tools/gopls@latest` |
    | **goimports** | Import organization | `go install golang.org/x/tools/cmd/goimports@latest` |
    | **staticcheck** | Linting | `go install honnef.co/go/tools/cmd/staticcheck@latest` |
    | **golangci-lint** | Meta-linter | `brew install golangci-lint` |
    | **delve** | Debugger | `go install github.com/go-delve/delve/cmd/dlv@latest` |

=== "Workflow"

    ```bash
    # 1. Write code in your IDE (VS Code or GoLand)

    # 2. Format and organize imports on save
    #    - VS Code: auto on save with goimports
    #    - GoLand: auto on save with built-in formatter

    # 3. Run linters before commit
    $ golangci-lint run

    # 4. Run tests
    $ go test -race ./...

    # 5. Build for production
    $ go build -o myapp ./cmd/server

    # 6. Debug issues
    $ dlv debug ./cmd/server
    ```

---

## Best Practices

| Practice | Recommendation |
|----------|---------------|
| **IDE** | Choose one (VS Code or GoLand) and learn it deeply |
| **Format on save** | Enable `goimports` formatting on save |
| **Lint on save** | Enable `staticcheck` or `golangci-lint` on save |
| **Use gopls** | Let the language server handle completion and diagnostics |
| **Debug with Delve** | Use the debugger instead of `fmt.Println` debugging |
| **Commit linted code** | Always run `golangci-lint run` before committing |
| **Consistent tooling** | Ensure the team uses the same formatter and linter versions |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `gopls` not working | Restart the language server: `Cmd+Shift+P` → "Go: Restart Language Server" |
| IDE slow on large projects | Add `-node_modules` to `gopls.build.directoryFilters` |
| Format on save not working | Check `editor.formatOnSave` and `editor.defaultFormatter` settings |
| `goimports` not grouping | Add `-local github.com/user/project` to format flags |
| Debugger not stopping at breakpoints | Ensure you are debugging the correct package |
| `golangci-lint` timeout | Increase timeout: `golangci-lint run --timeout=10m` |
| Missing linter warnings | Add linter to `.golangci.yml` config and re-run |
| Import path not resolved | Run `go mod tidy` and restart gopls |

## Summary

- VS Code with the Go extension or GoLand are the recommended IDEs
- `gopls` provides code intelligence (completion, go-to-definition, diagnostics)
- `goimports` handles formatting and import organization
- `staticcheck` or `golangci-lint` catches bugs and style issues
- Delve (`dlv`) provides step-through debugging
- Enable format-on-save and lint-on-save for consistent code quality
- Configure `.golangci.yml` for project-specific linting rules

## Next Steps

- [Go Modules & Dependencies](go-modules.md) — Manage dependencies in your project
- [Project Structure](project-structure.md) — Organize your codebase
- [Basic Syntax & Types](basic-syntax.md) — Deep dive into Go's type system
