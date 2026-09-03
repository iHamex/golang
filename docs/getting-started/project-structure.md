# Project Structure

A well-organized Go project is easier to navigate, test, and maintain. The Go community has developed conventions for directory layout that this chapter covers in detail. These patterns scale from small CLI tools to large microservices.

## What You Will Learn

- The standard Go project layout (`cmd/`, `pkg/`, `internal/`)
- How Go packages and imports work
- Package naming conventions
- When to use monorepo vs multi-module repositories
- Common anti-patterns and how to avoid them

## Prerequisites

- [Go Modules & Dependencies](go-modules.md) — Understanding of `go.mod` and module management
- [Your First Program](first-program.md) — Basic Go program structure

---

## The Standard Layout

The Go community has converged on a standard project structure. Here is a complete layout for a production-ready project:

```
myproject/
├── cmd/
│   └── server/
│       └── main.go           # Application entry point
├── internal/
│   ├── handler/
│   │   └── user.go           # HTTP handlers
│   ├── service/
│   │   └── user.go           # Business logic
│   ├── repository/
│   │   └── user.go           # Data access
│   └── model/
│       └── user.go           # Domain types
├── pkg/
│   └── middleware/
│       └── auth.go           # Public, reusable packages
├── api/
│   └── openapi.yaml          # API specifications
├── configs/
│   └── config.yaml           # Configuration files
├── migrations/
│   └── 001_initial.up.sql    # Database migrations
├── scripts/
│   └── deploy.sh             # Build and deployment scripts
├── test/
│   └── integration/
│       └── api_test.go       # Integration tests
├── docs/
│   └── README.md             # Documentation
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

---

## Directory Explanations

=== "cmd/"

    ```go
    // File: cmd/server/main.go
    package main

    import (
        "log"
        "os"

        "github.com/user/myproject/internal/config"
        "github.com/user/myproject/internal/server"
    )

    func main() {
        cfg, err := config.Load()
        if err != nil {
            log.Fatalf("Failed to load config: %v", err)
        }

        srv := server.New(cfg)
        if err := srv.Start(); err != nil {
            log.Fatalf("Server failed: %v", err)
            os.Exit(1)
        }
    }
    ```

    - Contains **one directory per binary**
    - Each directory has a `main.go` with `package main` and `func main()`
    - Keep `cmd/` minimal — delegate to `internal/` packages
    - For projects with multiple binaries (server, CLI, worker), add more directories:
      ```
      cmd/
      ├── server/
      │   └── main.go
      ├── cli/
      │   └── main.go
      └── worker/
          └── main.go
      ```

=== "internal/"

    ```go
    // File: internal/handler/user.go
    package handler

    import (
        "encoding/json"
        "net/http"

        "github.com/user/myproject/internal/service"
    )

    type UserHandler struct {
        svc *service.UserService
    }

    func NewUserHandler(svc *service.UserService) *UserHandler {
        return &UserHandler{svc: svc}
    }

    func (h *UserHandler) GetByID(w http.ResponseWriter, r *http.Request) {
        id := r.URL.Query().Get("id")
        user, err := h.svc.GetByID(r.Context(), id)
        if err != nil {
            http.Error(w, err.Error(), http.StatusNotFound)
            return
        }
        json.NewEncoder(w).Encode(user)
    }
    ```

    - **Private to your module** — cannot be imported by other modules
    - Contains the core business logic and implementation details
    - Organize by concern: `handler/`, `service/`, `repository/`, `model/`
    - The `internal/` convention is enforced by the Go compiler

=== "pkg/"

    ```go
    // File: pkg/middleware/auth.go
    package middleware

    import (
        "context"
        "net/http"
        "strings"
    )

    type contextKey string

    const UserIDKey contextKey = "user_id"

    func Auth(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
            if token == "" {
                http.Error(w, "Unauthorized", http.StatusUnauthorized)
                return
            }

            // Validate token and extract user ID
            userID, err := validateToken(token)
            if err != nil {
                http.Error(w, "Invalid token", http.StatusUnauthorized)
                return
            }

            ctx := context.WithValue(r.Context(), UserIDKey, userID)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }

    func validateToken(token string) (string, error) {
        // Token validation logic
        return "user-123", nil
    }
    ```

    - **Public and importable** by other modules
    - Only put code here that other projects might reuse
    - Examples: middleware, utilities, shared libraries
    - If you are not building a library, you may not need `pkg/` at all

=== "Other Directories"

    ```
    api/           # API specifications (OpenAPI, gRPC proto files, GraphQL schemas)
    configs/       # Configuration files (YAML, TOML, JSON)
    migrations/    # Database migration SQL files
    scripts/       # Build, deploy, and utility scripts
    test/          # Integration and end-to-end tests
    docs/          # Project documentation
    ```

    These directories are conventions, not Go-specific requirements. They help organize non-code files.

---

## Package Naming Conventions

Go has strict naming rules. Follow them to write idiomatic code.

```go
// GOOD: Short, lowercase, single-word package names
package user
package handler
package middleware
package config
package server

// BAD: Multiple words, underscores, or mixed case
package user_service      // Use: package service
package UserHandler       // Use: package handler
package my_middleware      // Use: package middleware
package util               // Avoid generic names; be specific

// GOOD: Avoid stuttering (repeating the package name in types)
package user

type Service struct{}     // NOT UserService
type Repository struct{}  // NOT UserRepository
type Handler struct{}     // NOT UserHandler

// BAD: Stuttering
package user

type UserService struct{}       // Redundant "User"
type UserRepository struct{}   // Redundant "User"
```

| Rule | Example |
|------|---------|
| Lowercase, single-word | `package user` |
| No underscores | `package httpserver` not `package http_server` |
| No CamelCase | `package mypackage` not `package MyPackage` |
| Avoid generic names | `package config` not `package util` |
| Avoid stuttering | `user.Service` not `user.UserService` |

---

## Import Paths

Import paths must match your module path:

```go
package main

import (
    // Standard library
    "fmt"
    "net/http"
    "context"

    // External dependencies
    "github.com/gin-gonic/gin"
    "github.com/jackc/pgx/v5"

    // Internal packages (using module path)
    "github.com/user/myproject/internal/config"
    "github.com/user/myproject/internal/handler"
    "github.com/user/myproject/internal/service"
    "github.com/user/myproject/pkg/middleware"
)
```

=== "Import Grouping Convention"

    ```go
    package main

    import (
        // Standard library
        "fmt"
        "net/http"
        "os"

        // External packages
        "github.com/gin-gonic/gin"
        "github.com/jackc/pgx/v5"

        // Internal packages
        "github.com/user/myproject/internal/config"
        "github.com/user/myproject/internal/server"
    )
    ```

    The `goimports` tool automatically groups imports in this order. Use it to avoid manual formatting.

=== "Blank Imports"

    ```go
    package main

    import (
        // Side-effect import: registers the driver for database/sql
        _ "github.com/lib/pq"

        // Blank import: ensure interface compliance
        _ "github.com/user/myproject/internal/handler"
    )
    ```

    - **`_ "package"`**: Import for side effects only (e.g., registering database drivers)
    - **`_ "pkg"`**: Compile-time check that a type implements an interface

---

## Monorepo vs Multi-Module

=== "Monorepo (Single Module)"

    ```
    myproject/
    ├── cmd/
    │   ├── server/
    │   └── cli/
    ├── internal/
    ├── pkg/
    ├── go.mod          # Single go.mod for everything
    └── go.sum
    ```

    **Pros:**
    - Simple dependency management
    - Easy code sharing between packages
    - Single CI/CD pipeline
    - Atomic changes across the codebase

    **Cons:**
    - All code shares the same version
    - Consumers must import the entire module
    - Larger `go.sum` for consumers
    - Not suitable for independent libraries

=== "Multi-Module"

    ```
    monorepo/
    ├── go.mod              # Root module
    ├── server/
    │   ├── go.mod          # Separate module
    │   └── main.go
    ├── lib/
    │   ├── go.mod          # Separate module
    │   └── utils.go
    └── shared/
        ├── go.mod          # Separate module
        └── types.go
    ```

    **Pros:**
    - Independent versioning
    - Smaller dependency footprint for consumers
    - Clear API boundaries
    - Suitable for shared libraries

    **Cons:**
    - More complex dependency management
    - Cannot easily share internal packages
    - Multiple CI/CD pipelines
    - Requires careful version coordination

!!! warning "When to Use Multi-Module"

    Use multi-module only when:
    - You are building libraries consumed by other teams
    - Components need independent versioning
    - You want strict API boundaries

    For most applications, a single module is simpler and sufficient.

---

## Real-World Example: CLI Application

=== "The Code"

    ```go
    // File: cmd/mycli/main.go
    package main

    import (
        "fmt"
        "os"

        "github.com/user/mycli/internal/commands"
    )

    func main() {
        if err := commands.Execute(); err != nil {
            fmt.Fprintf(os.Stderr, "Error: %v\n", err)
            os.Exit(1)
        }
    }
    ```

    ```go
    // File: internal/commands/root.go
    package commands

    import (
        "fmt"
        "os"

        "github.com/spf13/cobra"
    )

    var rootCmd = &cobra.Command{
        Use:   "mycli",
        Short: "A CLI tool for managing things",
        Long:  `mycli is a command-line tool that helps you manage projects, configurations, and deployments.`,
    }

    func Execute() error {
        return rootCmd.Execute()
    }

    func init() {
        rootCmd.AddCommand(versionCmd)
        rootCmd.AddCommand(initCmd)
    }

    var versionCmd = &cobra.Command{
        Use:   "version",
        Short: "Print the version number",
        Run: func(cmd *cobra.Command, args []string) {
            fmt.Println("mycli v1.0.0")
        },
    }

    var initCmd = &cobra.Command{
        Use:   "init",
        Short: "Initialize a new project",
        Run: func(cmd *cobra.Command, args []string) {
            fmt.Println("Initializing new project...")
        },
    }
    ```

=== "The Terminal Output"

    ```bash
    $ go run cmd/mycli/main.go --help
    mycli is a command-line tool that helps you manage projects,
    configurations, and deployments.

    Usage:
      mycli [command]

    Available Commands:
      init        Initialize a new project
      version     Print the version number

    Flags:
      -h, --help   help for mycli

    Use "mycli [command] --help" for more information about a command.

    $ go run cmd/mycli/main.go version
    mycli v1.0.0
    ```

---

## Real-World Example: Web API

=== "The Code"

    ```go
    // File: cmd/server/main.go
    package main

    import (
        "log"

        "github.com/user/myapp/internal/config"
        "github.com/user/myapp/internal/server"
    )

    func main() {
        cfg := config.New()
        srv := server.New(cfg)
        log.Fatal(srv.Start())
    }
    ```

    ```go
    // File: internal/config/config.go
    package config

    type Config struct {
        Port     int
        Database string
        LogLevel string
    }

    func New() *Config {
        return &Config{
            Port:     8080,
            Database: "postgres://localhost/myapp",
            LogLevel: "info",
        }
    }
    ```

    ```go
    // File: internal/server/server.go
    package server

    import (
        "fmt"
        "net/http"

        "github.com/user/myapp/internal/config"
        "github.com/user/myapp/internal/handler"
    )

    type Server struct {
        cfg *config.Config
    }

    func New(cfg *config.Config) *Server {
        return &Server{cfg: cfg}
    }

    func (s *Server) Start() error {
        mux := http.NewServeMux()

        userHandler := handler.NewUserHandler()
        mux.HandleFunc("/users", userHandler.List)
        mux.HandleFunc("/users/", userHandler.GetByID)

        addr := fmt.Sprintf(":%d", s.cfg.Port)
        return http.ListenAndServe(addr, mux)
    }
    ```

    ```go
    // File: internal/handler/user.go
    package handler

    import (
        "encoding/json"
        "net/http"
        "strings"
    )

    type UserHandler struct{}

    func NewUserHandler() *UserHandler {
        return &UserHandler{}
    }

    func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
        json.NewEncoder(w).Encode([]map[string]string{
            {"id": "1", "name": "Alice"},
            {"id": "2", "name": "Bob"},
        })
    }

    func (h *UserHandler) GetByID(w http.ResponseWriter, r *http.Request) {
        id := strings.TrimPrefix(r.URL.Path, "/users/")
        json.NewEncoder(w).Encode(map[string]string{
            "id":   id,
            "name": "Alice",
        })
    }
    ```

=== "The Terminal Output"

    ```bash
    $ go run cmd/server/main.go
    Listening on :8080

    $ curl http://localhost:8080/users
    [{"id":"1","name":"Alice"},{"id":"2","name":"Bob"}]

    $ curl http://localhost:8080/users/1
    {"id":"1","name":"Alice"}
    ```

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Solution |
|-------------|---------|----------|
| Everything in `package main` | Cannot import or test individual packages | Split into `internal/` packages |
| Flat structure | Hard to navigate large codebases | Use `cmd/`, `internal/`, `pkg/` |
| `util` or `common` packages | Catch-all bags that grow uncontrollably | Create focused packages with clear purpose |
| Circular imports | Compilation error; design smell | Extract shared types to a separate package |
| God packages | One package doing everything | Split by concern (handler, service, repo) |
| Exporting everything | API surface becomes unmanageable | Only export what consumers need |

---

## Best Practices

| Practice | Recommendation |
|----------|---------------|
| **Start simple** | Begin with `cmd/` and `internal/`; add `pkg/` only if needed |
| **One binary per cmd/** | Each `cmd/` directory produces one binary |
| **internal/ for private** | All business logic goes in `internal/` |
| **pkg/ only when needed** | Only create `pkg/` if you have public, reusable code |
| **Flat internal/** | Don't over-nest; keep packages shallow |
| **Small packages** | Aim for focused packages with 1-5 files |
| **Package naming** | Single word, lowercase, no underscores |
| **Import grouping** | Stdlib → External → Internal (use `goimports`) |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `import cycle detected` | Extract shared types to a separate package |
| `cannot refer to unexported` | Make the identifier uppercase or add an exported accessor |
| `package not found` | Check import path matches module path in `go.mod` |
| `undefined: main` | Ensure `cmd/*/main.go` has `package main` and `func main()` |
| Tests cannot access internals | Place test files in the same package, or use `internal/` tests |
| `goimports` not grouping correctly | Install `goimports`: `go install golang.org/x/tools/cmd/goimports@latest` |
| Circular dependency between packages | Create a third package for shared types |

## Summary

- Follow the standard layout: `cmd/`, `internal/`, `pkg/`
- `cmd/` holds entry points; `internal/` holds private logic; `pkg/` holds public libraries
- Package names should be short, lowercase, and single-word
- Import paths must match your module path
- Start with a monorepo unless you have a specific reason for multi-module
- Use `goimports` to format imports automatically

## Next Steps

- [Basic Syntax & Types](basic-syntax.md) — Learn Go's type system in depth
- [IDE Setup & Tooling](ide-setup.md) — Configure your editor for the standard layout
