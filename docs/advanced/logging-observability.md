# Logging & Observability

Modern Go applications need more than just `fmt.Println`. Structured logging, distributed tracing, and metrics collection form the foundation of production-ready observability. This guide covers the Go standard library's `log/slog` package, popular alternatives, and how to integrate OpenTelemetry for comprehensive observability.

## What You Will Learn

- Structured logging with `log/slog` (Go 1.21+)
- Configuring log levels and outputs
- Using zerolog and zap for high-performance logging
- Implementing OpenTelemetry tracing and spans
- Collecting metrics with Prometheus
- Building health check endpoints
- Distributing traces across services with correlation IDs

## Prerequisites

- Go 1.21 or later installed
- Basic understanding of HTTP servers and middleware
- Familiarity with interfaces and struct embedding

---

## Structured Logging with log/slog

Go 1.21 introduced `log/slog`, the standard library's structured logging package. It provides structured, leveled logging with a clean API.

=== "The Code"

    ```go
    package main

    import (
        "log/slog"
        "os"
    )

    func main() {
        logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
            Level: slog.LevelDebug,
        }))

        slog.SetDefault(logger)

        slog.Info("application started",
            "version", "1.0.0",
            "port", 8080,
        )

        slog.Debug("loading configuration",
            "file", "config.yaml",
        )

        slog.Warn("deprecated feature used",
            "feature", "legacy_auth",
            "replacement", "oauth2",
        )

        slog.Error("failed to connect to database",
            "error", "connection refused",
            "host", "localhost:5432",
            "attempts", 3,
        )
    }
    ```

=== "The Explanation"

    - **slog.New**: Creates a new logger with a specified handler (JSON, text, or custom)
    - **slog.HandlerOptions**: Controls log level, minimum level, and custom attributes
    - **slog.LevelDebug**: Log level constant for debug messages
    - **Key-value pairs**: Additional context passed as variadic arguments after the message

=== "The Terminal Output"

    ```
    {"time":"2026-09-03T10:15:30.123456Z","level":"INFO","msg":"application started","version":"1.0.0","port":8080}
    {"time":"2026-09-03T10:15:30.123467Z","level":"DEBUG","msg":"loading configuration","file":"config.yaml"}
    {"time":"2026-09-03T10:15:30.123478Z","level":"WARN","msg":"deprecated feature used","feature":"legacy_auth","replacement":"oauth2"}
    {"time":"2026-09-03T10:15:30.123489Z","level":"ERROR","msg":"failed to connect to database","error":"connection refused","host":"localhost:5432","attempts":3}
    ```

## Log Levels

`slog` supports five standard log levels with increasing severity.

| Level | Constant | Description |
|-------|----------|-------------|
| DEBUG | `slog.LevelDebug` | Detailed diagnostic information |
| INFO | `slog.LevelInfo` | General operational messages |
| WARN | `slog.LevelWarn` | Unexpected but recoverable situations |
| ERROR | `slog.LevelError` | Serious problems requiring attention |
| NONE | — | Disables all logging |

## Custom Log Handlers

You can implement the `slog.Handler` interface for custom output formats.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "log/slog"
        "os"
        "strings"
    )

    type ColoredHandler struct {
        Writer *os.File
        Level  slog.Level
    }

    func (h *ColoredHandler) Enabled(_ context.Context, level slog.Level) bool {
        return level >= h.Level
    }

    func (h *ColoredHandler) Handle(_ context.Context, r slog.Record) error {
        color := "\033[0m"
        switch r.Level {
        case slog.LevelDebug:
            color = "\033[36m"
        case slog.LevelInfo:
            color = "\033[32m"
        case slog.LevelWarn:
            color = "\033[33m"
        case slog.LevelError:
            color = "\033[31m"
        }

        var sb strings.Builder
        sb.WriteString(color)
        sb.WriteString(r.Level.String())
        sb.WriteString("\033[0m")
        sb.WriteString(" ")
        sb.WriteString(r.Message)

        r.Attrs(func(a slog.Attr) bool {
            sb.WriteString(" ")
            sb.WriteString(a.Key)
            sb.WriteString("=")
            sb.WriteString(a.Value.String())
            return true
        })

        sb.WriteString("\n")
        _, err := h.Writer.WriteString(sb.String())
        return err
    }

    func (h *ColoredHandler) WithAttrs(_ []slog.Attr) slog.Handler {
        return h
    }

    func (h *ColoredHandler) WithGroup(_ string) slog.Handler {
        return h
    }

    func main() {
        handler := &ColoredHandler{
            Writer: os.Stdout,
            Level:  slog.LevelDebug,
        }

        logger := slog.New(handler)
        slog.SetDefault(logger)

        slog.Info("Server is running", "port", 8080)
        slog.Debug("Processing request", "method", "GET", "path", "/api/users")
        slog.Warn("Rate limit approaching", "current", 95, "limit", 100)
    }
    ```

=== "The Explanation"

    - **slog.Handler interface**: Requires `Enabled`, `Handle`, `WithAttrs`, and `WithGroup` methods
    - **color codes**: ANSI escape sequences for terminal coloring
    - **r.Attrs**: Iterates over all attributes attached to the log record

=== "The Terminal Output"

    ```
    INFO Server is running port=8080
    DEBUG Processing request method=GET path=/api/users
    WARN Rate limit approaching current=95 limit=100
    ```

## High-Performance Logging with Zerolog

zerolog allocates zero bytes per event, making it one of the fastest logging libraries.

=== "The Code"

    ```go
    package main

    import (
        "io"
        "os"
        "time"

        "github.com/rs/zerolog"
    )

    func main() {
        output := zerolog.ConsoleWriter{
            Out:        os.Stdout,
            TimeFormat: time.RFC3339,
        }

        logger := zerolog.New(output).
            Level(zerolog.DebugLevel).
            With().
            Timestamp().
            Caller().
            Str("service", "api-gateway").
            Logger()

        logger.Info().
            Str("method", "GET").
            Str("path", "/api/users").
            Int("status", 200).
            Dur("latency", 45*time.Millisecond).
            Msg("request completed")

        logger.Error().
            Err(io.ErrUnexpectedEOF).
            Str("host", "db-primary").
            Msg("connection lost")

        subLogger := logger.With().Str("component", "auth").Logger()
        subLogger.Debug().Msg("token validation passed")
    }
    ```

=== "The Explanation"

    - **zerolog.ConsoleWriter**: Human-readable colored output for development
    - **zerolog.New**: Creates a new logger writing to the specified output
    - **With().Timestamp().Caller()**: Chain context fields to include in every event
    - **Str, Int, Dur**: Type-safe field constructors that avoid reflection
    - **Msg vs Msgf**: `Msg` uses structured fields; `Msgf` uses format strings

=== "The Terminal Output"

    ```
    2026-09-03T10:15:30Z INF request completed service=api-gateway method=GET path=/api/users status=200 latency=45ms
    2026-09-03T10:15:30Z ERR connection lost service=api-gateway error="unexpected EOF" host=db-primary
    2026-09-03T10:15:30Z DBG token validation passed service=api-gateway component=auth
    ```

## High-Performance Logging with Zap

Uber's zap library offers both `SugaredLogger` (easy) and `Logger` (fast) APIs.

=== "The Code"

    ```go
    package main

    import (
        "go.uber.org/zap"
        "go.uber.org/zap/zapcore"
    )

    func main() {
        config := zap.Config{
            Level:       zap.NewAtomicLevelAt(zapcore.DebugLevel),
            Development: false,
            Encoding:    "json",
            EncoderConfig: zapcore.EncoderConfig{
                TimeKey:        "ts",
                LevelKey:       "level",
                NameKey:        "logger",
                CallerKey:      "caller",
                MessageKey:     "msg",
                StacktraceKey:  "stacktrace",
                LineEnding:     zapcore.DefaultLineEnding,
                EncodeLevel:    zapcore.LowercaseLevelEncoder,
                EncodeTime:     zapcore.ISO8601TimeEncoder,
                EncodeDuration: zapcore.MillisDurationEncoder,
                EncodeCaller:   zapcore.ShortCallerEncoder,
            },
            OutputPaths:      []string{"stdout"},
            ErrorOutputPaths: []string{"stderr"},
        }

        logger, _ := config.Build()
        defer logger.Sync()

        logger.Info("server started",
            zap.String("host", "0.0.0.0"),
            zap.Int("port", 8080),
        )

        sugar := logger.Sugar()
        sugar.Infow("request processed",
            "method", "POST",
            "path", "/api/orders",
            "duration_ms", 120,
        )
    }
    ```

=== "The Explanation"

    - **zap.Config**: Full configuration for encoding, output, and log levels
    - **zapcore.EncoderConfig**: Controls how each log line is structured
    - **zap.String, zap.Int**: Strongly-typed field constructors (zero-allocation)
    - **logger.Sugar()**: Converts the fast logger to the convenient sugared API

=== "The Terminal Output"

    ```
    {"level":"info","ts":"2026-09-03T10:15:30.123Z","caller":"main/main.go:35","msg":"server started","host":"0.0.0.0","port":8080}
    {"level":"info","ts":"2026-09-03T10:15:30.124Z","caller":"main/main.go:40","msg":"request processed","method":"POST","path":"/api/orders","duration_ms":120}
    ```

## OpenTelemetry Tracing

OpenTelemetry provides vendor-neutral distributed tracing, metrics, and logs.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "log"
        "time"

        "go.opentelemetry.io/otel"
        "go.opentelemetry.io/otel/attribute"
        "go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
        "go.opentelemetry.io/otel/sdk/resource"
        sdktrace "go.opentelemetry.io/otel/sdk/trace"
        semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
    )

    func initTracer() (func(), error) {
        exporter, err := stdouttrace.New(
            stdouttrace.WithPrettyPrint(),
        )
        if err != nil {
            return nil, err
        }

        res, err := resource.Merge(
            resource.Default(),
            resource.NewWithAttributes(
                semconv.SchemaURL,
                semconv.ServiceNameKey.String("my-service"),
                semconv.ServiceVersionKey.String("1.0.0"),
            ),
        )
        if err != nil {
            return nil, err
        }

        tp := sdktrace.NewTracerProvider(
            sdktrace.WithBatcher(exporter),
            sdktrace.WithResource(res),
        )

        otel.SetTracerProvider(tp)

        return func() {
            if err := tp.Shutdown(context.Background()); err != nil {
                log.Printf("tracer shutdown error: %v", err)
            }
        }, nil
    }

    func main() {
        shutdown, err := initTracer()
        if err != nil {
            log.Fatal(err)
        }
        defer shutdown()

        tracer := otel.Tracer("my-service")

        ctx := context.Background()

        func(ctx context.Context) {
            ctx, span := tracer.Start(ctx, "handle-request",
                trace.WithAttributes(
                    attribute.String("http.method", "GET"),
                    attribute.String("http.url", "/api/users"),
                ),
            )
            defer span.End()

            processRequest(ctx)
        }(ctx)
    }

    func processRequest(ctx context.Context) {
        tracer := otel.Tracer("my-service")

        ctx, span := tracer.Start(ctx, "process-request")
        defer span.End()

        time.Sleep(50 * time.Millisecond)

        span.AddEvent("cache miss", trace.WithAttributes(
            attribute.String("cache.key", "user:123"),
        ))
    }
    ```

=== "The Explanation"

    - **stdouttrace.New**: Exports traces to stdout for development
    - **resource.Merge**: Combines default resources with service-specific attributes
    - **sdktrace.NewTracerProvider**: Configures the trace pipeline (exporter, sampler, resource)
    - **tracer.Start**: Creates a new span within the given context
    - **span.End**: Must be called to finish the span (usually deferred)
    - **span.AddEvent**: Records a timed event within the span

=== "The Terminal Output"

    ```
    Span #1
        TraceID   : abc123...
        SpanID    : def456...
        ParentSpanID: ghi789...
        Name      : handle-request
        Kind      : SPAN_KIND_INTERNAL
        Start     : 2026-09-03 10:15:30.123456
        End       : 2026-09-03 10:15:30.174567
        Attributes:
            http.method: GET
            http.url   : /api/users

    Span #2
        TraceID   : abc123...
        SpanID    : jkl012...
        ParentSpanID: def456...
        Name      : process-request
        Events:
            Event #1: cache miss (cache.key=user:123)
    ```

## Metrics with Prometheus

OpenTelemetry integrates with Prometheus for metrics collection and exposition.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "math/rand"
        "net/http"
        "time"

        "go.opentelemetry.io/otel"
        "go.opentelemetry.io/otel/attribute"
        "go.opentelemetry.io/otel/exporters/prometheus"
        apimetrics "go.opentelemetry.io/otel/metric"
        sdkmetric "go.opentelemetry.io/otel/sdk/metric"
    )

    func main() {
        exporter, err := prometheus.New()
        if err != nil {
            panic(err)
        }

        provider := sdkmetric.NewMeterProvider(
            sdkmetric.WithReader(exporter),
        )
        otel.SetMeterProvider(provider)

        meter := otel.Meter("my-service")

        requestCounter, _ := meter.Int64Counter(
            "http_requests_total",
            apimetrics.WithDescription("Total HTTP requests"),
        )

        latencyHistogram, _ := meter.Float64Histogram(
            "http_request_duration_seconds",
            apimetrics.WithDescription("HTTP request latency"),
        )

        go func() {
            for {
                ctx := context.Background()

                status := attribute.String("status", "200")
                method := attribute.String("method", "GET")

                requestCounter.Add(ctx, 1,
                    apimetrics.WithAttributes(status, method),
                )

                duration := float64(rand.Intn(200)) / 1000.0
                latencyHistogram.Record(ctx, duration,
                    apimetrics.WithAttributes(status, method),
                )

                time.Sleep(time.Second)
            }
        }()

        http.Handle("/metrics", promhttp.Handler())
        http.Handle("/api/users", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.WriteHeader(http.StatusOK)
            w.Write([]byte(`[{"id": 1, "name": "Alice"}]`))
        }))

        http.ListenAndServe(":8080", nil)
    }
    ```

=== "The Explanation"

    - **prometheus.New()**: Creates a Prometheus exporter for OpenTelemetry metrics
    - **Int64Counter**: A monotonically increasing counter metric
    - **Float64Histogram**: A distribution of values for latency tracking
    - **promhttp.Handler()**: Exposes the `/metrics` endpoint for Prometheus scraping

## Health Check Endpoints

Production services need health check endpoints for load balancers and orchestrators.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "encoding/json"
        "log"
        "net/http"
        "sync"
        "time"
    )

    type HealthStatus string

    const (
        StatusUp   HealthStatus = "UP"
        StatusDown HealthStatus = "DOWN"
    )

    type HealthCheck struct {
        Status    HealthStatus        `json:"status"`
        Checks    map[string]string   `json:"checks,omitempty"`
        Timestamp time.Time           `json:"timestamp"`
    }

    type HealthChecker struct {
        mu       sync.RWMutex
        checks   map[string]func() error
    }

    func NewHealthChecker() *HealthChecker {
        return &HealthChecker{
            checks: make(map[string]func() error),
        }
    }

    func (hc *HealthChecker) Register(name string, check func() error) {
        hc.mu.Lock()
        defer hc.mu.Unlock()
        hc.checks[name] = check
    }

    func (hc *HealthChecker) Check() HealthCheck {
        hc.mu.RLock()
        defer hc.mu.RUnlock()

        result := HealthCheck{
            Status:    StatusUp,
            Checks:    make(map[string]string),
            Timestamp: time.Now(),
        }

        for name, checkFn := range hc.checks {
            if err := checkFn(); err != nil {
                result.Status = StatusDown
                result.Checks[name] = err.Error()
            } else {
                result.Checks[name] = "ok"
            }
        }

        return result
    }

    func main() {
        checker := NewHealthChecker()

        checker.Register("database", func() error {
            time.Sleep(10 * time.Millisecond)
            return nil
        })

        checker.Register("redis", func() error {
            time.Sleep(5 * time.Millisecond)
            return nil
        })

        http.HandleFunc("/health/live", func(w http.ResponseWriter, r *http.Request) {
            w.WriteHeader(http.StatusOK)
            w.Write([]byte("OK"))
        })

        http.HandleFunc("/health/ready", func(w http.ResponseWriter, r *http.Request) {
            health := checker.Check()
            w.Header().Set("Content-Type", "application/json")
            if health.Status == StatusDown {
                w.WriteHeader(http.StatusServiceUnavailable)
            }
            json.NewEncoder(w).Encode(health)
        })

        log.Println("Server starting on :8080")
        log.Fatal(http.ListenAndServe(":8080", nil))
    }
    ```

=== "The Explanation"

    - **Liveness check** (`/health/live`): Verifies the process is running
    - **Readiness check** (`/health/ready`): Verifies the service can handle traffic
    - **HealthChecker**: Thread-safe registry of component health checks
    - **RWMutex**: Allows concurrent reads during health checks

## Correlation IDs for Distributed Tracing

Correlation IDs link requests across services for debugging distributed systems.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "crypto/rand"
        "fmt"
        "log"
        "net/http"
    )

    type contextKey string

    const CorrelationIDKey contextKey = "correlation_id"

    func generateCorrelationID() string {
        b := make([]byte, 16)
        rand.Read(b)
        return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
    }

    func CorrelationIDMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            corrID := r.Header.Get("X-Correlation-ID")
            if corrID == "" {
                corrID = generateCorrelationID()
            }

            ctx := context.WithValue(r.Context(), CorrelationIDKey, corrID)
            w.Header().Set("X-Correlation-ID", corrID)

            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }

    func GetCorrelationID(ctx context.Context) string {
        if id, ok := ctx.Value(CorrelationIDKey).(string); ok {
            return id
        }
        return ""
    }

    func main() {
        mux := http.NewServeMux()

        mux.HandleFunc("/api/orders", func(w http.ResponseWriter, r *http.Request) {
            corrID := GetCorrelationID(r.Context())
            log.Printf("[%s] Processing order", corrID)

            callInventoryService(r.Context())

            w.Header().Set("Content-Type", "application/json")
            fmt.Fprintf(w, `{"correlation_id": "%s", "status": "created"}`, corrID)
        })

        handler := CorrelationIDMiddleware(mux)

        log.Println("Server starting on :8080")
        log.Fatal(http.ListenAndServe(":8080", handler))
    }

    func callInventoryService(ctx context.Context) {
        corrID := GetCorrelationID(ctx)
        log.Printf("[%s] Calling inventory service", corrID)
    }
    ```

=== "The Explanation"

    - **context.WithValue**: Stores correlation ID in request context
    - **contextKey type**: Prevents key collisions between packages
    - **X-Correlation-ID header**: Standard header for distributed tracing
    - **GetCorrelationID**: Safe accessor that returns empty string if missing

## Best Practices

| Practice | Recommendation |
|----------|----------------|
| Use structured logging | Always use key-value pairs, never format strings in production |
| Set log levels | Use DEBUG for development, INFO/WARN for production |
| Include context | Add request ID, user ID, and trace ID to every log line |
| Avoid logging secrets | Never log passwords, tokens, or PII |
| Use appropriate logger | `slog` for most apps, `zerolog`/`zap` for high-throughput |
| Health checks | Implement both liveness and readiness probes |
| Metrics naming | Use `snake_case` and include units in the name |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Logs missing context | Ensure middleware runs before handlers |
| High memory from tracing | Reduce batch size or sample rate |
| Prometheus metrics 0 | Check that metrics are incremented in the correct goroutine |
| Correlation ID not propagated | Verify middleware order in the chain |
| Structured logs unreadable | Use `ConsoleWriter` in development, JSON in production |

## Summary

- `log/slog` provides structured logging in the standard library (Go 1.21+)
- zerolog and zap offer zero-allocation logging for high-performance needs
- OpenTelemetry provides vendor-neutral tracing, metrics, and logs
- Health checks are essential for container orchestration
- Correlation IDs link requests across distributed services

## Next Steps

- [Configuration & Viper](./configuration-viper.md) — Manage application configuration
- [Middleware & HTTP](./middleware-hooks.md) — Build logging middleware
- [Testing Observability](../basics/testing.md) — Test logging and tracing in integration tests
