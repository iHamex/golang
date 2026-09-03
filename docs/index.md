# Go Book

This is an advanced, production-focused Go handbook for developers who want to move from "can build features" to "can design and lead systems". Go powers some of the most demanding distributed systems in the world — from Kubernetes to Docker to Terraform — and this book will take you from foundational concepts to architecting production-grade services that scale.

Whether you are building REST APIs, gRPC microservices, CLI tools, or concurrent data pipelines, this guide provides battle-tested patterns, real-world examples, and the depth you need to write Go that performs under pressure.

## About This Book

This book is structured to take you from zero knowledge of Go to designing production systems. Each chapter builds on the previous one, but you can also jump to any chapter if you already have experience. Every code example is complete, runnable, and follows Go community conventions.

!!! go "Go Version Requirement"

    All examples in this book target **Go 1.22+**. If you are running an older version, some features such as enhanced `for` loop variable scoping, improved `net/http` routing patterns, and newer standard library additions may not be available. Always use the latest stable Go release.

## What You Will Learn

- Design and implement concurrent systems using goroutines, channels, and sync primitives
- Build production-ready HTTP servers with proper middleware, routing, and graceful shutdown
- Implement robust data layers with SQL, caching, and repository patterns
- Apply security best practices including authentication, authorization, and secrets management
- Structure large Go codebases for maintainability and team collaboration
- Write idiomatic Go code that follows community conventions and effective patterns
- Deploy, monitor, and troubleshoot Go services in production environments

## Who This Is For

This book is designed for:

- **Go developers shipping production code** who want to deepen their understanding of the language and its ecosystem
- **Team leads and architects** designing distributed systems who need a reference for Go-specific patterns
- **Engineers preparing for high-traffic systems** where performance, concurrency, and reliability are non-negotiable
- **Backend developers transitioning to Go** who already understand programming fundamentals and want to master Go's unique approach

!!! go "Baseline for this book"

    This book targets **Go 1.22+** exclusively. All code examples, standard library usage, and language features assume you are running Go 1.22 or later. Features introduced in earlier versions are not covered unless they remain relevant to modern Go development.

## What You Will Build Mastery In

| Domain | Topics Covered | Real-World Application |
|--------|---------------|----------------------|
| **Concurrency** | Goroutines, channels, select, sync primitives, context, worker pools | Web servers handling thousands of concurrent requests |
| **Web APIs** | net/http, chi, gin, middleware, routing, graceful shutdown | RESTful APIs, gRPC services, WebSocket servers |
| **Data Layer** | database/sql, pgx, sqlx, migrations, repositories | CRUD operations, complex queries, connection pooling |
| **Security** | TLS, authentication, authorization, secrets, input validation | OAuth2, JWT, API key management, CORS |
| **Operations** | Logging, metrics, tracing, profiling, health checks | Production monitoring, debugging, performance tuning |

## Recommended Learning Tracks

Choose the track that matches your current experience and goals:

### Track 1: Go Foundations (2-3 weeks)

For developers new to Go or wanting to solidify fundamentals.

1. [Setup & Installation](getting-started/setup-installation.md)
2. [Your First Program](getting-started/first-program.md)
3. [Go Modules & Dependencies](getting-started/go-modules.md)
4. [Project Structure](getting-started/project-structure.md)
5. [Basic Syntax & Types](getting-started/basic-syntax.md)
6. [IDE Setup & Tooling](getting-started/ide-setup.md)

### Track 2: Production APIs (3-4 weeks)

For developers building web services and APIs.

1. [HTTP Servers](basics/http-servers.md)
2. [Middleware Patterns](advanced/middleware-hooks.md)
3. [Request Handling](basics/http-servers.md)
4. [Error Handling](basics/error-handling.md)
5. [Graceful Shutdown](basics/http-servers.md)

### Track 3: Concurrency Mastery (2-3 weeks)

For developers building concurrent and parallel systems.

1. [Goroutines](architecture/goroutines-scheduler.md)
2. [Channels](architecture/channels-select.md)
3. [Sync Primitives](utilities/sync-primitives.md)
4. [Worker Pools](advanced/concurrency-patterns.md)
5. [Context & Cancellation](utilities/context-cancellation.md)

### Track 4: Production Ready (4-5 weeks)

For developers deploying and operating Go services.

1. [Logging](advanced/logging-observability.md)
2. [Metrics & Tracing](production/observability.md)
3. [Testing](basics/testing.md)
4. [Benchmarks](production/performance.md)
5. [Deployment](production/deployment.md)

## Core Go Direction

Go's design philosophy emphasizes simplicity, performance, and developer productivity. This book aligns with these principles:

| Principle | How This Book Applies It |
|-----------|------------------------|
| **Simplicity** | Examples use the standard library first; external dependencies are added only when they provide clear value |
| **Performance** | Every concurrency pattern and data structure choice is justified with benchmarks and analysis |
| **Reliability** | Production patterns include error handling, graceful degradation, and operational visibility |
| **Maintainability** | Project structures follow community conventions; code is self-documenting through clear naming |
| **Testing** | Every example includes test patterns; benchmarks demonstrate performance characteristics |

## How to Run the Examples

All examples in this book are complete, runnable Go programs. You can copy, paste, and execute them directly.

=== "Running a Single File"

    ```bash
    # Run a Go file directly (compiles and executes)
    $ go run main.go

    # Run with arguments
    $ go run main.go --port=8080

    # Run a package (all .go files in the directory)
    $ go run .
    ```

=== "Building a Binary"

    ```bash
    # Build for current platform
    $ go build -o myapp

    # Build with version info
    $ go build -ldflags "-X main.version=1.0.0" -o myapp

    # Cross-compile for Linux from macOS
    $ GOOS=linux GOARCH=amd64 go build -o myapp-linux
    ```

=== "Running Tests"

    ```bash
    # Run all tests in current directory
    $ go test ./...

    # Run tests with verbose output
    $ go test -v ./...

    # Run tests with race detector
    $ go test -race ./...

    # Run specific test
    $ go test -run TestGetName ./pkg/user/
    ```

=== "Using go generate"

    ```bash
    # Run all generate directives in the project
    $ go generate ./...

    # Generate mocks for a specific package
    $ go generate ./internal/service/...
    ```

## Standards Used In This Book

This book follows these coding standards and conventions:

- **Formatting**: All code is formatted with `gofmt` and `goimports`
- **Linting**: Examples pass `staticcheck` and `golangci-lint` with default configurations
- **Error handling**: Errors are always checked and wrapped with context
- **Naming**: Package names are short, lowercase, single-word; exported names use CamelCase
- **Comments**: Package-level comments explain purpose; function comments document behavior
- **Testing**: Table-driven tests are preferred; benchmarks are included where performance matters

!!! note "Code Style"

    All code examples follow the Go Code Review Comments and Effective Go guidelines. When you see patterns in this book, they represent community-accepted idioms, not personal preferences.

## Book Conventions

Throughout this book, you will encounter these conventions:

- **File paths** are shown as `cmd/server/main.go` to indicate location within a project
- **Terminal commands** are prefixed with `$` to indicate a shell prompt
- **Bold text** indicates important terms, function names, or key concepts
- **Code blocks** use the `===` tabbed format to show code, explanation, and output
- **Admonitions** provide tips, warnings, and Go-specific notes in colored callouts
- **Tables** provide quick reference for commands, options, and comparisons

=== "Admonition Types"

    | Admonition | Usage |
    |------------|-------|
    | `!!! go "Title"` | Go-specific tips and version features |
    | `!!! note "Title"` | General important information |
    | `!!! tip "Title"` | Helpful suggestions and best practices |
    | `!!! warning "Title"` | Potential issues to watch out for |
    | `!!! danger "Title"` | Critical mistakes that can cause bugs or data loss |
    | `!!! abstract "Title"` | Conceptual explanations and background |

## Contributing to This Book

This book is open source and welcomes contributions. If you find errors, have suggestions, or want to add content:

1. Open an issue describing the change
2. Submit a pull request with the proposed modification
3. Follow the existing style and formatting conventions
4. Include runnable code examples where applicable

!!! tip "Feedback Welcome"

    If you find a section unclear or want more detail on a topic, please open an issue. Your feedback helps improve the book for everyone.

## Prerequisites

Before starting this book, you should have:

- **Programming experience** in at least one language (Python, Java, JavaScript, C, etc.)
- **Command-line familiarity** — comfortable navigating directories, running commands, and editing files in a terminal
- **HTTP fundamentals** — understand request/response cycles, status codes, and headers
- **Basic data structures** — arrays, maps, and the concept of linked lists or trees
- **Git basics** — cloning repos, committing, branching (most examples include a Git repository)

!!! tip "No Go Experience Required"

    If you have never written Go, start with [Setup & Installation](getting-started/setup-installation.md) and work through the Getting Started track sequentially. Each chapter builds on the previous one.

## Start Here

New to this book? Start with the chapter that matches your goal:

- **I want to install Go**: [Setup & Installation](getting-started/setup-installation.md)
- **I want to write my first program**: [Your First Program](getting-started/first-program.md)
- **I want to understand Go modules**: [Go Modules & Dependencies](getting-started/go-modules.md)
- **I want to organize my project**: [Project Structure](getting-started/project-structure.md)
- **I want to learn Go syntax**: [Basic Syntax & Types](getting-started/basic-syntax.md)
- **I want to set up my editor**: [IDE Setup & Tooling](getting-started/ide-setup.md)

## Why Go?

Go was created at Google to solve real engineering problems. Here is why it excels in production:

| Advantage | Description |
|-----------|-------------|
| **Simple syntax** | Go has a small language specification. New team members become productive in days, not weeks. |
| **Fast compilation** | Large projects compile in seconds. No waiting for build systems. |
| **Concurrency built-in** | Goroutines and channels make concurrent programming accessible and safe. |
| **Static binaries** | Deploy a single binary. No runtime dependencies, no version conflicts. |
| **Standard library** | The standard library covers HTTP, JSON, testing, and more. Fewer external dependencies. |
| **Garbage collected** | No manual memory management. Go's GC is optimized for low-latency. |
| **Cross-compilation** | Build for any OS/Architecture from any development machine. |
| **Tooling** | `go fmt`, `go vet`, `go test` — consistent, universal tooling. |

## How This Book Is Organized

The book is divided into sections that progress from fundamentals to production-grade topics:

=== "Getting Started (Beginner)"

    | Chapter | Description |
    |---------|-------------|
    | [Setup & Installation](getting-started/setup-installation.md) | Install Go, understand GOPATH, verify your environment |
    | [Your First Program](getting-started/first-program.md) | Hello World, compile vs run, first test |
    | [Go Modules & Dependencies](getting-started/go-modules.md) | Module system, go.mod, dependency management |
    | [Project Structure](getting-started/project-structure.md) | Standard layout, cmd/internal/pkg, conventions |
    | [Basic Syntax & Types](getting-started/basic-syntax.md) | Variables, types, slices, maps, constants |
    | [IDE Setup & Tooling](getting-started/ide-setup.md) | VS Code, GoLand, linters, debugger |

=== "Web Development (Intermediate)"

    | Chapter | Description |
    |---------|-------------|
    | HTTP Servers | Building production-ready servers with net/http |
    | Middleware Patterns | Authentication, logging, CORS, rate limiting |
    | Request Handling | Routing, parameter parsing, validation |
    | Error Handling | Structured errors, error wrapping, sentinel errors |
    | Graceful Shutdown | Signal handling, connection draining |

=== "Concurrency (Intermediate-Advanced)"

    | Chapter | Description |
    |---------|-------------|
    | Goroutines | Lightweight threads, when and how to use them |
    | Channels | Communication between goroutines, buffered/unbuffered |
    | Sync Primitives | Mutex, WaitGroup, Once, Pool |
    | Worker Pools | Pattern for concurrent task processing |
    | Context & Cancellation | Propagating deadlines and cancellation |

=== "Production (Advanced)"

    | Chapter | Description |
    |---------|-------------|
    | Logging | Structured logging with slog |
    | Metrics & Tracing | OpenTelemetry, Prometheus, distributed tracing |
    | Testing | Unit tests, integration tests, table-driven tests |
    | Benchmarks | Performance measurement and optimization |
    | Deployment | Docker, Kubernetes, CI/CD pipelines |

## What You Will Build

Throughout this book, you will build real, working systems:

1. **A REST API** — Complete CRUD operations with authentication, validation, and error handling
2. **A concurrent web scraper** — Demonstrating goroutines, channels, and worker pools
3. **A CLI tool** — Using cobra for argument parsing, configuration management, and proper logging
4. **A database-backed service** — Repository pattern, migrations, connection pooling
5. **A production microservice** — Health checks, metrics, graceful shutdown, Docker deployment

!!! note "Code Philosophy"

    Every example in this book is production-quality code. We do not use placeholder implementations or skip error handling. The code you copy from this book should work in a real system.

## Start Here

New to this book? Start with the chapter that matches your goal:

- **I want to install Go**: [Setup & Installation](getting-started/setup-installation.md)
- **I want to write my first program**: [Your First Program](getting-started/first-program.md)
- **I want to understand Go modules**: [Go Modules & Dependencies](getting-started/go-modules.md)
- **I want to organize my project**: [Project Structure](getting-started/project-structure.md)
- **I want to learn Go syntax**: [Basic Syntax & Types](getting-started/basic-syntax.md)
- **I want to set up my editor**: [IDE Setup & Tooling](getting-started/ide-setup.md)

!!! go "Go 1.22+ Feature"

    This book uses features introduced in Go 1.22 such as enhanced routing patterns in `net/http`, improved `for` loop variable scoping, and the new `http.ServeMux` capabilities. If you are using an older version, some examples may not compile as written.
