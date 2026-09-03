# Containerization

Containers provide consistent, reproducible environments for Go applications. Building optimized Docker images reduces attack surface, improves deployment speed, and ensures parity between development and production.

## What You Will Learn

- Writing efficient Dockerfiles for Go applications
- Multi-stage builds to minimize image size
- Choosing between scratch and distroless base images
- Running containers as non-root users
- Handling signals and graceful shutdown in containers
- Optimizing Docker layers for faster builds
- Configuring docker-compose for local development
- Using .dockerignore to exclude unnecessary files
- Implementing container health checks
- Scanning images for security vulnerabilities

## Prerequisites

- Familiarity with [deployment basics](/docs/production/deployment.md)
- Basic Docker knowledge (images, containers, layers)
- Understanding of Go binary compilation

---

## Dockerfile Best Practices

=== "The Code"

    ```dockerfile
    # Dockerfile
    FROM golang:1.22-alpine AS builder

    WORKDIR /app

    COPY go.mod go.sum ./
    RUN go mod download && go mod verify

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

    - **`golang:1.22-alpine`**: Lightweight build stage based on Alpine Linux
    - **`go mod download`**: Cached separately from source to leverage Docker layer caching
    - **`-ldflags="-s -w"`**: Strips debug symbols, reducing binary size by 20-30%
    - **`distroless/static`**: Minimal runtime image with no shell or package manager
    - **`USER nonroot:nonroot`**: Prevents running as root inside the container

=== "The Terminal Output"

    ```bash
    $ docker build -t myapp:latest .
    $ docker images myapp
    REPOSITORY   TAG      IMAGE ID       CREATED          SIZE
    myapp        latest   abc123def456   10 seconds ago   8.2MB
    ```

### Layer Optimization

=== "The Code"

    ```dockerfile
    # BAD: Every change invalidates the cache
    FROM golang:1.22-alpine
    COPY . .
    RUN go mod download
    RUN CGO_ENABLED=0 go build -o server .

    # GOOD: Order by change frequency
    FROM golang:1.22-alpine AS builder
    WORKDIR /app
    COPY go.mod go.sum ./          # Rarely changes
    RUN go mod download            # Cached
    COPY . .                       # Changes frequently
    RUN CGO_ENABLED=0 go build -o server .
    ```

=== "The Explanation"

    - **Layer ordering**: Docker caches layers and reuses them when the source hasn't changed
    - **Dependency layer**: `go.mod` and `go.sum` change infrequently, so this layer is cached
    - **Source layer**: Only invalidated when source files change
    - **Build verification**: `go mod verify` ensures downloaded dependencies match checksums

---

## Scratch vs Distroless

| Feature | scratch | distroless/static | distroless/base |
|---|---|---|---|
| **Base size** | 0 bytes | ~2 MB | ~20 MB |
| **Shell** | No | No | No |
| **CA certificates** | No | Yes | Yes |
| **Timezone data** | No | Yes | Yes |
| **libc** | No | No | Yes (glibc) |
| **Debugging** | Impossible | Difficult | Difficult |
| **Security** | Maximum | High | Moderate |
| **Use case** | Pure static binaries | Most Go apps | CGo-dependent apps |

!!! danger "scratch Limitations"

    The `scratch` image has no CA certificates, timezone data, or any system files. You must copy everything your binary needs. If your application makes HTTPS calls, you must copy CA certificates.

=== "The Code"

    ```dockerfile
    FROM golang:1.22-alpine AS builder
    WORKDIR /app
    COPY . .
    RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o server .

    FROM scratch
    COPY --from=builder /app/server /server
    COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
    COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

    EXPOSE 8080
    ENTRYPOINT ["/server"]
    ```

=== "The Explanation"

    - **CA certificates**: Required for HTTPS connections to external services
    - **Zoneinfo**: Required for timezone-aware time operations
    - **distroless includes these**: If you use distroless, you don't need to copy them

---

## Non-Root User

=== "The Code"

    ```dockerfile
    FROM golang:1.22-alpine AS builder
    WORKDIR /app
    COPY . .
    RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o server .

    FROM gcr.io/distroless/static-debian12

    USER nonroot:nonroot

    COPY --from=builder /app/server /server

    EXPOSE 8080
    ENTRYPOINT ["/server"]
    ```

=== "The Explanation"

    - **`nonroot:nonroot`**: Pre-configured user in distroless images (uid 65534)
    - **Security requirement**: Running as root inside a container is a security risk
    - **Kubernetes enforcement**: Pod security policies can enforce non-root containers

=== "The Terminal Output"

    ```bash
    $ docker run --rm myapp:latest whoami
    nonroot

    $ docker run --rm myapp:latest id
    uid=65534(nobody) gid=65534(nogroup) groups=65534(nogroup)
    ```

---

## Signal Handling in Containers

=== "The Code"

    ```go
    package main

    import (
        "context"
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
            w.Write([]byte("OK"))
        })

        srv := &http.Server{
            Addr:    ":8080",
            Handler: mux,
        }

        go func() {
            log.Printf("Server starting on %s", srv.Addr)
            if err := srv.ListenAndServe(); err != http.ErrServerClosed {
                log.Fatalf("Listen error: %v", err)
            }
        }()

        quit := make(chan os.Signal, 1)
        signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
        sig := <-quit
        log.Printf("Received %s, shutting down...", sig)

        ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
        defer cancel()

        if err := srv.Shutdown(ctx); err != nil {
            log.Fatalf("Forced shutdown: %v", err)
        }
        log.Println("Server stopped")
    }
    ```

=== "The Explanation"

    - **`SIGTERM`**: Sent by `docker stop` and Kubernetes `kubectl delete pod`
    - **`SIGINT`**: Sent by Ctrl+C for local development
    - **`srv.Shutdown`**: Stops accepting new connections and waits for in-flight requests
    - **Context timeout**: Ensures the process exits within 30 seconds even if requests hang

### Dockerfile for Proper Signal Handling

!!! go "Use exec form ENTRYPOINT"

    Always use the exec form `ENTRYPOINT ["/server"]` instead of the shell form `ENTRYPOINT /server`. The shell form runs through `/bin/sh`, which does not forward signals to your process.

=== "The Code"

    ```dockerfile
    # CORRECT: Exec form forwards signals directly
    ENTRYPOINT ["/server"]

    # WRONG: Shell form wraps in sh, signals are not forwarded
    ENTRYPOINT /server
    ```

---

## .dockerignore

=== "The Code"

    ```
    # .dockerignore
    .git
    .github
    .gitignore
    .env
    .env.*
    *.md
    docs/
    vendor/
    node_modules/
    tmp/
    *.log
    Dockerfile*
    docker-compose*.yml
    .dockerignore
    Makefile
    LICENSE
    README.md
    ```

=== "The Explanation"

    - **`.git`**: Excludes version control data (can be hundreds of MB)
    - **`vendor/`**: Dependencies should be downloaded via `go mod download` in the build stage
    - **`docs/`**: Documentation files are not needed in the image
    - **Build context**: Smaller context means faster builds

=== "The Terminal Output"

    ```bash
    # Without .dockerignore: 500MB context
    Sending build context to Docker daemon  524.3MB

    # With .dockerignore: 5MB context
    Sending build context to Docker daemon  5.2MB
    ```

---

## docker-compose

=== "The Code"

    ```yaml
    # docker-compose.yml
    version: "3.8"

    services:
      app:
        build:
          context: .
          dockerfile: Dockerfile
          args:
            VERSION: "1.2.3"
        ports:
          - "8080:8080"
        environment:
          - LOG_LEVEL=info
          - DB_HOST=postgres
          - DB_PORT=5432
          - REDIS_URL=redis://redis:6379
        depends_on:
          postgres:
            condition: service_healthy
          redis:
            condition: service_healthy
        healthcheck:
          test: ["CMD", "/server", "health"]
          interval: 10s
          timeout: 5s
          retries: 3
          start_period: 10s
        restart: unless-stopped
        deploy:
          resources:
            limits:
              memory: 128M
              cpus: "0.5"

      postgres:
        image: postgres:16-alpine
        environment:
          POSTGRES_DB: myapp
          POSTGRES_USER: user
          POSTGRES_PASSWORD: password
        volumes:
          - pgdata:/var/lib/postgresql/data
        healthcheck:
          test: ["CMD-SHELL", "pg_isready -U user -d myapp"]
          interval: 5s
          timeout: 3s
          retries: 5

      redis:
        image: redis:7-alpine
        healthcheck:
          test: ["CMD", "redis-cli", "ping"]
          interval: 5s
          timeout: 3s
          retries: 5

    volumes:
      pgdata:
    ```

=== "The Explanation"

    - **`depends_on` with `condition: service_healthy`**: Waits for dependencies to be healthy before starting
    - **`healthcheck`**: Docker monitors service health and reports status
    - **`deploy.resources`**: Limits container resource consumption
    - **Named volumes**: Persist database data across container restarts

=== "The Terminal Output"

    ```bash
    $ docker-compose up -d
    $ docker-compose ps
    NAME         IMAGE                     STATUS                 PORTS
    app-app-1    myapp:latest              Up (healthy)           0.0.0.0:8080->8080/tcp
    app-postgres postgres:16-alpine         Up (healthy)           5432/tcp
    app-redis    redis:7-alpine             Up (healthy)           6379/tcp
    ```

---

## Container Health Checks

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "net/http"
        "os"
        "os/signal"
        "syscall"
        "time"
    )

    type HealthResponse struct {
        Status string `json:"status"`
    }

    func main() {
        mux := http.NewServeMux()

        mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(http.StatusOK)
            json.NewEncoder(w).Encode(HealthResponse{Status: "alive"})
        })

        mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(http.StatusOK)
            json.NewEncoder(w).Encode(HealthResponse{Status: "ready"})
        })

        srv := &http.Server{Addr: ":8080", Handler: mux}
        go srv.ListenAndServe()

        quit := make(chan os.Signal, 1)
        signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
        <-quit

        ctx, _ := context.WithTimeout(context.Background(), 10*time.Second)
        srv.Shutdown(ctx)
    }
    ```

=== "The Explanation"

    - **`/healthz`**: Liveness probe — is the process alive?
    - **`/readyz`**: Readiness probe — can the process serve traffic?
    - **Docker healthcheck**: Uses these endpoints to determine container health
    - **Kubernetes probes**: Configure `livenessProbe` and `readinessProbe` to use these endpoints

---

## Security Scanning

=== "The Code"

    ```bash
    # Scan with Trivy
    $ trivy image myapp:latest

    # Scan with Grype
    $ grype myapp:latest

    # Scan with Snyk
    $ snyk container test myapp:latest

    # Scan Dockerfile for best practices
    $ hadolint Dockerfile

    # Scan Go dependencies for vulnerabilities
    $ govulncheck ./...
    ```

=== "The Explanation"

    - **Trivy**: Comprehensive vulnerability scanner for container images
    - **Grype**: Vulnerability scanner by Anchore
    - **Hadolint**: Lints Dockerfiles for best practices
    - **govulncheck**: Go-specific vulnerability scanner using the Go vulnerability database

=== "The Terminal Output"

    ```bash
    $ trivy image myapp:latest
    myapp:latest (distroless 1.2)
    Total: 0 (UNKNOWN: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0)

    $ govulncheck ./...
    No vulnerabilities found.
    ```

### Security Best Practices

| Practice | Description | Impact |
|---|---|---|
| Non-root user | Run as nonroot (uid 65534) | High |
| Read-only filesystem | Mount read-only where possible | Medium |
| No capabilities | Drop all Linux capabilities | High |
| Scan regularly | Run vulnerability scans in CI | Critical |
| Pin base images | Use specific digests, not `latest` | Medium |
| Minimal base | Use scratch or distroless | High |

---

## Best Practices

| Practice | Description | Priority |
|---|---|---|
| Multi-stage builds | Separate build and runtime stages | High |
| Layer caching | Order Dockerfile by change frequency | High |
| Non-root user | Never run as root in production | Critical |
| .dockerignore | Exclude unnecessary files from context | Medium |
| Pin base images | Use specific versions or digests | Medium |
| Health checks | Define HEALTHCHECK in Dockerfile | High |
| Security scanning | Scan images and dependencies in CI | Critical |
| Minimal base image | Use scratch or distroless for Go | High |

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Container exits immediately | Missing ENTRYPOINT or wrong path | Verify binary path and permissions |
| Signal not received | Shell form ENTRYPOINT | Use exec form: `ENTRYPOINT ["/server"]` |
| TLS errors | Missing CA certificates | Copy certs or use distroless/base |
| Slow builds | Layer cache invalidated | Order Dockerfile by change frequency |
| Container runs as root | Missing USER directive | Add `USER nonroot:nonroot` |
| Health check fails | Endpoint not responding | Verify health endpoint path and port |

## Summary

- Multi-stage builds separate build tools from production images, reducing size and attack surface
- Distroless images provide CA certificates and timezone data without a shell
- Scratch images offer maximum security but require manual file copying
- Non-root users prevent container breakout attacks
- Signal handling with exec form ENTRYPOINT ensures graceful shutdown
- Layer ordering optimizes Docker build cache usage
- Security scanning catches vulnerabilities in dependencies and base images

## Next Steps

- [CI/CD](/docs/production/ci-cd.md) — Automating container builds and deployment
- [Deployment](/docs/production/deployment.md) — Deploying containers to Kubernetes
- [Observability](/docs/production/observability.md) — Monitoring containerized applications
- [Resilience](/docs/production/resilience.md) — Building resilient containerized services
