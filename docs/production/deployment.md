# Deployment

Deploying Go applications to production requires understanding how to build optimized binaries, containerize effectively, and ensure your services run reliably. Go's static compilation and small binary sizes make it ideal for production deployments across diverse environments.

## What You Will Learn

- How to build optimized Go binaries for different platforms
- Creating minimal Docker images with scratch and distroless base images
- Multi-stage Docker builds for production
- Deploying as binary, Docker container, or Kubernetes pod
- Running Go services with systemd
- Implementing graceful shutdown and signal handling
- Configuring production health checks

## Prerequisites

- Familiarity with [Go modules](/docs/fundamentals/modules.md)
- Understanding of [concurrency patterns](/docs/fundamentals/concurrency.md)
- Basic knowledge of Docker and container concepts
- Access to a Linux server or cloud environment for deployment

---

## Building Binaries

Go compiles to a single static binary with no external dependencies. The `go build` command is your primary tool for creating production-ready executables.

### Basic Build

=== "The Code"

    ```go
    // main.go
    package main

    import (
        "fmt"
        "os"
    )

    func main() {
        fmt.Fprintf(os.Stdout, "Application started\n")
    }
    ```

=== "The Explanation"

    - **`go build`**: Compiles the package in the current directory into an executable binary
    - **`-ldflags`**: Passes flags to the linker for embedding build information
    - **`-trimpath`**: Removes file system paths from the binary for reproducibility
    - **`-race`**: Enables race condition detection (use only for testing)

=== "The Terminal Output"

    ```
    $ go build -o myapp main.go
    $ ls -lh myapp
    -rwxr-xr-x  1 user  staff   12M  Sep  3 10:00 myapp
    ```

### Cross-Compilation

Go's toolchain supports cross-compilation via `GOOS` and `GOARCH` environment variables, allowing you to target any supported platform from any development machine.

=== "The Code"

    ```bash
    # Build for Linux AMD64
    GOOS=linux GOARCH=amd64 go build -o myapp-linux-amd64

    # Build for Linux ARM64 (e.g., AWS Graviton)
    GOOS=linux GOARCH=arm64 go build -o myapp-linux-arm64

    # Build for macOS ARM64 (Apple Silicon)
    GOOS=darwin GOARCH=arm64 go build -o myapp-darwin-arm64

    # Build for Windows AMD64
    GOOS=windows GOARCH=amd64 go build -o myapp.exe
    ```

=== "The Explanation"

    - **`GOOS`**: Target operating system — `linux`, `darwin`, `windows`, `freebsd`
    - **`GOARCH`**: Target architecture — `amd64`, `arm64`, `arm`, `386`
    - **Static binary**: Go produces self-contained executables with no runtime dependencies
    - **`CGO_ENABLED=0`**: Disables CGo for fully static binaries (required for scratch images)

=== "The Terminal Output"

    ```
    $ GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o myapp
    $ file myapp
    myapp: ELF 64-bit LSB executable, x86-64, statically linked
    ```

!!! go "CGO_ENABLED and Static Binaries"

    When building for scratch or distroless Docker images, you must set `CGO_ENABLED=0` to produce a fully static binary. Dynamic linking against glibc will fail in minimal base images that do not include shared libraries.

### Embedding Version Information

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
        "runtime"
    )

    var (
        version   = "dev"
        commit    = "none"
        buildDate = "unknown"
    )

    func main() {
        if len(os.Args) > 1 && os.Args[1] == "version" {
            fmt.Printf("Version:    %s\n", version)
            fmt.Printf("Commit:     %s\n", commit)
            fmt.Printf("Built:      %s\n", buildDate)
            fmt.Printf("Go Version: %s\n", runtime.Version())
            fmt.Printf("OS/Arch:    %s/%s\n", runtime.GOOS, runtime.GOARCH)
            return
        }
        fmt.Println("Application running...")
    }
    ```

=== "The Explanation"

    - **`-ldflags`**: Injects values at build time via linker flags
    - **`-X main.version`**: Overwrites the `version` variable with the provided string
    - **`runtime.Version()`**: Returns the Go version used to compile the binary
    - **`runtime.GOOS`**: Reports the target OS and architecture at runtime

=== "The Terminal Output"

    ```bash
    $ go build -ldflags "-X main.version=1.2.3 -X main.commit=$(git rev-parse --short HEAD) -X main.buildDate=$(date -u +%Y-%m-%dT%H:%M:%SZ)" -o myapp

    $ ./myapp version
    Version:    1.2.3
    Commit:     a1b2c3d
    Built:      2026-09-03T10:00:00Z
    Go Version: go1.22.5
    OS/Arch:    linux/amd64
    ```

---

## Docker Images

### Scratch vs Distroless

Choosing the right base image affects security, image size, and debugging capability.

| Feature | scratch | distroless | alpine |
|---|---|---|---|
| **Image size** | ~0 MB (binary only) | ~20 MB | ~7 MB |
| **Shell access** | No | No | Yes |
| **CA certificates** | No (must copy) | Yes | Yes |
| **Time zone data** | No (must copy) | Yes | Yes |
| **Debugging** | Very difficult | Difficult | Easy |
| **Security** | Maximum | High | Moderate |
| **Use case** | Simple static binaries | Production with TLS | Development |

!!! warning "scratch Limitations"

    The `scratch` image contains nothing — no shell, no CA certificates, no timezone data. You must explicitly copy any files your binary needs at runtime.

=== "The Code"

    ```dockerfile
    # Dockerfile.scratch
    FROM golang:1.22-alpine AS builder

    WORKDIR /app
    COPY go.mod go.sum ./
    RUN go mod download

    COPY . .
    RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server .

    FROM scratch

    COPY --from=builder /app/server /server
    COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

    EXPOSE 8080
    ENTRYPOINT ["/server"]
    ```

=== "The Explanation"

    - **`golang:1.22-alpine`**: Build stage using a lightweight Go image
    - **`CGO_ENABLED=0`**: Produces a fully static binary compatible with scratch
    - **`-ldflags="-s -w"`**: Strips debug information and symbol tables to reduce binary size
    - **`COPY ca-certificates.crt`**: Required for TLS connections to external services
    - **`ENTRYPOINT`**: Executes the binary directly without a shell

=== "The Terminal Output"

    ```
    $ docker build -f Dockerfile.scratch -t myapp:scratch .
    $ docker images myapp:scratch
    REPOSITORY   TAG      IMAGE ID       CREATED         SIZE
    myapp        scratch  abc123def456   5 seconds ago   14MB
    ```

### Multi-Stage Builds

Multi-stage builds keep build tools out of your production image, reducing attack surface and image size.

=== "The Code"

    ```dockerfile
    # Dockerfile.multistage
    FROM golang:1.22-bookworm AS deps

    WORKDIR /app
    COPY go.mod go.sum ./
    RUN go mod download && go mod verify

    FROM deps AS builder

    COPY . .
    ARG VERSION=dev
    ARG COMMIT=none
    RUN CGO_ENABLED=0 GOOS=linux go build \
        -ldflags="-s -w -X main.version=${VERSION} -X main.commit=${COMMIT}" \
        -o /app/server .

    FROM gcr.io/distroless/static-debian12

    COPY --from=builder /app/server /server

    EXPOSE 8080
    USER nonroot:nonroot
    ENTRYPOINT ["/server"]
    ```

=== "The Explanation"

    - **Three stages**: `deps` for dependency download, `builder` for compilation, final for runtime
    - **`go mod verify`**: Ensures downloaded modules match expected checksums
    - **`ARG VERSION`**: Build arguments passed at `docker build --build-arg VERSION=1.2.3`
    - **`USER nonroot:nonroot`**: Runs the container as a non-root user for security
    - **`distroless/static`**: Minimal image with CA certs and timezone data, no shell

=== "The Terminal Output"

    ```bash
    $ docker build \
        --build-arg VERSION=1.2.3 \
        --build-arg COMMIT=a1b2c3d \
        -t myapp:1.2.3 .
    Successfully built abc123def456
    Successfully tagged myapp:1.2.3

    $ docker run -p 8080:8080 myapp:1.2.3
    Application running...
    ```

---

## Deployment Targets

### Binary Deployment

The simplest deployment is copying the binary to a server and running it directly.

=== "The Code"

    ```bash
    # Build for target
    GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build \
        -ldflags="-s -w" -o server

    # Deploy to remote server
    scp server user@prod-server:/opt/myapp/server

    # Start on remote
    ssh user@prod-server '/opt/myapp/server &'
    ```

=== "The Explanation"

    - **`scp`**: Securely copies the binary over SSH
    - **Binary deployment**: No runtime dependencies, instant startup
    - **Trade-off**: No process management, no automatic restarts

### Docker Deployment

=== "The Code"

    ```bash
    # Build and tag
    docker build -t registry.example.com/myapp:1.2.3 .

    # Push to registry
    docker push registry.example.com/myapp:1.2.3

    # Run container
    docker run -d \
        --name myapp \
        -p 8080:8080 \
        -e LOG_LEVEL=info \
        registry.example.com/myapp:1.2.3
    ```

=== "The Explanation"

    - **Container registry**: Store and distribute images across environments
    - **Tagging strategy**: Use semantic versions for production releases
    - **Environment variables**: Pass configuration without rebuilding

### Kubernetes Deployment

=== "The Code"

    ```yaml
    # k8s-deployment.yaml
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: myapp
      labels:
        app: myapp
    spec:
      replicas: 3
      selector:
        matchLabels:
          app: myapp
      template:
        metadata:
          labels:
            app: myapp
        spec:
          containers:
          - name: myapp
            image: registry.example.com/myapp:1.2.3
            ports:
            - containerPort: 8080
            env:
            - name: LOG_LEVEL
              value: "info"
            resources:
              requests:
                memory: "64Mi"
                cpu: "100m"
              limits:
                memory: "128Mi"
                cpu: "500m"
            livenessProbe:
              httpGet:
                path: /healthz
                port: 8080
              initialDelaySeconds: 5
              periodSeconds: 10
            readinessProbe:
              httpGet:
                path: /ready
                port: 8080
              initialDelaySeconds: 3
              periodSeconds: 5
    ```

=== "The Explanation"

    - **`replicas: 3`**: Runs three instances for high availability
    - **`resources`**: Prevents unbounded resource consumption
    - **`livenessProbe`**: Restarts the container if the application becomes unresponsive
    - **`readinessProbe`**: Removes the pod from service until it is ready to accept traffic

---

## Systemd Services

Running Go binaries as systemd services provides automatic restarts, dependency management, and logging integration.

=== "The Code"

    ```ini
    # /etc/systemd/system/myapp.service
    [Unit]
    Description=My Go Application
    After=network.target
    Wants=network-online.target

    [Service]
    Type=simple
    User=myapp
    Group=myapp
    WorkingDirectory=/opt/myapp
    ExecStart=/opt/myapp/server
    Restart=always
    RestartSec=5
    KillMode=mixed
    KillSignal=SIGTERM
    TimeoutStopSec=30

    Environment=LOG_LEVEL=info
    Environment=PORT=8080

    NoNewPrivileges=yes
    ProtectSystem=strict
    ProtectHome=yes
    ReadOnlyPaths=/opt/myapp/config

    [Install]
    WantedBy=multi-user.target
    ```

=== "The Explanation"

    - **`Restart=always`**: Automatically restarts the process on failure
    - **`KillMode=mixed`**: Sends SIGTERM to the main process, then SIGKILL to remaining
    - **`NoNewPrivileges`**: Prevents the process from gaining new privileges
    - **`ProtectSystem=strict`**: Mounts `/usr` and `/boot` as read-only

=== "The Terminal Output"

    ```bash
    $ sudo systemctl daemon-reload
    $ sudo systemctl enable myapp
    $ sudo systemctl start myapp
    $ sudo systemctl status myapp
    ● myapp.service - My Go Application
         Loaded: loaded (/etc/systemd/system/myapp.service; enabled)
         Active: active (running) since Wed 2026-09-03 10:00:00 UTC
       Main PID: 12345 (server)
         Memory: 12.3M
            CPU: 1.234s
         CGroup: /system.slice/myapp.service
                 └─12345 /opt/myapp/server
    ```

---

## Graceful Shutdown

Properly handling shutdown signals ensures in-flight requests complete and resources are released cleanly.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "log"
        "net/http"
        "os"
        "os/signal"
        "syscall"
        "time"
    )

    func main() {
        mux := http.NewServeMux()
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "OK")
        })

        srv := &http.Server{
            Addr:         ":8080",
            Handler:      mux,
            ReadTimeout:  10 * time.Second,
            WriteTimeout: 10 * time.Second,
            IdleTimeout:  60 * time.Second,
        }

        go func() {
            log.Printf("Starting server on %s", srv.Addr)
            if err := srv.ListenAndServe(); err != http.ErrServerClosed {
                log.Fatalf("Server error: %v", err)
            }
        }()

        quit := make(chan os.Signal, 1)
        signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
        sig := <-quit
        log.Printf("Received signal %s, shutting down gracefully...", sig)

        ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
        defer cancel()

        if err := srv.Shutdown(ctx); err != nil {
            log.Fatalf("Forced shutdown: %v", err)
        }
        log.Println("Server stopped")
    }
    ```

=== "The Explanation"

    - **`signal.Notify(quit, ...)`**: Listens for OS signals on the provided channel
    - **`SIGTERM`**: Default termination signal from Docker, Kubernetes, and systemd
    - **`SIGINT`**: Interrupt signal (Ctrl+C) for local development
    - **`srv.Shutdown(ctx)`**: Stops accepting new connections and waits for in-flight requests
    - **`context.WithTimeout`**: Ensures shutdown completes within 30 seconds

=== "The Terminal Output"

    ```
    2026/09/03 10:00:00 Starting server on :8080
    2026/09/03 10:05:30 Received signal terminated, shutting down gracefully...
    2026/09/03 10:05:31 Server stopped
    ```

---

## Signal Handling Patterns

=== "The Code"

    ```go
    package main

    import (
        "context"
        "log"
        "os/signal"
        "syscall"
        "time"
    )

    func main() {
        ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
        defer stop()

        cleanup := make(chan struct{})
        go func() {
            <-ctx.Done()
            log.Println("Shutting down...")

            time.Sleep(5 * time.Second)
            log.Println("Cleanup complete")
            close(cleanup)
        }()

        log.Println("Running. Press Ctrl+C to stop.")
        select {
        case <-cleanup:
            log.Println("Graceful exit")
        case <-time.After(60 * time.Second):
            log.Println("Timeout, exiting")
        }
    }
    ```

=== "The Explanation"

    - **`signal.NotifyContext`**: Returns a context cancelled when a signal is received
    - **`defer stop`**: Restores the default signal handling after function returns
    - **Cleanup channel**: Coordinates shutdown between goroutines
    - **Timeout fallback**: Ensures the process exits even if cleanup hangs

### Signal Reference

| Signal | Default Action | Typical Use |
|---|---|---|
| `SIGINT` | Terminate | Ctrl+C in terminal |
| `SIGTERM` | Terminate | Docker stop, Kubernetes |
| `SIGHUP` | Restart | Reload configuration |
| `SIGUSR1` | User-defined | Custom behavior |
| `SIGKILL` | Kill (cannot catch) | Force kill |

---

## Health Checks

### HTTP Health Endpoint

=== "The Code"

    ```go
    package main

    import (
        "database/sql"
        "encoding/json"
        "log"
        "net/http"
        "sync"
        "time"
    )

    type HealthStatus struct {
        Status  string            `json:"status"`
        Checks  map[string]string `json:"checks"`
        Uptime  string            `json:"uptime"`
    }

    var (
        startTime = time.Now()
        db        *sql.DB
        mu        sync.RWMutex
        healthy   = true
    )

    func healthHandler(w http.ResponseWriter, r *http.Request) {
        mu.RLock()
        defer mu.RUnlock()

        checks := make(map[string]string)

        if err := db.Ping(); err != nil {
            checks["database"] = "unhealthy: " + err.Error()
        } else {
            checks["database"] = "healthy"
        }

        status := "healthy"
        if !healthy || len(checks) > 0 {
            for _, v := range checks {
                if v != "healthy" {
                    status = "unhealthy"
                    break
                }
            }
        }

        resp := HealthStatus{
            Status: status,
            Checks: checks,
            Uptime: time.Since(startTime).Round(time.Second).String(),
        }

        code := http.StatusOK
        if status != "healthy" {
            code = http.StatusServiceUnavailable
        }

        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(code)
        json.NewEncoder(w).Encode(resp)
    }

    func main() {
        http.HandleFunc("/healthz", healthHandler)
        log.Fatal(http.ListenAndServe(":8080", nil))
    }
    ```

=== "The Explanation"

    - **`/healthz`**: Kubernetes-style health endpoint
    - **`db.Ping`**: Verifies database connectivity
    - **`sync.RWMutex`**: Protects concurrent access to health state
    - **HTTP 200 vs 503**: Signals readiness to load balancers and orchestrators

=== "The Terminal Output"

    ```bash
    $ curl -s http://localhost:8080/healthz | jq .
    {
      "status": "healthy",
      "checks": {
        "database": "healthy"
      },
      "uptime": "2h30m15s"
    }
    ```

---

## Best Practices

| Practice | Description | Priority |
|---|---|---|
| Use `CGO_ENABLED=0` | Produce static binaries for container images | High |
| Strip binaries | Use `-ldflags="-s -w"` to reduce binary size | Medium |
| Embed version info | Inject build metadata with `-ldflags -X` | High |
| Multi-stage builds | Keep build tools out of production images | High |
| Non-root user | Run containers as non-root with `USER nonroot` | Critical |
| Graceful shutdown | Handle `SIGTERM` and drain in-flight requests | Critical |
| Health checks | Expose liveness and readiness endpoints | High |
| Signal handling | Use `signal.NotifyContext` for clean shutdown | High |

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Binary won't run in scratch | Dynamically linked | Set `CGO_ENABLED=0` |
| TLS errors in scratch | Missing CA certificates | Copy `/etc/ssl/certs/ca-certificates.crt` |
| Container immediately exits | No `ENTRYPOINT` or wrong path | Verify `ENTRYPOINT` and file permissions |
| Graceful shutdown hangs | Missing context timeout | Add `context.WithTimeout` to shutdown |
| Health check returns 503 | Dependency unavailable | Check database, cache, or upstream health |
| systemd won't start service | Missing `daemon-reload` | Run `systemctl daemon-reload` |

## Summary

- Go produces single static binaries ideal for deployment across any environment
- Cross-compilation with `GOOS`/`GOARCH` enables targeting any platform from any machine
- Scratch and distroless images minimize attack surface and image size
- Multi-stage Docker builds separate build dependencies from runtime
- Graceful shutdown with signal handling ensures clean resource release
- Health check endpoints enable orchestrators to manage traffic routing
- Systemd provides process management for bare-metal deployments

## Next Steps

- [Containerization](/docs/production/containerization.md) — Dockerfile best practices and security
- [CI/CD](/docs/production/ci-cd.md) — Automated build and deployment pipelines
- [Resilience](/docs/production/resilience.md) — Building fault-tolerant production services
- [Observability](/docs/production/observability.md) — Monitoring and logging in production
