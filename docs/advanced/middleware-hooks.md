# Middleware & Hooks

Middleware provides a reusable way to process HTTP requests and responses. This guide covers middleware patterns, chaining, and lifecycle hooks for building maintainable web applications.

## What You Will Learn

- HTTP middleware pattern implementation
- Middleware chaining and composition
- Logging, auth, and CORS middleware
- Recovery middleware for panic handling
- Request ID propagation
- Application lifecycle hooks
- Plugin architecture patterns

## Prerequisites

- Familiarity with `net/http` package
- Understanding of HTTP handlers
- Basic knowledge of closures

---

## HTTP Middleware Pattern

Middleware wraps handlers to add cross-cutting concerns.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "net/http"
        "time"
    )

    type Middleware func(http.Handler) http.Handler

    func loggingMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            log.Printf("Started %s %s", r.Method, r.URL.Path)

            next.ServeHTTP(w, r)

            log.Printf("Completed %s %s in %v", r.Method, r.URL.Path, time.Since(start))
        })
    }

    func main() {
        mux := http.NewServeMux()
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Hello, World!")
        })

        handler := loggingMiddleware(mux)

        log.Println("Server starting on :8080")
        log.Fatal(http.ListenAndServe(":8080", handler))
    }
    ```

=== "The Explanation"

    - **Middleware type**: Function that takes a handler and returns a new handler
    - **next.ServeHTTP**: Calls the wrapped handler (or next middleware)
    - **Closure**: Captures `next` to form a chain
    - **Timing**: Records request duration for monitoring

=== "The Terminal Output"

    ```
    2024/01/15 10:30:00 Started GET /
    2024/01/15 10:30:00 Completed GET / in 1.2ms
    ```

!!! go "Handler Wrapping"
    Every middleware receives the next handler and returns a new handler. This decorator pattern enables unlimited composition.

---

## Middleware Chaining

Chain multiple middleware using a helper function.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "net/http"
        "strings"
        "time"
    )

    type Middleware func(http.Handler) http.Handler

    func chain(middlewares ...Middleware) Middleware {
        return func(final http.Handler) http.Handler {
            for i := len(middlewares) - 1; i >= 0; i-- {
                final = middlewares[i](final)
            }
            return final
        }
    }

    func logging(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            log.Printf("[%s] %s", r.Method, r.URL.Path)
            next.ServeHTTP(w, r)
        })
    }

    func contentType(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Content-Type", "text/plain")
            next.ServeHTTP(w, r)
        })
    }

    func auth(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            token := r.Header.Get("Authorization")
            if token == "" {
                http.Error(w, "Unauthorized", http.StatusUnauthorized)
                return
            }
            next.ServeHTTP(w, r)
        })
    }

    func main() {
        mux := http.NewServeMux()
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Authenticated request")
        })

        handler := chain(logging, contentType, auth)(mux)

        log.Fatal(http.ListenAndServe(":8080", handler))
    }
    ```

=== "The Explanation"

    - **chain function**: Variadic middleware composition
    - **Reverse iteration**: Wraps handlers from last to first for correct execution order
    - **Execution order**: logging -> contentType -> auth -> handler
    - **Early return**: Auth middleware stops chain if unauthorized

=== "The Terminal Output"

    ```
    2024/01/15 10:30:00 [GET] /
    2024/01/15 10:30:00 [GET] /unauthorized
    ```

!!! note "Execution Order"
    Middleware executes in the order you pass to `chain()`. Left-to-right in the chain function, but wraps inward.

---

## Logging Middleware

Comprehensive request/response logging.

=== "The Code"

    ```go
    package main

    import (
        "bytes"
        "fmt"
        "io"
        "log"
        "net/http"
        "time"
    )

    type responseRecorder struct {
        http.ResponseWriter
        statusCode int
        body       bytes.Buffer
    }

    func (r *responseRecorder) WriteHeader(code int) {
        r.statusCode = code
        r.ResponseWriter.WriteHeader(code)
    }

    func (r *responseRecorder) Write(b []byte) (int, error) {
        r.body.Write(b)
        return r.ResponseWriter.Write(b)
    }

    func detailedLogger(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            rec := &responseRecorder{ResponseWriter: w, statusCode: http.StatusOK}

            body, _ := io.ReadAll(r.Body)
            r.Body.Close()

            next.ServeHTTP(rec, r)

            log.Printf(
                "method=%s path=%s status=%d duration=%v ip=%s user_agent=%s",
                r.Method,
                r.URL.Path,
                rec.statusCode,
                time.Since(start),
                r.RemoteAddr,
                r.UserAgent(),
            )
        })
    }

    func main() {
        mux := http.NewServeMux()
        mux.HandleFunc("/api/data", func(w http.ResponseWriter, r *http.Request) {
            w.WriteHeader(http.StatusOK)
            fmt.Fprintf(w, `{"status": "ok"}`)
        })

        handler := detailedLogger(mux)

        log.Fatal(http.ListenAndServe(":8080", handler))
    }
    ```

=== "The Explanation"

    - **responseRecorder**: Wraps ResponseWriter to capture status code and body
    - **Body reading**: Reads request body for logging (re-create for handler)
    - **Structured logging**: Key-value pairs for log aggregation
    - **Duration tracking**: Measures request processing time

=== "The Terminal Output"

    ```
    2024/01/15 10:30:00 method=GET path=/api/data status=200 duration=1.2ms ip=127.0.0.1:54321 user_agent=curl/7.64.1
    ```

!!! warning "Body Re-creation"
    After reading the request body for logging, you must recreate it for the handler. Use `io.NopCloser(bytes.NewReader(body))`.

---

## Authentication Middleware

Token-based authentication with context propagation.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "log"
        "net/http"
        "strings"
    )

    type contextKey string

    const UserIDKey contextKey = "user_id"

    func authMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            authHeader := r.Header.Get("Authorization")
            if authHeader == "" {
                http.Error(w, `{"error": "missing authorization"}`, http.StatusUnauthorized)
                return
            }

            parts := strings.SplitN(authHeader, " ", 2)
            if len(parts) != 2 || parts[0] != "Bearer" {
                http.Error(w, `{"error": "invalid authorization format"}`, http.StatusUnauthorized)
                return
            }

            token := parts[1]
            userID, err := validateToken(token)
            if err != nil {
                http.Error(w, `{"error": "invalid token"}`, http.StatusUnauthorized)
                return
            }

            ctx := context.WithValue(r.Context(), UserIDKey, userID)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }

    func validateToken(token string) (string, error) {
        if token == "valid-token" {
            return "user-123", nil
        }
        return "", fmt.Errorf("invalid token")
    }

    func protectedHandler(w http.ResponseWriter, r *http.Request) {
        userID := r.Context().Value(UserIDKey).(string)
        fmt.Fprintf(w, `{"user_id": "%s"}`, userID)
    }

    func main() {
        mux := http.NewServeMux()
        mux.Handle("/api/profile", authMiddleware(http.HandlerFunc(protectedHandler)))

        log.Fatal(http.ListenAndServe(":8080", mux))
    }
    ```

=== "The Explanation"

    - **Context key type**: Prevents collisions using custom string type
    - **Token validation**: Extracts and verifies Bearer token
    - **Context injection**: Passes user ID downstream via context
    - **Type assertion**: Retrieves user ID from context with type cast

=== "The Terminal Output"

    ```
    curl -H "Authorization: Bearer valid-token" localhost:8080/api/profile
    {"user_id": "user-123"}
    ```

!!! danger "Security"
    Never store sensitive data in context. Use context only for request-scoped values that don't cross trust boundaries.

---

## CORS Middleware

Handle Cross-Origin Resource Sharing.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "net/http"
        "strings"
    )

    func corsMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            origin := r.Header.Get("Origin")
            if origin == "" {
                origin = "*"
            }

            w.Header().Set("Access-Control-Allow-Origin", origin)
            w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
            w.Header().Set("Access-Control-Max-Age", "86400")

            if r.Method == http.MethodOptions {
                w.WriteHeader(http.StatusNoContent)
                return
            }

            next.ServeHTTP(w, r)
        })
    }

    func main() {
        mux := http.NewServeMux()
        mux.HandleFunc("/api/data", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, `{"data": "cors-enabled"}`)
        })

        handler := corsMiddleware(mux)

        log.Fatal(http.ListenAndServe(":8080", handler))
    }
    ```

=== "The Explanation"

    - **Preflight handling**: OPTIONS requests return immediately with CORS headers
    - **Origin reflection**: Mirrors request origin for flexibility (restrict in production)
    - **Max-Age**: Caches preflight response for 24 hours
    - **Exposed headers**: Controls which headers browsers can read

=== "The Terminal Output"

    ```
    curl -I -X OPTIONS localhost:8080/api/data
    HTTP/1.1 204 No Content
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
    ```

!!! warning "Production CORS"
    Never use `Access-Control-Allow-Origin: *` in production. Whitelist specific trusted origins.

---

## Recovery Middleware

Catch panics to prevent server crashes.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "net/http"
        "runtime/debug"
    )

    func recoveryMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            defer func() {
                if err := recover(); err != nil {
                    log.Printf("PANIC: %v\n%s", err, debug.Stack())

                    w.Header().Set("Content-Type", "application/json")
                    w.WriteHeader(http.StatusInternalServerError)
                    fmt.Fprintf(w, `{"error": "internal server error"}`)
                }
            }()

            next.ServeHTTP(w, r)
        })
    }

    func main() {
        mux := http.NewServeMux()
        mux.HandleFunc("/panic", func(w http.ResponseWriter, r *http.Request) {
            panic("something went wrong")
        })

        handler := recoveryMiddleware(mux)

        log.Fatal(http.ListenAndServe(":8080", handler))
    }
    ```

=== "The Explanation"

    - **defer recover**: Catches panics before they crash the server
    - **debug.Stack**: Logs full stack trace for debugging
    - **Safe response**: Returns generic error to client
    - **Log panic**: Records error details for monitoring

=== "The Terminal Output"

    ```
    2024/01/15 10:30:00 PANIC: something went wrong
    goroutine 6 [running]:
    main.main.func1()
        /app/main.go:25 +0x50
    ...
    ```

!!! go "Always Recover"
    Wrap every handler in recovery middleware. Unhandled panics crash the entire server process.

---

## Request ID Middleware

Propagate unique request identifiers for tracing.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "log"
        "net/http"
        "github.com/google/uuid"
    )

    type contextKey string

    const RequestIDKey contextKey = "request_id"

    func requestIDMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            requestID := r.Header.Get("X-Request-ID")
            if requestID == "" {
                requestID = uuid.New().String()
            }

            ctx := context.WithValue(r.Context(), RequestIDKey, requestID)
            w.Header().Set("X-Request-ID", requestID)

            log.Printf("[%s] %s %s", requestID, r.Method, r.URL.Path)

            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }

    func handler(w http.ResponseWriter, r *http.Request) {
        requestID := r.Context().Value(RequestIDKey).(string)
        fmt.Fprintf(w, `{"request_id": "%s"}`, requestID)
    }

    func main() {
        mux := http.NewServeMux()
        mux.HandleFunc("/api/trace", handler)

        handler := requestIDMiddleware(mux)

        log.Fatal(http.ListenAndServe(":8080", handler))
    }
    ```

=== "The Explanation"

    - **UUID generation**: Creates unique identifier if not provided
    - **Header propagation**: Returns request ID in response header
    - **Context injection**: Makes ID available to downstream handlers
    - **Distributed tracing**: Use with Jaeger or Zipkin for request tracking

=== "The Terminal Output"

    ```
    curl localhost:8080/api/trace
    {"request_id": "550e8400-e29b-41d4-a716-446655440000"}
    ```

---

## Lifecycle Hooks

Manage application startup and shutdown.

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
        "sync"
        "syscall"
        "time"
    )

    type App struct {
        server   *http.Server
        hooks    []func(ctx context.Context) error
        shutdown []func(ctx context.Context) error
        mu       sync.Mutex
    }

    func NewApp(addr string) *App {
        return &App{
            server: &http.Server{Addr: addr},
        }
    }

    func (a *App) OnStart(fn func(ctx context.Context) error) {
        a.hooks = append(a.hooks, fn)
    }

    func (a *App) OnShutdown(fn func(ctx context.Context) error) {
        a.shutdown = append(a.shutdown, fn)
    }

    func (a *App) Start(handler http.Handler) error {
        ctx := context.Background()

        for _, hook := range a.hooks {
            if err := hook(ctx); err != nil {
                return fmt.Errorf("startup hook failed: %w", err)
            }
        }

        a.server.Handler = handler

        errCh := make(chan error, 1)
        go func() {
            log.Printf("Server starting on %s", a.server.Addr)
            errCh <- a.server.ListenAndServe()
        }()

        quit := make(chan os.Signal, 1)
        signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

        select {
        case <-quit:
            log.Println("Shutdown signal received")
        case err := <-errCh:
            return err
        }

        shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
        defer cancel()

        for i := len(a.shutdown) - 1; i >= 0; i-- {
            if err := a.shutdown[i](shutdownCtx); err != nil {
                log.Printf("Shutdown hook error: %v", err)
            }
        }

        return a.server.Shutdown(shutdownCtx)
    }

    func main() {
        app := NewApp(":8080")

        app.OnStart(func(ctx context.Context) error {
            log.Println("Initializing database connection")
            return nil
        })

        app.OnStart(func(ctx context.Context) error {
            log.Println("Connecting to Redis")
            return nil
        })

        app.OnShutdown(func(ctx context.Context) error {
            log.Println("Closing database connection")
            return nil
        })

        mux := http.NewServeMux()
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Server running")
        })

        if err := app.Start(mux); err != nil {
            log.Fatal(err)
        }

        log.Println("Server stopped gracefully")
    }
    ```

=== "The Explanation"

    - **OnStart**: Registers initialization hooks called before server starts
    - **OnShutdown**: Registers cleanup hooks called during graceful shutdown
    - **Signal handling**: Listens for SIGINT/SIGTERM for graceful shutdown
    - **Reverse shutdown order**: Cleanup runs in reverse order of registration
    - **Timeout context**: Prevents hanging during shutdown

=== "The Terminal Output"

    ```
    2024/01/15 10:30:00 Initializing database connection
    2024/01/15 10:30:00 Connecting to Redis
    2024/01/15 10:30:00 Server starting on :8080
    ^C
    2024/01/15 10:30:15 Shutdown signal received
    2024/01/15 10:30:15 Closing database connection
    2024/01/15 10:30:15 Server stopped gracefully
    ```

!!! go "Graceful Shutdown"
    Always handle OS signals and drain in-flight requests before exiting. This prevents data corruption and client errors.

---

## Plugin Architecture

Dynamic middleware registration via plugins.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "net/http"
    )

    type Plugin interface {
        Name() string
        Middleware() Middleware
    }

    type Middleware func(http.Handler) http.Handler

    type PluginRegistry struct {
        plugins []Plugin
    }

    func (r *PluginRegistry) Register(p Plugin) {
        r.plugins = append(r.plugins, p)
    }

    func (r *PluginRegistry) Apply(handler http.Handler) http.Handler {
        for i := len(r.plugins) - 1; i >= 0; i-- {
            handler = r.plugins[i].Middleware()(handler)
        }
        return handler
    }

    type MetricsPlugin struct{}

    func (p *MetricsPlugin) Name() string { return "metrics" }
    func (p *MetricsPlugin) Middleware() Middleware {
        return func(next http.Handler) http.Handler {
            return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                log.Printf("[metrics] %s %s", r.Method, r.URL.Path)
                next.ServeHTTP(w, r)
            })
        }
    }

    func main() {
        registry := &PluginRegistry{}

        registry.Register(&MetricsPlugin{})

        mux := http.NewServeMux()
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Plugin architecture example")
        })

        handler := registry.Apply(mux)

        log.Fatal(http.ListenAndServe(":8080", handler))
    }
    ```

=== "The Explanation"

    - **Plugin interface**: Defines name and middleware method
    - **Registry**: Collects and manages plugins
    - **Apply**: Chains all plugin middleware in order
    - **Dynamic loading**: Plugins can be registered at runtime

=== "The Terminal Output"

    ```
    2024/01/15 10:30:00 [metrics] GET /
    ```

!!! abstract "Extensibility"
    Plugin architecture allows third-party extensions without modifying core application code.

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Keep middleware small | One concern per middleware |
| Use context for request data | Pass values via context, not globals |
| Handle errors gracefully | Don't let middleware panic |
| Order matters | Logging first, auth last |
| Test middleware independently | Unit test each middleware separately |
| Document dependencies | Specify required headers and context values |

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Middleware not executing | Wrong order in chain | Check chain function ordering |
| Context value missing | Wrong key type | Verify contextKey type matches |
| CORS errors | Missing headers | Add Access-Control-Allow-Origin |
| Panics crash server | Missing recovery middleware | Add defer recover middleware |
| Memory leak | Goroutine in middleware | Ensure all goroutines complete |

## Summary

- Middleware wraps handlers for cross-cutting concerns
- Chain middleware using helper functions
- Logging provides observability
- Auth middleware secures endpoints
- CORS enables cross-origin requests
- Recovery prevents server crashes
- Request IDs enable distributed tracing
- Lifecycle hooks manage startup/shutdown
- Plugin architecture enables extensibility

## Next Steps

- [Database & SQL](database-sql.md)
- [ORM & GORM](orm-gorm.md)
- [HTTP Servers](../basics/http-servers.md)
- [Testing Middleware](../basics/testing.md)
