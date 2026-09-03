# Context & Cancellation

Go's `context` package provides a powerful mechanism for managing cancellation signals, deadlines, and request-scoped values across API boundaries and goroutines. Understanding context is essential for building robust, scalable applications.

## What You Will Learn

- Create and use `context.Context` with `context.Background` and `context.TODO`
- Implement cancellation with `context.WithCancel`
- Set timeouts with `context.WithTimeout`
- Define deadlines with `context.WithDeadline`
- Pass values with `context.Value`
- Understand cancellation propagation
- Apply context best practices in HTTP handlers and database operations

## Prerequisites

- Basic Go syntax and concurrency concepts
- Understanding of goroutines and channels
- Familiarity with HTTP handlers

---

## Creating Contexts

The `context.Background` and `context.TODO` functions create empty contexts that serve as starting points.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
    )

    func main() {
        // Background context - root context for main, init, and tests
        ctx := context.Background()
        fmt.Println("Background context:", ctx)

        // TODO context - placeholder when context is unknown
        ctxTODO := context.TODO()
        fmt.Println("TODO context:", ctxTODO)

        // Check context properties
        deadline, ok := ctx.Deadline()
        fmt.Println("Background deadline:", deadline, "set:", ok)
        fmt.Println("Background done:", ctx.Done())
        fmt.Println("Background err:", ctx.Err())
        fmt.Println("Background value:", ctx.Value("key"))
    }
    ```

=== "The Explanation"

    - **context.Background**: Root context, always returns a non-nil, empty context
    - **context.TODO**: Placeholder for when you're unsure which context to use
    - **Deadline**: Returns the time when the context expires
    - **Done**: Returns a channel that's closed when context is cancelled
    - **Err**: Returns the error that caused context cancellation
    - **Value**: Returns the value associated with a key

=== "The Terminal Output"

    ```
    Background context: context.Background
    TODO context: context.TODO
    Background deadline: <nil> <nil>
    Background done: <nil>
    Background err: <nil>
    Background value: <nil>
    ```

!!! go "Background vs TODO"
Use `context.Background` for the main function, initialization, and tests. Use `context.TODO` when you're unsure which context to use or need a placeholder.

## Cancellation with WithCancel

The `context.WithCancel` function returns a copy of the context that is cancelled when `cancel` is called.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "time"
    )

    func main() {
        // Create cancellable context
        ctx, cancel := context.WithCancel(context.Background())

        // Start a goroutine that listens for cancellation
        go func(ctx context.Context) {
            for {
                select {
                case <-ctx.Done():
                    fmt.Println("Worker cancelled:", ctx.Err())
                    return
                default:
                    fmt.Println("Working...")
                    time.Sleep(500 * time.Millisecond)
                }
            }
        }(ctx)

        // Cancel after 2 seconds
        time.Sleep(2 * time.Second)
        fmt.Println("Cancelling context...")
        cancel()

        // Wait a bit to see the cancellation
        time.Sleep(500 * time.Millisecond)
        fmt.Println("Main function exiting")
    }
    ```

=== "The Explanation"

    - **context.WithCancel**: Creates a context that can be cancelled
    - **cancel function**: Calling it cancels the context and all its children
    - **ctx.Done()**: Returns a channel that receives a signal when cancelled
    - **ctx.Err()**: Returns `context.Canceled` after cancellation

=== "The Terminal Output"

    ```
    Working...
    Working...
    Working...
    Working...
    Cancelling context...
    Worker cancelled: context canceled
    Main function exiting
    ```

## Timeouts with WithTimeout

The `context.WithTimeout` function creates a context that expires after a specified duration.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "time"
    )

    func main() {
        // Create context with 2-second timeout
        ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
        defer cancel()

        // Simulate a slow operation
        result := make(chan string, 1)
        go func() {
            // This takes longer than the timeout
            time.Sleep(3 * time.Second)
            result <- "Operation completed"
        }()

        select {
        case res := <-result:
            fmt.Println(res)
        case <-ctx.Done():
            fmt.Println("Operation timed out:", ctx.Err())
        }

        // Check remaining time
        deadline, ok := ctx.Deadline()
        if ok {
            remaining := time.Until(deadline)
            fmt.Printf("Time remaining: %v\n", remaining)
        }
    }
    ```

=== "The Explanation"

    - **context.WithTimeout**: Creates context that expires after duration
    - **defer cancel**: Always call cancel to release resources
    - **ctx.Deadline**: Returns the deadline time
    - **time.Until**: Calculates time until the deadline

=== "The Terminal Output"

    ```
    Operation timed out: context deadline exceeded
    Time remaining: -1s
    ```

!!! danger "Always Call Cancel"
Always call the cancel function returned by `WithTimeout`, even if the operation completes before the timeout. This prevents context leaks and frees resources.

## Deadlines with WithDeadline

The `context.WithDeadline` function creates a context that expires at a specific time.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "time"
    )

    func main() {
        // Create context with specific deadline
        deadline := time.Now().Add(3 * time.Second)
        ctx, cancel := context.WithDeadline(context.Background(), deadline)
        defer cancel()

        // Monitor the context
        go func() {
            for {
                select {
                case <-ctx.Done():
                    fmt.Println("Context expired:", ctx.Err())
                    fmt.Println("Current time:", time.Now().Format("15:04:05"))
                    fmt.Println("Deadline:", deadline.Format("15:04:05"))
                    return
                default:
                    time.Sleep(200 * time.Millisecond)
                }
            }
        }()

        // Wait for context to expire
        time.Sleep(4 * time.Second)
    }
    ```

=== "The Explanation"

    - **context.WithDeadline**: Creates context that expires at specific time
    - **time.Now().Add**: Calculates deadline from current time
    - **context.DeadlineExceeded**: Error when deadline is exceeded
    - **Precise timing**: More accurate than WithTimeout for specific times

=== "The Terminal Output"

    ```
    Context expired: context deadline exceeded
    Current time: 10:30:48
    Deadline: 10:30:45
    ```

## Passing Values with context.Value

The `context.WithValue` function adds key-value pairs to a context.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
    )

    // Define custom key type to avoid collisions
    type contextKey string

    const (
        requestIDKey contextKey = "requestID"
        userIDKey    contextKey = "userID"
    )

    // WithRequestID adds request ID to context
    func WithRequestID(ctx context.Context, requestID string) context.Context {
        return context.WithValue(ctx, requestIDKey, requestID)
    }

    // GetRequestID extracts request ID from context
    func GetRequestID(ctx context.Context) (string, bool) {
        requestID, ok := ctx.Value(requestIDKey).(string)
        return requestID, ok
    }

    // WithUserID adds user ID to context
    func WithUserID(ctx context.Context, userID int) context.Context {
        return context.WithValue(ctx, userIDKey, userID)
    }

    // GetUserID extracts user ID from context
    func GetUserID(ctx context.Context) (int, bool) {
        userID, ok := ctx.Value(userIDKey).(int)
        return userID, ok
    }

    func main() {
        // Create context with values
        ctx := context.Background()
        ctx = WithRequestID(ctx, "req-12345")
        ctx = WithUserID(ctx, 42)

        // Extract values
        if requestID, ok := GetRequestID(ctx); ok {
            fmt.Println("Request ID:", requestID)
        }

        if userID, ok := GetUserID(ctx); ok {
            fmt.Println("User ID:", userID)
        }

        // Access raw value
        fmt.Println("Raw value:", ctx.Value(requestIDKey))

        // Non-existent key
        fmt.Println("Non-existent:", ctx.Value("nonexistent"))
    }
    ```

=== "The Explanation"

    - **context.WithValue**: Adds key-value pair to context
    - **Custom key type**: Use custom types to prevent key collisions
    - **Type assertion**: Extract values with type assertion
    - **Function helpers**: Create helper functions for type-safe access

=== "The Terminal Output"

    ```
    Request ID: req-12345
    User ID: 42
    Raw value: req-12345
    Non-existent: <nil>
    ```

!!! warning "Value Best Practices"
Use context values only for request-scoped data that crosses API boundaries (request IDs, authentication tokens). Don't use them for optional parameters or function arguments.

## Cancellation Propagation

Context cancellation propagates to all child contexts.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "time"
    )

    func main() {
        // Create parent context
        parentCtx, parentCancel := context.WithCancel(context.Background())

        // Create child contexts
        childCtx1, childCancel1 := context.WithCancel(parentCtx)
        childCtx2, childCancel2 := context.WithTimeout(parentCtx, 5*time.Second)

        // Monitor all contexts
        monitorCtx := func(name string, ctx context.Context) {
            for {
                select {
                case <-ctx.Done():
                    fmt.Printf("%s cancelled: %v\n", name, ctx.Err())
                    return
                default:
                    time.Sleep(200 * time.Millisecond)
                }
            }
        }

        go monitorCtx("Parent", parentCtx)
        go monitorCtx("Child1", childCtx1)
        go monitorCtx("Child2", childCtx2)

        time.Sleep(1 * time.Second)

        // Cancel parent - all children will be cancelled
        fmt.Println("\nCancelling parent...")
        parentCancel()

        time.Sleep(1 * time.Second)

        // Note: childCancel1 and childCancel2 are not needed
        // because parent cancellation propagates
        _ = childCancel1
        _ = childCancel2
    }
    ```

=== "The Explanation"

    - **Cancellation propagation**: Cancelling parent cancels all children
    - **Independent cancellation**: Children can be cancelled independently
    - **Resource cleanup**: Always defer cancel functions
    - **Multiple children**: Parent cancellation affects all descendants

=== "The Terminal Output"

    ```
    Child2 cancelled: context deadline exceeded
    Cancelling parent...
    Parent cancelled: context canceled
    Child1 cancelled: context canceled
    ```

## Context in HTTP Handlers

Context is essential for managing request lifecycle in HTTP handlers.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "log"
        "net/http"
        "time"
    )

    // Custom key types
    type contextKey string

    const requestIDKey contextKey = "requestID"

    // Middleware to add request ID
    func requestIDMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            requestID := fmt.Sprintf("req-%d", time.Now().UnixNano())
            ctx := context.WithValue(r.Context(), requestIDKey, requestID)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }

    // Handler that uses context
    func handler(w http.ResponseWriter, r *http.Request) {
        ctx := r.Context()

        // Get request ID from context
        requestID, _ := ctx.Value(requestIDKey).(string)

        // Simulate database call with timeout
        dbCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
        defer cancel()

        result := make(chan string, 1)
        go func() {
            // Simulate slow database query
            time.Sleep(1 * time.Second)
            result <- "Data from database"
        }()

        select {
        case data := <-result:
            fmt.Fprintf(w, "Request %s: %s", requestID, data)
        case <-dbCtx.Done():
            http.Error(w, "Database timeout", http.StatusGatewayTimeout)
        }
    }

    func main() {
        mux := http.NewServeMux()
        mux.HandleFunc("/data", handler)

        wrappedMux := requestIDMiddleware(mux)

        fmt.Println("Server starting on :8080")
        log.Fatal(http.ListenAndServe(":8080", wrappedMux))
    }
    ```

=== "The Explanation"

    - **context.WithValue**: Adds request ID to context
    - **r.Context()**: Gets context from HTTP request
    - **r.WithContext**: Creates new request with custom context
    - **context.WithTimeout**: Limits database call duration

=== "The Terminal Output"

    ```
    Server starting on :8080
    # When accessing http://localhost:8080/data
    Request req-1234567890: Data from database
    ```

## Context in Database Operations

Context enables timeout control and cancellation for database operations.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "database/sql"
        "fmt"
        "log"
        "time"

        _ "github.com/mattn/go-sqlite3"
    )

    // QueryWithContext executes a query with context
    func QueryWithContext(ctx context.Context, db *sql.DB, query string, args ...interface{}) (*sql.Rows, error) {
        // Create statement with context
        stmt, err := db.PrepareContext(ctx, query)
        if err != nil {
            return nil, err
        }
        defer stmt.Close()

        return stmt.QueryContext(ctx, args...)
    }

    func main() {
        // Open database
        db, err := sql.Open("sqlite3", ":memory:")
        if err != nil {
            log.Fatal(err)
        }
        defer db.Close()

        // Create table
        _, err = db.Exec(`CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT,
            email TEXT
        )`)
        if err != nil {
            log.Fatal(err)
        }

        // Insert test data
        _, err = db.Exec("INSERT INTO users (name, email) VALUES (?, ?)", "Alice", "alice@example.com")
        if err != nil {
            log.Fatal(err)
        }

        // Query with timeout
        ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
        defer cancel()

        rows, err := QueryWithContext(ctx, db, "SELECT * FROM users WHERE id = ?", 1)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        defer rows.Close()

        for rows.Next() {
            var id int
            var name, email string
            if err := rows.Scan(&id, &name, &email); err != nil {
                fmt.Println("Scan error:", err)
                continue
            }
            fmt.Printf("User: %d - %s (%s)\n", id, name, email)
        }
    }
    ```

=== "The Explanation"

    - **db.PrepareContext**: Creates statement with context
    - **stmt.QueryContext**: Executes query with context
    - **context.WithTimeout**: Limits query duration
    - **Graceful degradation**: Handles timeouts gracefully

=== "The Terminal Output"

    ```
    User: 1 - Alice (alice@example.com)
    ```

## Best Practices

| Practice | Recommendation |
|----------|----------------|
| Pass context | Always pass context as first parameter |
| Don't store context | Avoid storing context in structs |
| Always cancel | Call cancel function to release resources |
| Use value sparingly | Only for request-scoped data |
| Don't use for params | Use function parameters instead |
| Check ctx.Done | Always check for cancellation in loops |

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Context leak | Not calling cancel | Always defer cancel |
| Wrong timeout | Incorrect duration | Verify timeout calculation |
| Missing values | Wrong key type | Use custom key types |
| Unresponsive code | Not checking ctx.Done | Add ctx.Done checks in loops |

## Summary

- `context.Background` and `context.TODO` create empty contexts
- `context.WithCancel` enables manual cancellation
- `context.WithTimeout` and `context.WithDeadline` set time limits
- `context.WithValue` passes request-scoped data
- Cancellation propagates from parent to child contexts
- Always call cancel to prevent resource leaks
- Pass context as the first parameter to functions

## Next Steps

- Learn about [Sync Primitives](sync-primitives.md)
- Explore [Sort & Collections](sort-collections.md)
- Understand [Embed & FS](embed-fs.md)
- Discover [Hashing & Crypto](hashing-crypto.md)
