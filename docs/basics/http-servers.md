# HTTP Servers

Go's standard library provides a powerful and efficient HTTP server implementation. The `net/http` package enables building production-ready web servers with minimal boilerplate, while supporting advanced patterns like middleware, context handling, and graceful shutdown.

## What You Will Learn

- Setting up HTTP servers with `net/http` and `http.ListenAndServe`
- Working with `http.HandlerFunc` and `http.ServeMux` for request handling
- Managing request and response objects effectively
- Implementing middleware patterns for cross-cutting concerns
- Leveraging Go 1.22+ enhanced routing capabilities
- Performing graceful shutdown for production servers
- Using context for request lifecycle management
- Building health check endpoints

## Prerequisites

- Understanding of Go functions and interfaces
- Familiarity with structs and methods
- Basic knowledge of HTTP protocol concepts

---

## The net/http Package

Go's `net/http` package provides both client and server implementations for HTTP communication.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "net/http"
    )

    // Simple HTTP handler
    func helloHandler(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Hello, World!")
    }

    // Handler with path parameter
    func greetHandler(w http.ResponseWriter, r *http.Request) {
        name := r.URL.Query().Get("name")
        if name == "" {
            name = "Guest"
        }
        fmt.Fprintf(w, "Hello, %s!", name)
    }

    func main() {
        // Register handlers
        http.HandleFunc("/", helloHandler)
        http.HandleFunc("/greet", greetHandler)

        // Start server
        fmt.Println("Server starting on :8080...")
        log.Fatal(http.ListenAndServe(":8080", nil))
    }
    ```

=== "The Explanation"

    - **`http.HandleFunc`**: Registers a function to handle HTTP requests for a pattern
    - **`http.ResponseWriter`**: Interface for writing HTTP responses
    - **`*http.Request`**: Struct containing the incoming HTTP request
    - **`http.ListenAndServe`**: Starts an HTTP server on the specified address
    - **`nil` handler**: Uses the default `http.DefaultServeMux` router

=== "The Terminal Output"

    ```
    Server starting on :8080...
    # In another terminal:
    # curl http://localhost:8080/
    # Hello, World!
    # curl http://localhost:8080/greet?name=Alice
    # Hello, Alice!
    ```

---

## http.ListenAndServe

The `ListenAndServe` function starts an HTTP server and blocks until the server stops.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "net/http"
        "time"
    )

    func indexHandler(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Welcome to the Go HTTP Server!")
    }

    func timeHandler(w http.ResponseWriter, r *http.Request) {
        currentTime := time.Now().Format("2006-01-02 15:04:05")
        fmt.Fprintf(w, "Current time: %s", currentTime)
    }

    func main() {
        mux := http.NewServeMux()
        mux.HandleFunc("/", indexHandler)
        mux.HandleFunc("/time", timeHandler)

        // Server configuration
        server := &http.Server{
            Addr:         ":8080",
            Handler:      mux,
            ReadTimeout:  15 * time.Second,
            WriteTimeout: 15 * time.Second,
            IdleTimeout:  60 * time.Second,
        }

        fmt.Printf("Server listening on %s\n", server.Addr)
        log.Fatal(server.ListenAndServe())
    }
    ```

=== "The Explanation"

    - **`http.NewServeMux()`**: Creates a new request multiplexer (router)
    - **`http.Server`**: Struct for configuring server behavior
    - **`ReadTimeout`**: Maximum duration for reading the entire request
    - **`WriteTimeout`**: Maximum duration before timing out writes
    - **`IdleTimeout`**: Maximum time to wait for the next request

=== "The Terminal Output"

    ```
    Server listening on :8080
    # In another terminal:
    # curl http://localhost:8080/
    # Welcome to the Go HTTP Server!
    # curl http://localhost:8080/time
    # Current time: 2026-09-03 12:00:00
    ```

---

## http.HandlerFunc

`HandlerFunc` adapts ordinary functions to the `http.Handler` interface.

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "fmt"
        "log"
        "net/http"
    )

    // Custom handler function type
    type AppHandler func(http.ResponseWriter, *http.Request) error

    // Error-handling wrapper
    func (fn AppHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
        if err := fn(w, r); err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
        }
    }

    // Handlers returning errors
    func usersHandler(w http.ResponseWriter, r *http.Request) error {
        users := []map[string]string{
            {"id": "1", "name": "Alice"},
            {"id": "2", "name": "Bob"},
        }
        w.Header().Set("Content-Type", "application/json")
        return json.NewEncoder(w).Encode(users)
    }

    func healthHandler(w http.ResponseWriter, r *http.Request) error {
        response := map[string]string{"status": "healthy"}
        w.Header().Set("Content-Type", "application/json")
        return json.NewEncoder(w).Encode(response)
    }

    func main() {
        mux := http.NewServeMux()

        // Register error-handling handlers
        mux.Handle("/users", AppHandler(usersHandler))
        mux.Handle("/health", AppHandler(healthHandler))

        fmt.Println("Server starting on :8080...")
        log.Fatal(http.ListenAndServe(":8080", mux))
    }
    ```

=== "The Explanation"

    - **`http.Handler` interface**: Defines `ServeHTTP(ResponseWriter, *Request)` method
    - **`http.HandlerFunc`**: Adapter type that implements `http.Handler`
    - **Custom handler type**: Create application-specific handler patterns
    - **Error propagation**: Handle errors uniformly across handlers
    - **JSON responses**: Use `json.NewEncoder` for efficient encoding

=== "The Terminal Output"

    ```
    Server starting on :8080...
    # In another terminal:
    # curl http://localhost:8080/users
    # [{"id":"1","name":"Alice"},{"id":"2","name":"Bob"}]
    # curl http://localhost:8080/health
    # {"status":"healthy"}
    ```

---

## http.ServeMux

`ServeMux` is an HTTP request multiplexer that routes requests to handlers based on URL patterns.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "net/http"
        "strings"
    )

    func main() {
        mux := http.NewServeMux()

        // Exact path matching
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Home Page")
        })

        mux.HandleFunc("/about", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "About Page")
        })

        // Pattern matching with wildcards
        mux.HandleFunc("/users/", func(w http.ResponseWriter, r *http.Request) {
            path := strings.TrimPrefix(r.URL.Path, "/users/")
            fmt.Fprintf(w, "User profile: %s", path)
        })

        // Subtree matching
        mux.Handle("/static/", http.StripPrefix("/static/",
            http.FileServer(http.Dir("./static"))))

        // Method-based routing
        mux.HandleFunc("/api/data", func(w http.ResponseWriter, r *http.Request) {
            switch r.Method {
            case http.MethodGet:
                fmt.Fprintf(w, "GET: Fetching data")
            case http.MethodPost:
                fmt.Fprintf(w, "POST: Creating data")
            case http.MethodPut:
                fmt.Fprintf(w, "PUT: Updating data")
            case http.MethodDelete:
                fmt.Fprintf(w, "DELETE: Deleting data")
            default:
                http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
            }
        })

        fmt.Println("Server starting on :8080...")
        log.Fatal(http.ListenAndServe(":8080", mux))
    }
    ```

=== "The Explanation"

    - **Exact patterns**: `/about` matches only `/about`
    - **Trailing slash**: `/users/` matches `/users/anything`
    - **`http.StripPrefix`**: Removes prefix before passing to handler
    - **`http.FileServer`**: Serves static files from a directory
    - **Method checking**: Use `r.Method` for method-based routing

=== "The Terminal Output"

    ```
    Server starting on :8080...
    # In another terminal:
    # curl http://localhost:8080/
    # Home Page
    # curl http://localhost:8080/about
    # About Page
    # curl http://localhost:8080/users/alice
    # User profile: alice
    ```

---

## Request and Response

Working with HTTP requests and responses effectively is crucial for building robust servers.

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "fmt"
        "io"
        "log"
        "net/http"
    )

    type RequestInfo struct {
        Method  string              `json:"method"`
        URL     string              `json:"url"`
        Headers map[string][]string `json:"headers"`
        Body    string              `json:"body,omitempty"`
    }

    func requestInfoHandler(w http.ResponseWriter, r *http.Request) {
        // Read request body
        body, err := io.ReadAll(r.Body)
        if err != nil {
            http.Error(w, "Error reading body", http.StatusBadRequest)
            return
        }
        defer r.Body.Close()

        // Build response
        info := RequestInfo{
            Method:  r.Method,
            URL:     r.URL.String(),
            Headers: r.Header,
            Body:    string(body),
        }

        // Set response headers
        w.Header().Set("Content-Type", "application/json")
        w.Header().Set("X-Custom-Header", "Go-Server")

        // Write JSON response
        json.NewEncoder(w).Encode(info)
    }

    func queryHandler(w http.ResponseWriter, r *http.Request) {
        // Parse query parameters
        name := r.URL.Query().Get("name")
        page := r.URL.Query().Get("page")

        // Parse form data
        r.ParseForm()
        fmt.Println("Form values:", r.PostForm)

        response := map[string]string{
            "name": name,
            "page": page,
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(response)
    }

    func main() {
        http.HandleFunc("/request-info", requestInfoHandler)
        http.HandleFunc("/query", queryHandler)

        fmt.Println("Server starting on :8080...")
        log.Fatal(http.ListenAndServe(":8080", nil))
    }
    ```

=== "The Explanation"

    - **`r.Body`**: Read request body (always close with `defer`)
    - **`io.ReadAll`**: Read entire body into byte slice
    - **`r.Header`**: Access request headers as map
    - **`r.URL.Query()`**: Parse URL query parameters
    - **`r.ParseForm()`**: Parse form data from POST/PUT requests
    - **Response headers**: Set before writing body

=== "The Terminal Output"

    ```
    Server starting on :8080...
    # In another terminal:
    # curl -X POST http://localhost:8080/request-info \
    #   -H "Content-Type: application/json" \
    #   -d '{"message": "hello"}'
    # {"method":"POST","url":"/request-info","headers":...,"body":"{\"message\": \"hello\"}"}
    # curl "http://localhost:8080/query?name=Alice&page=2"
    # {"name":"Alice","page":"2"}
    ```

---

## Middleware Pattern

Middleware provides a way to compose reusable functionality around handlers.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "net/http"
        "time"
    )

    // Middleware type
    type Middleware func(http.Handler) http.Handler

    // Logging middleware
    func LoggingMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            log.Printf("Started %s %s", r.Method, r.URL.Path)

            next.ServeHTTP(w, r)

            log.Printf("Completed %s %s in %v",
                r.Method, r.URL.Path, time.Since(start))
        })
    }

    // Authentication middleware
    func AuthMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            token := r.Header.Get("Authorization")
            if token == "" {
                http.Error(w, "Unauthorized", http.StatusUnauthorized)
                return
            }
            // Validate token...
            next.ServeHTTP(w, r)
        })
    }

    // CORS middleware
    func CORSMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Access-Control-Allow-Origin", "*")
            w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
            w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

            if r.Method == "OPTIONS" {
                w.WriteHeader(http.StatusOK)
                return
            }

            next.ServeHTTP(w, r)
        })
    }

    // Chain middlewares
    func Chain(handler http.Handler, middlewares ...Middleware) http.Handler {
        for i := len(middlewares) - 1; i >= 0; i-- {
            handler = middlewares[i](handler)
        }
        return handler
    }

    func main() {
        mux := http.NewServeMux()

        // Public routes
        mux.HandleFunc("/public", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Public endpoint")
        })

        // Protected routes
        protected := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Protected endpoint")
        })
        mux.Handle("/protected", AuthMiddleware(protected))

        // Chain all middlewares
        handler := Chain(mux, LoggingMiddleware, CORSMiddleware)

        fmt.Println("Server starting on :8080...")
        log.Fatal(http.ListenAndServe(":8080", handler))
    }
    ```

=== "The Explanation"

    - **Middleware type**: Function that wraps `http.Handler` with additional behavior
    - **Chaining**: Apply multiple middlewares in sequence
    - **Order matters**: Middlewares execute in the order they're applied
    - **Common uses**: Logging, authentication, CORS, rate limiting
    - **Short-circuit**: Middleware can stop execution (e.g., unauthorized)

=== "The Terminal Output"

    ```
    Server starting on :8080...
    # In another terminal:
    # curl http://localhost:8080/public
    # Public endpoint
    # 2026/09/03 12:00:00 Started GET /public
    # 2026/09/03 12:00:00 Completed GET /public in 1.234ms
    # curl http://localhost:8080/protected
    # Unauthorized
    # curl http://localhost:8080/protected -H "Authorization: Bearer token123"
    # Protected endpoint
    ```

---

## Routing: Go 1.22+ Enhanced Routing

Go 1.22 introduced enhanced routing with method-based and path parameter support.

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "fmt"
        "log"
        "net/http"
        "strconv"
    )

    type User struct {
        ID    int    `json:"id"`
        Name  string `json:"name"`
        Email string `json:"email"`
    }

    var users = map[int]User{
        1: {ID: 1, Name: "Alice", Email: "alice@example.com"},
        2: {ID: 2, Name: "Bob", Email: "bob@example.com"},
    }

    func main() {
        mux := http.NewServeMux()

        // Go 1.22+ method-based routing
        mux.HandleFunc("GET /api/users", listUsers)
        mux.HandleFunc("GET /api/users/{id}", getUser)
        mux.HandleFunc("POST /api/users", createUser)
        mux.HandleFunc("PUT /api/users/{id}", updateUser)
        mux.HandleFunc("DELETE /api/users/{id}", deleteUser)

        // Path parameters
        mux.HandleFunc("GET /api/users/{id}/posts", getUserPosts)

        fmt.Println("Server starting on :8080...")
        log.Fatal(http.ListenAndServe(":8080", mux))
    }

    func listUsers(w http.ResponseWriter, r *http.Request) {
        userList := make([]User, 0, len(users))
        for _, u := range users {
            userList = append(userList, u)
        }
        json.NewEncoder(w).Encode(userList)
    }

    func getUser(w http.ResponseWriter, r *http.Request) {
        id, _ := strconv.Atoi(r.PathValue("id"))
        user, ok := users[id]
        if !ok {
            http.Error(w, "User not found", http.StatusNotFound)
            return
        }
        json.NewEncoder(w).Encode(user)
    }

    func createUser(w http.ResponseWriter, r *http.Request) {
        var user User
        if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
            http.Error(w, "Invalid request body", http.StatusBadRequest)
            return
        }
        user.ID = len(users) + 1
        users[user.ID] = user
        w.WriteHeader(http.StatusCreated)
        json.NewEncoder(w).Encode(user)
    }

    func updateUser(w http.ResponseWriter, r *http.Request) {
        id, _ := strconv.Atoi(r.PathValue("id"))
        if _, ok := users[id]; !ok {
            http.Error(w, "User not found", http.StatusNotFound)
            return
        }
        var user User
        if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
            http.Error(w, "Invalid request body", http.StatusBadRequest)
            return
        }
        user.ID = id
        users[id] = user
        json.NewEncoder(w).Encode(user)
    }

    func deleteUser(w http.ResponseWriter, r *http.Request) {
        id, _ := strconv.Atoi(r.PathValue("id"))
        if _, ok := users[id]; !ok {
            http.Error(w, "User not found", http.StatusNotFound)
            return
        }
        delete(users, id)
        w.WriteHeader(http.StatusNoContent)
    }

    func getUserPosts(w http.ResponseWriter, r *http.Request) {
        id, _ := strconv.Atoi(r.PathValue("id"))
        fmt.Fprintf(w, "Posts for user %d", id)
    }
    ```

=== "The Explanation"

    - **`"GET /path"`**: Method-based routing (Go 1.22+)
    - **`{id}`**: Path parameter syntax (Go 1.22+)
    - **`r.PathValue("id")`**: Extract path parameter value
    - **REST patterns**: Naturally express CRUD operations
    - **Type conversion**: Convert path values to appropriate types

=== "The Terminal Output"

    ```
    Server starting on :8080...
    # In another terminal:
    # curl http://localhost:8080/api/users
    # [{"id":1,"name":"Alice","email":"alice@example.com"},...]
    # curl http://localhost:8080/api/users/1
    # {"id":1,"name":"Alice","email":"alice@example.com"}
    # curl -X POST http://localhost:8080/api/users \
    #   -H "Content-Type: application/json" \
    #   -d '{"name":"Charlie","email":"charlie@example.com"}'
    # {"id":3,"name":"Charlie","email":"charlie@example.com"}
    ```

---

## Graceful Shutdown

Graceful shutdown ensures the server completes in-flight requests before stopping.

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
            time.Sleep(2 * time.Second) // Simulate slow request
            fmt.Fprintf(w, "Request completed")
        })

        server := &http.Server{
            Addr:    ":8080",
            Handler: mux,
        }

        // Channel to receive OS signals
        quit := make(chan os.Signal, 1)
        signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

        // Start server in goroutine
        go func() {
            fmt.Println("Server starting on :8080...")
            if err := server.ListenAndServe(); err != http.ErrServerClosed {
                log.Fatalf("Server error: %v", err)
            }
        }()

        // Wait for interrupt signal
        sig := <-quit
        fmt.Printf("Received signal: %v\n", sig)
        fmt.Println("Shutting down server...")

        // Create context with timeout
        ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
        defer cancel()

        // Shutdown gracefully
        if err := server.Shutdown(ctx); err != nil {
            log.Fatalf("Server forced to shutdown: %v", err)
        }

        fmt.Println("Server stopped gracefully")
    }
    ```

=== "The Explanation"

    - **`os.Signal` channel**: Receives OS signals (SIGINT, SIGTERM)
    - **`signal.Notify`**: Registers for specific signals
    - **`server.Shutdown(ctx)`**: Gracefully shuts down the server
    - **Context timeout**: Maximum time to wait for in-flight requests
    - **`http.ErrServerClosed`**: Expected error after shutdown

=== "The Terminal Output"

    ```
    Server starting on :8080...
    # Press Ctrl+C
    # Received signal: interrupt
    # Shutting down server...
    # Server stopped gracefully
    ```

---

## Context in HTTP Handlers

Context provides request-scoped values, cancellation, and timeout control.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "encoding/json"
        "fmt"
        "log"
        "net/http"
        "time"
    )

    type contextKey string

    const (
        requestIDKey contextKey = "requestID"
        userIDKey    contextKey = "userID"
    )

    // Middleware to add context values
    func ContextMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ctx := context.WithValue(r.Context(), requestIDKey, "req-123")
            ctx = context.WithValue(ctx, userIDKey, "user-456")
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }

    // Simulate database query with context
    func queryDatabase(ctx context.Context, query string) (string, error) {
        select {
        case <-time.After(100 * time.Millisecond):
            return "query result", nil
        case <-ctx.Done():
            return "", ctx.Err()
        }
    }

    func dataHandler(w http.ResponseWriter, r *http.Request) {
        ctx := r.Context()

        // Get context values
        requestID := ctx.Value(requestIDKey).(string)
        userID := ctx.Value(userIDKey).(string)

        // Use context for cancellation-aware operations
        result, err := queryDatabase(ctx, "SELECT * FROM users")
        if err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }

        response := map[string]string{
            "requestID": requestID,
            "userID":    userID,
            "result":    result,
        }

        json.NewEncoder(w).Encode(response)
    }

    // Handler with timeout context
    func timeoutHandler(w http.ResponseWriter, r *http.Request) {
        ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
        defer cancel()

        // Simulate long operation
        select {
        case <-time.After(2 * time.Second):
            fmt.Fprintf(w, "Operation completed within timeout")
        case <-ctx.Done():
            http.Error(w, "Request timeout", http.StatusRequestTimeout)
        }
    }

    func main() {
        mux := http.NewServeMux()
        mux.Handle("/data", ContextMiddleware(http.HandlerFunc(dataHandler)))
        mux.HandleFunc("/timeout", timeoutHandler)

        fmt.Println("Server starting on :8080...")
        log.Fatal(http.ListenAndServe(":8080", mux))
    }
    ```

=== "The Explanation"

    - **`context.WithValue`**: Add request-scoped values to context
    - **`context.WithTimeout`**: Create deadline for operations
    - **`ctx.Done()`**: Channel that closes when context is cancelled
    - **`ctx.Value`**: Retrieve values from context
    - **Context propagation**: Pass context through function calls

=== "The Terminal Output"

    ```
    Server starting on :8080...
    # In another terminal:
    # curl http://localhost:8080/data
    # {"requestID":"req-123","userID":"user-456","result":"query result"}
    # curl http://localhost:8080/timeout
    # Operation completed within timeout
    ```

---

## Health Check Endpoints

Health checks are essential for load balancers, orchestrators, and monitoring systems.

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "fmt"
        "log"
        "net/http"
        "runtime"
        "sync"
        "time"
    )

    type HealthStatus struct {
        Status    string            `json:"status"`
        Timestamp time.Time         `json:"timestamp"`
        Uptime    string            `json:"uptime"`
        Checks    map[string]string `json:"checks"`
    }

    type HealthChecker struct {
        startTime time.Time
        checks    map[string]func() error
        mu        sync.RWMutex
    }

    func NewHealthChecker() *HealthChecker {
        return &HealthChecker{
            startTime: time.Now(),
            checks:    make(map[string]func() error),
        }
    }

    func (hc *HealthChecker) AddCheck(name string, check func() error) {
        hc.mu.Lock()
        defer hc.mu.Unlock()
        hc.checks[name] = check
    }

    func (hc *HealthChecker) CheckHealth() HealthStatus {
        hc.mu.RLock()
        defer hc.mu.RUnlock()

        status := HealthStatus{
            Status:    "healthy",
            Timestamp: time.Now(),
            Uptime:    time.Since(hc.startTime).String(),
            Checks:    make(map[string]string),
        }

        for name, check := range hc.checks {
            if err := check(); err != nil {
                status.Status = "unhealthy"
                status.Checks[name] = fmt.Sprintf("error: %v", err)
            } else {
                status.Checks[name] = "ok"
            }
        }

        return status
    }

    func main() {
        checker := NewHealthChecker()

        // Add health checks
        checker.AddCheck("database", func() error {
            // Simulate database check
            return nil
        })

        checker.AddCheck("cache", func() error {
            // Simulate cache check
            return nil
        })

        checker.AddCheck("memory", func() error {
            var m runtime.MemStats
            runtime.ReadMemStats(&m)
            if m.Sys > 1024*1024*1024 { // > 1GB
                return fmt.Errorf("memory usage too high: %d bytes", m.Sys)
            }
            return nil
        })

        // Health endpoints
        http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
            health := checker.CheckHealth()
            w.Header().Set("Content-Type", "application/json")

            if health.Status == "unhealthy" {
                w.WriteHeader(http.StatusServiceUnavailable)
            }

            json.NewEncoder(w).Encode(health)
        })

        http.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
            // Readiness check
            w.WriteHeader(http.StatusOK)
            fmt.Fprintf(w, "ready")
        })

        http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Hello, World!")
        })

        fmt.Println("Server starting on :8080...")
        log.Fatal(http.ListenAndServe(":8080", nil))
    }
    ```

=== "The Explanation"

    - **Health endpoint**: Returns overall system health status
    - **Readiness endpoint**: Indicates if the service can accept traffic
    - **Health checks**: Individual component checks (DB, cache, etc.)
    - **Status codes**: 200 for healthy, 503 for unhealthy
    - **Structured response**: JSON with status, timestamp, and check details

=== "The Terminal Output"

    ```
    Server starting on :8080...
    # In another terminal:
    # curl http://localhost:8080/health
    # {"status":"healthy","timestamp":"2026-09-03T12:00:00Z","uptime":"1m23s","checks":{"cache":"ok","database":"ok","memory":"ok"}}
    # curl http://localhost:8080/ready
    # ready
    ```

---

## Best Practices

| Practice | Recommendation | Reason |
|----------|---------------|--------|
| Timeouts | Set read/write timeouts | Prevent resource exhaustion |
| Graceful shutdown | Handle SIGTERM signals | Ensure clean resource cleanup |
| Context | Pass context through calls | Enable cancellation and timeouts |
| Error handling | Return proper HTTP status codes | Client clarity |
| Middleware | Compose reusable functionality | DRY principle |
| Health checks | Implement liveness/readiness probes | Support orchestration |

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Server won't start | Port already in use | Change port or kill existing process |
| Request timeout | No timeout configured | Set `ReadTimeout` and `WriteTimeout` |
| Context cancelled | Client disconnected | Check `ctx.Done()` in handlers |
| Memory leak | Goroutine leak | Use context for cancellation |
| 404 on all routes | Wrong handler registration | Check pattern syntax and order |

## Summary

- Go's `net/http` package provides efficient, production-ready HTTP servers
- Use `http.HandlerFunc` and `http.ServeMux` for request routing
- Implement middleware for cross-cutting concerns like logging and auth
- Go 1.22+ supports method-based and path parameter routing
- Graceful shutdown ensures clean server termination
- Context provides request-scoped values and cancellation control
- Health check endpoints support orchestration and monitoring

## Next Steps

- [Error Handling](error-handling.md) - Master error patterns in HTTP handlers
- [Functions & Methods](functions-methods.md) - Understand handler function patterns
- [Structs & Interfaces](structs-interfaces.md) - Design request/response types
