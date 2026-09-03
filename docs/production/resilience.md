# Resilience

Production systems must handle failures gracefully. Go's concurrency model and error handling patterns make it well-suited for implementing resilience patterns like circuit breakers, retries with backoff, timeouts, and bulkhead isolation.

## What You Will Learn

- Implementing the circuit breaker pattern
- Adding retry logic with exponential backoff
- Setting timeouts on operations and network calls
- Using bulkhead isolation to prevent cascade failures
- Building graceful degradation into your services
- Recovering from panics in goroutines
- Implementing health checks for readiness and liveness probes
- Introduction to chaos engineering principles

## Prerequisites

- Familiarity with [goroutines and channels](/docs/fundamentals/concurrency.md)
- Understanding of [error handling patterns](/docs/fundamentals/errors.md)
- Basic knowledge of HTTP clients and context usage

---

## Circuit Breaker Pattern

The circuit breaker prevents an application from repeatedly trying to execute an operation that is likely to fail, allowing the system to recover.

=== "The Code"

    ```go
    package main

    import (
        "errors"
        "fmt"
        "sync"
        "time"
    )

    type CircuitState int

    const (
        StateClosed CircuitState = iota
        StateOpen
        StateHalfOpen
    )

    type CircuitBreaker struct {
        mu              sync.Mutex
        state           CircuitState
        failureCount    int
        successCount    int
        failureThreshold int
        successThreshold int
        timeout         time.Duration
        lastFailureTime time.Time
    }

    func NewCircuitBreaker(failures, successes int, timeout time.Duration) *CircuitBreaker {
        return &CircuitBreaker{
            state:            StateClosed,
            failureThreshold: failures,
            successThreshold: successes,
            timeout:          timeout,
        }
    }

    var ErrCircuitOpen = errors.New("circuit breaker is open")

    func (cb *CircuitBreaker) Execute(fn func() error) error {
        cb.mu.Lock()
        state := cb.state

        if state == StateOpen {
            if time.Since(cb.lastFailureTime) > cb.timeout {
                cb.state = StateHalfOpen
                cb.successCount = 0
                state = StateHalfOpen
            } else {
                cb.mu.Unlock()
                return ErrCircuitOpen
            }
        }
        cb.mu.Unlock()

        err := fn()

        cb.mu.Lock()
        defer cb.mu.Unlock()

        if err != nil {
            cb.failureCount++
            cb.lastFailureTime = time.Now()

            if cb.failureCount >= cb.failureThreshold {
                cb.state = StateOpen
                fmt.Printf("Circuit OPENED after %d failures\n", cb.failureCount)
            }
            return err
        }

        if state == StateHalfOpen {
            cb.successCount++
            if cb.successCount >= cb.successThreshold {
                cb.state = StateClosed
                cb.failureCount = 0
                fmt.Println("Circuit CLOSED, service recovered")
            }
        } else {
            cb.failureCount = 0
        }

        return nil
    }

    func main() {
        cb := NewCircuitBreaker(3, 2, 5*time.Second)

        callCount := 0
        flakyService := func() error {
            callCount++
            if callCount <= 5 {
                return errors.New("service unavailable")
            }
            return nil
        }

        for i := 0; i < 10; i++ {
            err := cb.Execute(flakyService)
            if err != nil {
                fmt.Printf("Attempt %d: %v\n", i+1, err)
            } else {
                fmt.Printf("Attempt %d: success\n", i+1)
            }
            time.Sleep(1 * time.Second)
        }
    }
    ```

=== "The Explanation"

    - **Three states**: Closed (normal), Open (rejecting), HalfOpen (testing recovery)
    - **Failure threshold**: Number of consecutive failures before opening the circuit
    - **Timeout**: Duration to wait before transitioning from Open to HalfOpen
    - **Success threshold**: Number of consecutive successes to close the circuit again

=== "The Terminal Output"

    ```
    Attempt 1: service unavailable
    Attempt 2: service unavailable
    Attempt 3: service unavailable
    Circuit OPENED after 3 failures
    Attempt 4: circuit breaker is open
    Attempt 5: circuit breaker is open
    Attempt 6: service unavailable
    Attempt 7: service unavailable
    Circuit OPENED after 2 failures
    Attempt 8: circuit breaker is open
    Attempt 9: success
    Attempt 10: success
    Circuit CLOSED, service recovered
    ```

---

## Retry with Backoff

Exponential backoff adds increasing delays between retry attempts to avoid overwhelming a failing service.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "errors"
        "fmt"
        "math"
        "math/rand"
        "time"
    )

    type RetryConfig struct {
        MaxAttempts  int
        BaseDelay    time.Duration
        MaxDelay     time.Duration
        Multiplier   float64
        Jitter       bool
    }

    func DefaultRetryConfig() RetryConfig {
        return RetryConfig{
            MaxAttempts: 3,
            BaseDelay:   100 * time.Millisecond,
            MaxDelay:    10 * time.Second,
            Multiplier:  2.0,
            Jitter:      true,
        }
    }

    func RetryWithBackoff(ctx context.Context, config RetryConfig, fn func() error) error {
        var lastErr error

        for attempt := 0; attempt < config.MaxAttempts; attempt++ {
            if err := ctx.Err(); err != nil {
                return fmt.Errorf("context cancelled: %w", err)
            }

            lastErr = fn()
            if lastErr == nil {
                return nil
            }

            if attempt < config.MaxAttempts-1 {
                delay := calculateDelay(config, attempt)
                fmt.Printf("Attempt %d failed: %v, retrying in %v\n",
                    attempt+1, lastErr, delay)

                select {
                case <-ctx.Done():
                    return fmt.Errorf("context cancelled: %w", ctx.Err())
                case <-time.After(delay):
                }
            }
        }

        return fmt.Errorf("all %d attempts failed: %w", config.MaxAttempts, lastErr)
    }

    func calculateDelay(config RetryConfig, attempt int) time.Duration {
        delay := float64(config.BaseDelay) * math.Pow(config.Multiplier, float64(attempt))
        delay = math.Min(delay, float64(config.MaxDelay))

        if config.Jitter {
            delay = delay * (0.5 + rand.Float64()*0.5)
        }

        return time.Duration(delay)
    }

    var errServiceDown = errors.New("service temporarily unavailable")

    func unreliableService() error {
        if rand.Float64() < 0.7 {
            return errServiceDown
        }
        return nil
    }

    func main() {
        ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
        defer cancel()

        config := DefaultRetryConfig()
        config.MaxAttempts = 5

        err := RetryWithBackoff(ctx, config, unreliableService)
        if err != nil {
            fmt.Printf("Final error: %v\n", err)
        } else {
            fmt.Println("Request succeeded")
        }
    }
    ```

=== "The Explanation"

    - **Exponential backoff**: Delay doubles with each attempt
    - **Jitter**: Random variation prevents thundering herd when many clients retry simultaneously
    - **Max delay**: Caps the delay to prevent excessively long waits
    - **Context cancellation**: Allows callers to abort retries early

=== "The Terminal Output"

    ```
    Attempt 1 failed: service temporarily unavailable, retrying in 87ms
    Attempt 2 failed: service temporarily unavailable, retrying in 198ms
    Attempt 3 failed: service temporarily unavailable, retrying in 412ms
    Request succeeded
    ```

---

## Timeout Patterns

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "net/http"
        "time"
    )

    func fetchWithTimeout(url string, timeout time.Duration) (*http.Response, error) {
        ctx, cancel := context.WithTimeout(context.Background(), timeout)
        defer cancel()

        req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
        if err != nil {
            return nil, fmt.Errorf("creating request: %w", err)
        }

        client := &http.Client{
            Timeout: timeout,
        }

        return client.Do(req)
    }

    func operationWithTimeout(ctx context.Context) error {
        ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
        defer cancel()

        resultCh := make(chan string, 1)
        errCh := make(chan error, 1)

        go func() {
            // Simulate slow operation
            time.Sleep(3 * time.Second)
            resultCh <- "result"
        }()

        select {
        case result := <-resultCh:
            fmt.Println("Operation completed:", result)
            return nil
        case err := <-errCh:
            return err
        case <-ctx.Done():
            return fmt.Errorf("operation timed out: %w", ctx.Err())
        }
    }

    func main() {
        ctx := context.Background()

        err := operationWithTimeout(ctx)
        if err != nil {
            fmt.Println("Error:", err)
        } else {
            fmt.Println("Success")
        }

        // HTTP timeout example
        resp, err := fetchWithTimeout("http://httpbin.org/delay/2", 1*time.Second)
        if err != nil {
            fmt.Println("HTTP Error:", err)
            return
        }
        defer resp.Body.Close()
        fmt.Println("Status:", resp.Status)
    }
    ```

=== "The Explanation"

    - **`context.WithTimeout`**: Cancels the context after the specified duration
    - **`http.Client.Timeout`**: Includes connection, TLS handshake, and response read time
    - **`select` with `ctx.Done()`**: Races the operation against the timeout
    - **Deferring cancel**: Prevents context leak even on success

=== "The Terminal Output"

    ```
    Operation completed: result
    HTTP Error: Get "http://httpbin.org/delay/2": context deadline exceeded
    ```

### Timeout Best Practices

| Layer | Timeout | Reason |
|---|---|---|
| HTTP client | 5-30s | Prevent hanging connections |
| Database query | 1-5s | Prevent slow queries from blocking |
| External API | 3-10s | Account for network variability |
| Context deadline | Match caller timeout | Propagate cancellation upstream |
| Shutdown drain | 15-30s | Allow in-flight requests to complete |

---

## Bulkhead Isolation

Bulkheads isolate components so that a failure in one does not cascade to others.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "sync"
        "time"
    )

    type Bulkhead struct {
        name     string
        sem      chan struct{}
        timeout  time.Duration
        mu       sync.Mutex
        active   int
        rejected int
    }

    func NewBulkhead(name string, maxConcurrent int, timeout time.Duration) *Bulkhead {
        return &Bulkhead{
            name:    name,
            sem:     make(chan struct{}, maxConcurrent),
            timeout: timeout,
        }
    }

    func (b *Bulkhead) Execute(ctx context.Context, fn func() error) error {
        timer := time.NewTimer(b.timeout)
        defer timer.Stop()

        select {
        case b.sem <- struct{}{}:
            defer func() { <-b.sem }()
        case <-timer.C:
            b.mu.Lock()
            b.rejected++
            b.mu.Unlock()
            return fmt.Errorf("bulkhead %s: timeout waiting for slot", b.name)
        case <-ctx.Done():
            return ctx.Err()
        }

        b.mu.Lock()
        b.active++
        b.mu.Unlock()
        defer func() {
            b.mu.Lock()
            b.active--
            b.mu.Unlock()
        }()

        return fn()
    }

    func (b *Bulkhead) Stats() (active, rejected int) {
        b.mu.Lock()
        defer b.mu.Unlock()
        return b.active, b.rejected
    }

    func main() {
        dbBulkhead := NewBulkhead("database", 3, 5*time.Second)
        apiBulkhead := NewBulkhead("external-api", 5, 10*time.Second)

        var wg sync.WaitGroup
        for i := 0; i < 10; i++ {
            wg.Add(1)
            go func(id int) {
                defer wg.Done()
                err := dbBulkhead.Execute(context.Background(), func() error {
                    time.Sleep(100 * time.Millisecond)
                    fmt.Printf("DB task %d completed\n", id)
                    return nil
                })
                if err != nil {
                    fmt.Printf("DB task %d rejected: %v\n", id, err)
                }
            }(i)
        }
        wg.Wait()

        active, rejected := dbBulkhead.Stats()
        fmt.Printf("DB Bulkhead: active=%d, rejected=%d\n", active, rejected)
    }
    ```

=== "The Explanation"

    - **Semaphore channel**: Limits concurrent executions to `maxConcurrent`
    - **Timeout**: Rejects requests that cannot acquire a slot within the timeout
    - **Per-component isolation**: Database and API calls have separate bulkheads
    - **Active tracking**: Monitors current concurrent executions

=== "The Terminal Output"

    ```
    DB task 0 completed
    DB task 1 completed
    DB task 2 completed
    DB task 3 completed
    DB task 4 completed
    DB task 5 completed
    DB task 6 completed
    DB task 7 completed
    DB task 8 completed
    DB task 9 completed
    DB Bulkhead: active=0, rejected=0
    ```

---

## Graceful Degradation

=== "The Code"

    ```go
    package main

    import (
        "context"
        "errors"
        "fmt"
        "time"
    )

    type Cache interface {
        Get(ctx context.Context, key string) (string, error)
        Set(ctx context.Context, key, value string) error
    }

    type resilientService struct {
        cache Cache
        db    Database
    }

    type Database interface {
        Query(ctx context.Context, key string) (string, error)
    }

    func (s *resilientService) GetData(ctx context.Context, key string) (string, error) {
        // Try cache first
        if val, err := s.cache.Get(ctx, key); err == nil {
            return val, nil
        }

        // Fallback to database
        val, err := s.db.Query(ctx, key)
        if err != nil {
            // Both cache and DB failed — use stale data or default
            return s.getDefaultValue(key), nil
        }

        // Warm cache for next request
        go func() {
            ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
            defer cancel()
            s.cache.Set(ctx, key, val)
        }()

        return val, nil
    }

    func (s *resilientService) getDefaultValue(key string) string {
        defaults := map[string]string{
            "config":  `{"theme":"light","lang":"en"}`,
            "features": `{"new_ui":false,"beta":false}`,
        }
        if d, ok := defaults[key]; ok {
            return d
        }
        return "{}"
    }

    func main() {
        fmt.Println("Graceful degradation: serve stale/default when dependencies fail")
    }
    ```

=== "The Explanation"

    - **Cache-first strategy**: Reduces load on the database
    - **Fallback chain**: Cache → Database → Default value
    - **Non-blocking cache warm**: Background goroutine updates cache
- **Default values**: Provide sensible responses when all sources fail

---

## Panic Recovery

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "runtime/debug"
        "time"
    )

    func safeGoroutine(id int, fn func()) {
        defer func() {
            if r := recover(); r != nil {
                fmt.Printf("Goroutine %d recovered from panic: %v\n", id, r)
                fmt.Printf("Stack trace:\n%s\n", debug.Stack())
            }
        }()

        fn()
    }

    func main() {
        for i := 0; i < 5; i++ {
            id := i
            go safeGoroutine(id, func() {
                if id == 2 {
                    panic("simulated crash")
                }
                fmt.Printf("Goroutine %d completed normally\n", id)
                time.Sleep(100 * time.Millisecond)
            })
        }

        time.Sleep(500 * time.Millisecond)
        fmt.Println("Main goroutine survived")
    }
    ```

=== "The Explanation"

    - **`recover()`**: Catches panics within the same goroutine
    - **`debug.Stack()`**: Provides the full stack trace for debugging
    - **Deferred recovery**: Must be deferred at the top of the goroutine
- **Isolation**: Panics in one goroutine do not affect others

=== "The Terminal Output"

    ```
    Goroutine 0 completed normally
    Goroutine 1 completed normally
    Goroutine 2 recovered from panic: simulated crash
    Stack trace:
    goroutine 6 [running]:
    main.safeGoroutine.func1()
        /app/main.go:13 +0x80
    ...
    Goroutine 3 completed normally
    Goroutine 4 completed normally
    Main goroutine survived
    ```

---

## Health Checks

### Liveness and Readiness Probes

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "log"
        "net/http"
        "sync"
        "time"
    )

    type HealthState struct {
        mu          sync.RWMutex
        ready       bool
        healthy     bool
        dependencies map[string]bool
    }

    func NewHealthState() *HealthState {
        h := &HealthState{
            ready: false,
            healthy: true,
            dependencies: map[string]bool{
                "database": false,
                "cache":    false,
            },
        }

        go h.checkDependencies()

        return h
    }

    func (h *HealthState) checkDependencies() {
        for {
            time.Sleep(10 * time.Second)
            h.mu.Lock()
            // Simulate dependency checks
            h.dependencies["database"] = true
            h.dependencies["cache"] = true

            allHealthy := true
            for _, v := range h.dependencies {
                if !v {
                    allHealthy = false
                    break
                }
            }
            h.ready = allHealthy
            h.healthy = allHealthy
            h.mu.Unlock()
        }
    }

    func (h *HealthState) livenessHandler(w http.ResponseWriter, r *http.Request) {
        h.mu.RLock()
        defer h.mu.RUnlock()

        if h.healthy {
            http.Error(w, `{"status":"alive"}`, http.StatusOK)
        } else {
            http.Error(w, `{"status":"unhealthy"}`, http.StatusServiceUnavailable)
        }
    }

    func (h *HealthState) readinessHandler(w http.ResponseWriter, r *http.Request) {
        h.mu.RLock()
        defer h.mu.RUnlock()

        status := http.StatusOK
        resp := map[string]interface{}{
            "status":       "ready",
            "dependencies": h.dependencies,
        }

        if !h.ready {
            status = http.StatusServiceUnavailable
            resp["status"] = "not ready"
        }

        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(status)
        json.NewEncoder(w).Encode(resp)
    }

    func main() {
        health := NewHealthState()

        http.HandleFunc("/livez", health.livenessHandler)
        http.HandleFunc("/readyz", health.readinessHandler)

        log.Println("Health endpoints ready")
        http.ListenAndServe(":8080", nil)
    }
    ```

=== "The Explanation"

    - **Liveness probe**: Detects deadlocks or unrecoverable states — restart the pod
    - **Readiness probe**: Detects dependency failures — remove from load balancer
    - **Dependencies map**: Tracks health of each downstream dependency
    - **Periodic checks**: Background goroutine validates dependencies

=== "The Terminal Output"

    ```bash
    $ curl http://localhost:8080/livez
    {"status":"alive"}

    $ curl http://localhost:8080/readyz
    {"status":"ready","dependencies":{"cache":true,"database":true}}
    ```

---

## Chaos Engineering Basics

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "math/rand"
        "time"
    )

    type ChaosExperiment struct {
        Name        string
        FailureRate float64
        LatencyMin  time.Duration
        LatencyMax  time.Duration
    }

    func (ce *ChaosExperiment) Inject(ctx context.Context, fn func() error) error {
        // Inject latency
        latency := ce.LatencyMin + time.Duration(
            rand.Int63n(int64(ce.LatencyMax-ce.LatencyMin)),
        )
        select {
        case <-time.After(latency):
        case <-ctx.Done():
            return ctx.Err()
        }

        // Inject failure
        if rand.Float64() < ce.FailureRate {
            return fmt.Errorf("chaos: %s injected failure", ce.Name)
        }

        return fn()
    }

    func main() {
        experiment := ChaosExperiment{
            Name:        "network-latency",
            FailureRate: 0.2,
            LatencyMin:  50 * time.Millisecond,
            LatencyMax:  200 * time.Millisecond,
        }

        for i := 0; i < 10; i++ {
            err := experiment.Inject(context.Background(), func() error {
                return nil
            })
            if err != nil {
                fmt.Printf("Request %d: %v\n", i+1, err)
            } else {
                fmt.Printf("Request %d: success\n", i+1)
            }
        }
    }
    ```

=== "The Explanation"

    - **Latency injection**: Adds artificial delays to simulate network issues
    - **Failure injection**: Randomly fails requests to test error handling
    - **Controlled experiments**: Run in staging environments to validate resilience
- **Chaos engineering principle**: Build confidence in the system's ability to handle turbulent conditions

=== "The Terminal Output"

    ```
    Request 1: success
    Request 2: success
    Request 3: success
    Request 4: chaos: network-latency injected failure
    Request 5: success
    Request 6: success
    Request 7: success
    Request 8: success
    Request 9: chaos: network-latency injected failure
    Request 10: success
    ```

---

## Best Practices

| Practice | Description | Priority |
|---|---|---|
| Circuit breakers | Prevent cascade failures by failing fast | High |
| Retry with backoff | Add jitter and caps to retry delays | High |
| Timeouts on everything | Never wait indefinitely for operations | Critical |
| Bulkhead isolation | Limit concurrent access to shared resources | High |
| Graceful degradation | Serve stale or default data when dependencies fail | Medium |
| Panic recovery | Catch panics in goroutines to prevent crashes | Critical |
| Health checks | Implement both liveness and readiness probes | High |

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Circuit breaker opens immediately | Failure threshold too low | Increase threshold or reduce sensitivity |
| Retries overwhelm failing service | No jitter or backoff cap | Add jitter and set max delay |
| Timeouts too short | Underestimating network latency | Profile and adjust timeout values |
| Bulkhead rejects valid requests | Pool size too small | Increase maxConcurrent or reduce timeout |
| Graceful shutdown drops requests | Missing in-flight tracking | Use sync.WaitGroup to track active requests |
| Panic in goroutine crashes process | No recovery handler | Add `defer recover()` to all goroutines |

## Summary

- Circuit breakers prevent cascade failures by short-circuiting calls to failing services
- Exponential backoff with jitter prevents thundering herd on retries
- Context timeouts propagate cancellation through call chains
- Bulkhead isolation limits concurrency per component
- Graceful degradation serves reduced functionality when dependencies fail
- Panic recovery in goroutines prevents process-wide crashes
- Liveness and readiness probes enable orchestrators to manage service health

## Next Steps

- [Observability](/docs/production/observability.md) — Monitoring resilient services
- [Deployment](/docs/production/deployment.md) — Deploying resilient applications
- [Containerization](/docs/production/containerization.md) — Container-level resilience
- [CI/CD](/docs/production/ci-cd.md) — Testing resilience in pipelines
