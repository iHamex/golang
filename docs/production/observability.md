# Observability

Production systems require comprehensive observability to understand behavior, detect issues, and maintain reliability. Go's standard library and ecosystem provide structured logging, metrics, and tracing capabilities that integrate with industry-standard observability platforms.

## What You Will Learn

- Implementing structured logging with `log/slog`
- Integrating OpenTelemetry for traces and metrics
- Exposing Prometheus metrics from Go applications
- Building Grafana dashboards for visualization
- Implementing distributed tracing across services
- Using correlation IDs for request tracking
- Configuring log aggregation and alerting
- Defining SLOs, SLIs, and golden signals

## Prerequisites

- Familiarity with [Go modules](/docs/fundamentals/modules.md)
- Understanding of [concurrency patterns](/docs/fundamentals/concurrency.md)
- Basic knowledge of HTTP servers and middleware

---

## Structured Logging with slog

Go 1.21 introduced `log/slog` in the standard library for structured, leveled logging with JSON and text output formats.

=== "The Code"

    ```go
    package main

    import (
        "log/slog"
        "os"
    )

    func main() {
        logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
            Level: slog.LevelInfo,
        }))

        slog.SetDefault(logger)

        slog.Info("server started",
            "port", 8080,
            "env", "production",
        )

        slog.Warn("high memory usage",
            "current_mb", 1024,
            "threshold_mb", 2048,
        )

        slog.Error("database connection failed",
            "error", "connection refused",
            "host", "db.example.com",
            "port", 5432,
        )
    }
    ```

=== "The Explanation"

    - **`slog.NewJSONHandler`**: Outputs log lines as JSON objects
    - **`slog.LevelInfo`**: Filters messages below info level
    - **Key-value pairs**: Structured fields appended to each log line
    - **`slog.SetDefault`**: Makes the configured logger the package default

=== "The Terminal Output"

    ```
    {"time":"2026-09-03T10:00:00Z","level":"INFO","msg":"server started","port":8080,"env":"production"}
    {"time":"2026-09-03T10:00:01Z","level":"WARN","msg":"high memory usage","current_mb":1024,"threshold_mb":2048}
    {"time":"2026-09-03T10:00:02Z","level":"ERROR","msg":"database connection failed","error":"connection refused","host":"db.example.com","port":5432}
    ```

### Contextual Logging

=== "The Code"

    ```go
    package main

    import (
        "context"
        "log/slog"
        "os"
    )

    type contextKey string

    const loggerKey contextKey = "logger"

    func WithLogger(ctx context.Context, logger *slog.Logger) context.Context {
        return context.WithValue(ctx, loggerKey, logger)
    }

    func LoggerFromContext(ctx context.Context) *slog.Logger {
        if l, ok := ctx.Value(loggerKey).(*slog.Logger); ok {
            return l
        }
        return slog.Default()
    }

    func handleRequest(ctx context.Context) {
        logger := LoggerFromContext(ctx)
        logger.Info("processing request",
            "method", "GET",
            "path", "/api/users",
        )
    }

    func main() {
        base := slog.New(slog.NewJSONHandler(os.Stdout, nil))

        logger := base.With(
            "service", "user-api",
            "version", "1.2.3",
        )

        ctx := WithLogger(context.Background(), logger)
        handleRequest(ctx)
    }
    ```

=== "The Explanation"

    - **Context propagation**: Attach loggers to contexts for consistent fields
    - **`base.With`**: Creates a child logger with additional fields
    - **Fallback**: `slog.Default()` provides a logger when context has none

=== "The Terminal Output"

    ```
    {"time":"2026-09-03T10:00:00Z","level":"INFO","msg":"processing request","service":"user-api","version":"1.2.3","method":"GET","path":"/api/users"}
    ```

### Log Levels

| Level | Constant | Use Case |
|---|---|---|
| DEBUG | `slog.LevelDebug` | Detailed diagnostic information |
| INFO | `slog.LevelInfo` | Normal operational events |
| WARN | `slog.LevelWarn` | Degraded but functional state |
| ERROR | `slog.LevelError` | Failures requiring attention |

---

## OpenTelemetry Integration

OpenTelemetry provides vendor-neutral APIs for traces, metrics, and logs.

### Setup

=== "The Code"

    ```go
    package main

    import (
        "context"
        "log"
        "time"

        "go.opentelemetry.io/otel"
        "go.opentelemetry.io/otel/attribute"
        "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
        "go.opentelemetry.io/otel/sdk/resource"
        tracesdk "go.opentelemetry.io/otel/sdk/trace"
        "go.opentelemetry.io/otel/trace"
    )

    func initTracer(ctx context.Context) (func(), error) {
        exporter, err := otlptracegrpc.New(ctx,
            otlptracegrpc.WithEndpoint("localhost:4317"),
            otlptracegrpc.WithInsecure(),
        )
        if err != nil {
            return nil, err
        }

        res, _ := resource.Merge(
            resource.Default(),
            resource.NewWithAttributes(
                "https://github.com/myorg/myapp",
                attribute.String("service.name", "myapp"),
                attribute.String("service.version", "1.2.3"),
            ),
        )

        tp := tracesdk.NewTracerProvider(
            tracesdk.WithBatcher(exporter),
            tracesdk.WithResource(res),
            tracesdk.WithSampler(tracesdk.ParentBased(tracesdk.TraceIDRatioBased(0.1))),
        )

        otel.SetTracerProvider(tp)

        return func() {
            ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
            defer cancel()
            tp.Shutdown(ctx)
        }, nil
    }

    func main() {
        ctx := context.Background()
        shutdown, err := initTracer(ctx)
        if err != nil {
            log.Fatal(err)
        }
        defer shutdown()

        tracer := otel.Tracer("myapp")

        ctx, span := tracer.Start(ctx, "handle-request",
            trace.WithAttributes(
                attribute.String("http.method", "GET"),
                attribute.String("http.url", "/api/users"),
            ),
        )
        defer span.End()

        // Process request
        span.AddEvent("processing started")
        time.Sleep(100 * time.Millisecond)
        span.SetStatus(2, "")
    }
    ```

=== "The Explanation"

    - **`otlptracegrpc`**: Exports traces via OpenTelemetry Protocol (OTLP) over gRPC
    - **`resource`**: Identifies the service generating telemetry data
    - **`TraceIDRatioBased(0.1)`**: Samples 10% of traces in production
    - **`span.AddEvent`**: Records events within a trace span

=== "The Terminal Output"

    ```
    Tracer initialized, exporting to localhost:4317
    Trace exported with 1 span
    ```

---

## Prometheus Metrics

=== "The Code"

    ```go
    package main

    import (
        "log"
        "math/rand"
        "net/http"
        "time"

        "github.com/prometheus/client_golang/prometheus"
        "github.com/prometheus/client_golang/prometheus/promhttp"
    )

    var (
        httpRequestsTotal = prometheus.NewCounterVec(
            prometheus.CounterOpts{
                Name: "http_requests_total",
                Help: "Total number of HTTP requests",
            },
            []string{"method", "path", "status"},
        )

        httpRequestDuration = prometheus.NewHistogramVec(
            prometheus.HistogramOpts{
                Name:    "http_request_duration_seconds",
                Help:    "HTTP request duration in seconds",
                Buckets: prometheus.DefBuckets,
            },
            []string{"method", "path"},
        )

        activeConnections = prometheus.NewGauge(
            prometheus.GaugeOpts{
                Name: "active_connections",
                Help: "Number of active connections",
            },
        )
    )

    func init() {
        prometheus.MustRegister(httpRequestsTotal)
        prometheus.MustRegister(httpRequestDuration)
        prometheus.MustRegister(activeConnections)
    }

    func main() {
        http.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            activeConnections.Inc()
            defer activeConnections.Dec()

            time.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)

            duration := time.Since(start).Seconds()
            httpRequestsTotal.WithLabelValues(r.Method, "/api/users", "200").Inc()
            httpRequestDuration.WithLabelValues(r.Method, "/api/users").Observe(duration)

            w.Write([]byte(`[{"id":1,"name":"Alice"}]`))
        })

        http.Handle("/metrics", promhttp.Handler())

        log.Println("Metrics available at :8080/metrics")
        log.Fatal(http.ListenAndServe(":8080", nil))
    }
    ```

=== "The Explanation"

    - **`CounterVec`**: Monotonically increasing metric with label dimensions
    - **`HistogramVec`**: Distribution of values with configurable buckets
    - **`Gauge`**: Value that can go up and down
    - **`promhttp.Handler()`**: Exposes metrics endpoint for Prometheus scraping

=== "The Terminal Output"

    ```bash
    $ curl -s http://localhost:8080/metrics | head -20
    # HELP http_requests_total Total number of HTTP requests
    # TYPE http_requests_total counter
    http_requests_total{method="GET",path="/api/users",status="200"} 42
    # HELP http_request_duration_seconds HTTP request duration in seconds
    # TYPE http_request_duration_seconds histogram
    http_request_duration_seconds_bucket{method="GET",path="/api/users",le="0.005"} 10
    http_request_duration_seconds_bucket{method="GET",path="/api/users",le="0.01"} 20
    # HELP active_connections Number of active connections
    # TYPE active_connections gauge
    active_connections 3
    ```

### Metric Types

| Type | Description | Use Case |
|---|---|---|
| Counter | Monotonically increasing | Request counts, error counts |
| Gauge | Can increase or decrease | Active connections, queue size |
| Histogram | Distribution of values | Request latency, response sizes |
| Summary | Similar to histogram | Client-side quantile calculation |

---

## Middleware for Observability

=== "The Code"

    ```go
    package main

    import (
        "log/slog"
        "net/http"
        "time"

        "github.com/google/uuid"
    )

    func requestIDMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            id := r.Header.Get("X-Request-ID")
            if id == "" {
                id = uuid.New().String()
            }

            ctx := r.Context()
            ctx = context.WithValue(ctx, "request_id", id)
            r = r.WithContext(ctx)

            w.Header().Set("X-Request-ID", id)
            next.ServeHTTP(w, r)
        })
    }

    func loggingMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()

            wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
            next.ServeHTTP(wrapped, r)

            slog.Info("request completed",
                "method", r.Method,
                "path", r.URL.Path,
                "status", wrapped.statusCode,
                "duration_ms", time.Since(start).Milliseconds(),
                "request_id", r.Context().Value("request_id"),
            )
        })
    }

    type responseWriter struct {
        http.ResponseWriter
        statusCode int
    }

    func (rw *responseWriter) WriteHeader(code int) {
        rw.statusCode = code
        rw.ResponseWriter.WriteHeader(code)
    }

    func main() {
        mux := http.NewServeMux()
        mux.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
            w.Write([]byte(`[{"id":1}]`))
        })

        handler := requestIDMiddleware(loggingMiddleware(mux))
        http.ListenAndServe(":8080", handler)
    }
    ```

=== "The Explanation"

    - **`X-Request-ID`**: Correlates logs across distributed services
    - **`responseWriter`**: Wraps the standard writer to capture the status code
    - **Middleware chain**: Request ID → logging → handler
    - **Duration tracking**: Measures request processing time

=== "The Terminal Output"

    ```
    {"time":"2026-09-03T10:00:00Z","level":"INFO","msg":"request completed","method":"GET","path":"/api/users","status":200,"duration_ms":5,"request_id":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"}
    ```

---

## Grafana Dashboard Configuration

=== "The Code"

    ```yaml
    # grafana/dashboard.json
    {
      "dashboard": {
        "title": "Go Application Overview",
        "panels": [
          {
            "title": "Request Rate",
            "type": "graph",
            "targets": [{
              "expr": "rate(http_requests_total[5m])",
              "legendFormat": "{{method}} {{path}}"
            }]
          },
          {
            "title": "Error Rate",
            "type": "stat",
            "targets": [{
              "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])"
            }]
          },
          {
            "title": "Latency P99",
            "type": "graph",
            "targets": [{
              "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))"
            }]
          },
          {
            "title": "Active Goroutines",
            "type": "graph",
            "targets": [{
              "expr": "go_goroutines"
            }]
          }
        ]
      }
    }
    ```

=== "The Explanation"

    - **Request rate**: `rate()` calculates per-second request throughput
    - **Error rate**: Ratio of 5xx responses to total requests
    - **P99 latency**: 99th percentile of request duration
    - **Goroutines**: Runtime metric showing active goroutine count

---

## Distributed Tracing

=== "The Code"

    ```go
    package main

    import (
        "context"
        "log"
        "net/http"
        "time"

        "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
        "go.opentelemetry.io/otel"
        "go.opentelemetry.io/otel/attribute"
        "go.opentelemetry.io/otel/trace"
    )

    func callServiceA(ctx context.Context) error {
        tracer := otel.Tracer("service-a")
        ctx, span := tracer.Start(ctx, "call-service-a",
            trace.WithAttributes(
                attribute.String("peer.service", "service-b"),
            ),
        )
        defer span.End()

        req, _ := http.NewRequestWithContext(ctx, "GET", "http://service-b:8081/data", nil)
        resp, err := http.DefaultClient.Do(req)
        if err != nil {
            span.RecordError(err)
            return err
        }
        defer resp.Body.Close()

        span.SetAttributes(attribute.Int("http.status_code", resp.StatusCode))
        return nil
    }

    func main() {
        tracedClient := &http.Client{
            Transport: otelhttp.NewTransport(http.DefaultTransport),
        }

        http.HandleFunc("/api/aggregated", func(w http.ResponseWriter, r *http.Request) {
            ctx := r.Context()

            tracer := otel.Tracer("api-gateway")
            ctx, span := tracer.Start(ctx, "aggregate-data")
            defer span.End()

            if err := callServiceA(ctx); err != nil {
                span.RecordError(err)
                http.Error(w, "upstream error", 502)
                return
            }

            w.Write([]byte(`{"status":"ok"}`))
        })

        log.Fatal(http.ListenAndServe(":8080", nil))
    }
    ```

=== "The Explanation"

    - **`otelhttp.NewTransport`**: Automatically instruments HTTP clients with tracing
    - **Span attributes**: Attach metadata to spans for filtering and analysis
    - **`span.RecordError`**: Records errors on the current span
    - **Context propagation**: Trace context flows through `context.Context`

---

## Correlation IDs

=== "The Code"

    ```go
    package main

    import (
        "context"
        "log/slog"
        "net/http"

        "github.com/google/uuid"
    )

    type correlationIDKey struct{}

    func WithCorrelationID(ctx context.Context, id string) context.Context {
        return context.WithValue(ctx, correlationIDKey{}, id)
    }

    func CorrelationIDFromContext(ctx context.Context) string {
        if id, ok := ctx.Value(correlationIDKey{}).(string); ok {
            return id
        }
        return ""
    }

    func CorrelationIDMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            id := r.Header.Get("X-Correlation-ID")
            if id == "" {
                id = uuid.New().String()
            }

            ctx := WithCorrelationID(r.Context(), id)
            w.Header().Set("X-Correlation-ID", id)

            logger := slog.Default().With(
                "correlation_id", id,
                "method", r.Method,
                "path", r.URL.Path,
            )
            ctx = context.WithValue(ctx, "logger", logger)

            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }

    func main() {
        mux := http.NewServeMux()
        mux.HandleFunc("/api/orders", func(w http.ResponseWriter, r *http.Request) {
            logger := r.Context().Value("logger").(*slog.Logger)
            logger.Info("order processed", "order_id", 12345)
            w.Write([]byte(`{"status":"ok"}`))
        })

        http.ListenAndServe(":8080", CorrelationIDMiddleware(mux))
    }
    ```

=== "The Explanation"

    - **`X-Correlation-ID`**: Propagated across service boundaries
    - **Context injection**: Correlation ID attached to every log line
    - **Request tracing**: Follow a single request across multiple services

=== "The Terminal Output"

    ```
    {"time":"2026-09-03T10:00:00Z","level":"INFO","msg":"order processed","correlation_id":"abc-123","method":"POST","path":"/api/orders","order_id":12345}
    ```

---

## SLOs, SLIs, and Golden Signals

### Golden Signals

| Signal | Description | Metric |
|---|---|---|
| **Latency** | Time to serve a request | `http_request_duration_seconds` |
| **Traffic** | Demand on the system | `http_requests_total` |
| **Errors** | Rate of failed requests | `http_requests_total{status=~"5.."}` |
| **Saturation** | Resource utilization | `process_cpu_seconds_total`, `go_memstats_alloc_bytes` |

### SLI Definition

=== "The Code"

    ```go
    package main

    import (
        "log"
        "math"
        "time"
    )

    type SLI struct {
        Name           string
        GoodEvents     int64
        TotalEvents    int64
        WindowDuration time.Duration
    }

    func (s *SLI) ErrorBudgetRemaining() float64 {
        if s.TotalEvents == 0 {
            return 100.0
        }
        sli := float64(s.GoodEvents) / float64(s.TotalEvents) * 100
        return sli
    }

    func main() {
        sli := SLI{
            Name:           "availability",
            GoodEvents:     9990,
            TotalEvents:    10000,
            WindowDuration: 30 * 24 * time.Hour,
        }

        log.Printf("SLI %s: %.4f%%", sli.Name, sli.ErrorBudgetRemaining())
        log.Printf("Error budget: %.2f%% remaining", 100.0-sli.ErrorBudgetRemaining())
    }
    ```

=== "The Explanation"

    - **SLI**: Service Level Indicator — a quantitative measure of service behavior
    - **SLO**: Service Level Objective — target value for an SLI
    - **Error budget**: How much failure is acceptable before violating the SLO

=== "The Terminal Output"

    ```
    2026/09/03 10:00:00 SLI availability: 99.9000%
    2026/09/03 10:00:00 Error budget: 0.10% remaining
    ```

---

## Best Practices

| Practice | Description | Priority |
|---|---|---|
| Use structured logging | Output JSON logs with `slog` | High |
| Include correlation IDs | Track requests across services | High |
| Expose Prometheus metrics | Enable monitoring and alerting | Critical |
| Instrument HTTP handlers | Use middleware for automatic metrics | High |
| Set log levels | Use DEBUG for dev, INFO for production | Medium |
| Define SLOs | Set measurable reliability targets | High |
| Monitor golden signals | Track latency, traffic, errors, saturation | Critical |

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Logs not appearing in JSON | Default logger not configured | Use `slog.NewJSONHandler` |
| Metrics endpoint returns 404 | promhttp not registered | Add `http.Handle("/metrics", promhttp.Handler())` |
| Traces not exported | Exporter not initialized | Check OTLP exporter configuration |
| High cardinality labels | Labels with unique values | Limit label values to bounded sets |
| Missing context fields | Context not propagated | Pass context through all function calls |
| Clock skew in traces | Different time sources | Use NTP synchronization across services |

## Summary

- `log/slog` provides structured, leveled logging with JSON and text output
- OpenTelemetry offers vendor-neutral traces, metrics, and logs
- Prometheus metrics expose counters, gauges, histograms, and summaries
- Grafana dashboards visualize golden signals and SLO compliance
- Distributed tracing tracks requests across service boundaries
- Correlation IDs enable end-to-end request tracking
- SLOs and SLIs provide measurable reliability targets

## Next Steps

- [Resilience](/docs/production/resilience.md) — Building fault-tolerant systems with observability
- [Performance](/docs/production/performance.md) — Profiling and optimizing Go applications
- [Deployment](/docs/production/deployment.md) — Deploying observable services
- [Containerization](/docs/production/containerization.md) — Container-level observability
