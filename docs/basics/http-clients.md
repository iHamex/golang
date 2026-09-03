# HTTP Clients

HTTP clients are essential for building applications that communicate with web services, APIs, and other networked resources. Go provides a powerful and flexible `net/http` package that supports everything from simple GET requests to complex, production-ready HTTP clients with connection pooling, timeouts, and context cancellation.

---

## What You Will Learn

- How to make basic HTTP requests using `http.Get` and `http.Post`
- Creating custom requests with `http.NewRequest`
- Setting request headers and handling response bodies
- Configuring timeouts and connection pooling
- Implementing custom redirect policies
- Using `http.Transport` for fine-grained control
- Applying context cancellation for request lifecycle management
- Best practices for testing HTTP clients

---

## Prerequisites

- Familiarity with Go basics and data structures
- Understanding of interfaces and structs
- Basic knowledge of HTTP protocol concepts

---

## Making Basic HTTP Requests

Go makes it easy to perform HTTP requests with built-in helper functions.

### GET Requests

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "io"
        "net/http"
    )

    func main() {
        resp, err := http.Get("https://jsonplaceholder.typicode.com/posts/1")
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        defer resp.Body.Close()

        body, err := io.ReadAll(resp.Body)
        if err != nil {
            fmt.Println("Error reading body:", err)
            return
        }

        fmt.Println("Status:", resp.Status)
        fmt.Println("Body:", string(body))
    }
    ```

=== "The Explanation"

    - **http.Get**: Performs an HTTP GET request and returns a response
    - **resp.Body**: An `io.ReadCloser` that contains the response body
    - **defer resp.Body.Close**: Ensures the body is closed after use
    - **io.ReadAll**: Reads the entire response body into a byte slice

=== "The Terminal Output"

    ```
    Status: 200 OK
    Body: {"userId":1,"id":1,"title":"sunt aut facere repellat provident occaecati excepturi optio reprehenderit","body":"quia et suscipit\nsuscipit recusandae consequuntur..."}
    ```

### POST Requests

=== "The Code"

    ```go
    package main

    import (
        "bytes"
        "fmt"
        "io"
        "net/http"
    )

    func main() {
        jsonData := []byte(`{"title":"foo","body":"bar","userId":1}`)

        resp, err := http.Post(
            "https://jsonplaceholder.typicode.com/posts",
            "application/json",
            bytes.NewBuffer(jsonData),
        )
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        defer resp.Body.Close()

        body, _ := io.ReadAll(resp.Body)
        fmt.Println("Status:", resp.Status)
        fmt.Println("Response:", string(body))
    }
    ```

=== "The Explanation"

    - **bytes.NewBuffer**: Wraps the byte slice into an `io.Reader`
    - **Content-Type**: Tells the server the format of the request body
    - **JSON payload**: The data we're sending in the request

=== "The Terminal Output"

    ```
    Status: 201 Created
    Response: {"title":"foo","body":"bar","userId":1,"id":101}
    ```

!!! go "Tip"
Always check the response status code before processing the response body. A `200 OK` status doesn't guarantee the response contains valid data.

---

## Creating Custom Requests

For full control over HTTP requests, use `http.NewRequest`.

### Setting Request Headers

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "io"
        "net/http"
    )

    func main() {
        req, err := http.NewRequest("GET", "https://httpbin.org/headers", nil)
        if err != nil {
            fmt.Println("Error creating request:", err)
            return
        }

        req.Header.Set("Authorization", "Bearer my-secret-token")
        req.Header.Set("User-Agent", "GoBot/1.0")
        req.Header.Set("Accept", "application/json")

        client := &http.Client{}
        resp, err := client.Do(req)
        if err != nil {
            fmt.Println("Error making request:", err)
            return
        }
        defer resp.Body.Close()

        body, _ := io.ReadAll(resp.Body)
        fmt.Println("Response:", string(body))
    }
    ```

=== "The Explanation"

    - **http.NewRequest**: Creates a new HTTP request with the specified method and URL
    - **req.Header.Set**: Adds headers to the request
    - **client.Do**: Executes the request using the custom client
    - **Authorization**: Example of authentication header

=== "The Terminal Output"

    ```
    Response: {"headers":{"Accept":"application/json","Authorization":"Bearer my-secret-token","User-Agent":"GoBot/1.0"}}
    ```

!!! note "Request Methods"
Go's `http` package supports all standard HTTP methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`.

---

## Configuring Timeouts

Timeouts prevent your application from hanging indefinitely on slow or unresponsive servers.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "io"
        "net/http"
        "time"
    )

    func main() {
        client := &http.Client{
            Timeout: 5 * time.Second,
        }

        resp, err := client.Get("https://httpbin.org/delay/10")
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        defer resp.Body.Close()

        body, _ := io.ReadAll(resp.Body)
        fmt.Println("Status:", resp.Status)
        fmt.Println("Body:", string(body))
    }
    ```

=== "The Explanation"

    - **client.Timeout**: Sets the maximum time to wait for a complete request
    - **httpbin.org/delay/10**: Simulates a slow response (10 seconds)
    - **time.Second**: Duration type for precise timeout control
    - **Client-level timeout**: Applies to the entire request lifecycle

=== "The Terminal Output"

    ```
    Error: Get "https://httpbin.org/delay/10": context deadline exceeded (Client.Timeout exceeded while awaiting headers)
    ```

!!! danger "Timeout Gotcha"
The `client.Timeout` includes dial time, TLS handshake, sending the request, and receiving the response. For more granular control, use context-based timeouts instead.

### Context-Based Timeouts

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "io"
        "net/http"
        "time"
    )

    func main() {
        ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
        defer cancel()

        req, err := http.NewRequestWithContext(ctx, "GET", "https://httpbin.org/delay/5", nil)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }

        resp, err := http.DefaultClient.Do(req)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        defer resp.Body.Close()

        body, _ := io.ReadAll(resp.Body)
        fmt.Println("Status:", resp.Status)
        fmt.Println("Body:", string(body))
    }
    ```

=== "The Explanation"

    - **context.WithTimeout**: Creates a context that expires after a duration
    - **http.NewRequestWithContext**: Creates a request tied to the context
    - **cancel**: Function to cancel the context early if needed
    - **Defers cancel**: Prevents context leak

=== "The Terminal Output"

    ```
    Error: Get "https://httpbin.org/delay/5": context deadline exceeded
    ```

---

## Connection Pooling and Transport

The `http.Transport` struct manages connection pooling and reuse for improved performance.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "io"
        "net"
        "net/http"
        "time"
    )

    func main() {
        transport := &http.Transport{
            MaxIdleConns:        100,
            MaxIdleConnsPerHost: 10,
            IdleConnTimeout:     90 * time.Second,
            DialContext: (&net.Dialer{
                Timeout:   10 * time.Second,
                KeepAlive: 30 * time.Second,
            }).DialContext,
            TLSHandshakeTimeout: 10 * time.Second,
        }

        client := &http.Client{
            Transport: transport,
            Timeout:   30 * time.Second,
        }

        for i := 0; i < 5; i++ {
            resp, err := client.Get("https://jsonplaceholder.typicode.com/posts/1")
            if err != nil {
                fmt.Printf("Request %d error: %v\n", i+1, err)
                continue
            }

            body, _ := io.ReadAll(resp.Body)
            resp.Body.Close()

            fmt.Printf("Request %d: Status %s, Body length: %d bytes\n",
                i+1, resp.Status, len(body))
        }
    }
    ```

=== "The Explanation"

    - **MaxIdleConns**: Maximum number of idle (keep-alive) connections
    - **MaxIdleConnsPerHost**: Connections kept alive per host
    - **IdleConnTimeout**: How long idle connections are kept
    - **DialContext**: Configuration for establishing new connections
    - **TLSHandshakeTimeout**: Time limit for TLS handshake

=== "The Terminal Output"

    ```
    Request 1: Status 200 OK, Body length: 292 bytes
    Request 2: Status 200 OK, Body length: 292 bytes
    Request 3: Status 200 OK, Body length: 292 bytes
    Request 4: Status 200 OK, Body length: 292 bytes
    Request 5: Status 200 OK, Body length: 292 bytes
    ```

!!! go "Performance Tip"
Connection pooling is enabled by default in Go's HTTP client. For high-throughput applications, tune `MaxIdleConnsPerHost` to match your expected concurrency level.

---

## Custom Redirect Policies

Control how your client handles redirects with custom redirect functions.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "io"
        "net/http"
    )

    func main() {
        client := &http.Client{
            CheckRedirect: func(req *http.Request, via []*http.Request) error {
                if len(via) >= 3 {
                    return fmt.Errorf("too many redirects: %d", len(via))
                }

                fmt.Printf("Redirect %d: %s -> %s\n",
                    len(via), via[len(via)-1].URL, req.URL)

                return nil
            },
        }

        resp, err := client.Get("https://httpbin.org/redirect/2")
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        defer resp.Body.Close()

        body, _ := io.ReadAll(resp.Body)
        fmt.Println("Final Status:", resp.Status)
        fmt.Println("Final URL:", resp.Request.URL)
        fmt.Println("Body length:", len(body))
    }
    ```

=== "The Explanation"

    - **CheckRedirect**: Function called before each redirect
    - **via**: Slice of all previous requests in the redirect chain
    - **Limit redirects**: Return an error to stop after N redirects
    - **resp.Request.URL**: The final URL after all redirects

=== "The Terminal Output"

    ```
    Redirect 0: https://httpbin.org/redirect/2 -> /relative-redirect/1
    Redirect 1: https://httpbin.org/relative-redirect/1 -> /anything
    Final Status: 200 OK
    Final URL: https://httpbin.org/anything
    Body length: 452
    ```

!!! warning "Security Consideration"
Be cautious when following redirects. Malicious servers can use redirects to bypass authentication or access internal resources. Always validate redirect URLs.

---

## Context Cancellation

Use context cancellation to abort requests when they're no longer needed.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "io"
        "net/http"
        "time"
    )

    func main() {
        ctx, cancel := context.WithCancel(context.Background())

        req, err := http.NewRequestWithContext(ctx, "GET", "https://httpbin.org/delay/10", nil)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }

        go func() {
            time.Sleep(2 * time.Second)
            fmt.Println("Cancelling request...")
            cancel()
        }()

        resp, err := http.DefaultClient.Do(req)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        defer resp.Body.Close()

        body, _ := io.ReadAll(resp.Body)
        fmt.Println("Status:", resp.Status)
        fmt.Println("Body:", string(body))
    }
    ```

=== "The Explanation"

    - **context.WithCancel**: Creates a context that can be manually cancelled
    - **cancel()**: Signals the context to stop all associated operations
    - **Goroutine**: Simulates another part of the application deciding to cancel
    - **Clean shutdown**: Resources are released when context is cancelled

=== "The Terminal Output"

    ```
    Cancelling request...
    Error: Get "https://httpbin.org/delay/10": context canceled
    ```

!!! abstract "When to Use Context Cancellation"
- User-initiated request cancellation (e.g., closing a browser tab)
- Cascading timeouts in microservices
- Graceful shutdown of HTTP servers
- Rate limiting and request prioritization

---

## Testing HTTP Clients

Go provides tools for testing HTTP clients without making real network requests.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "io"
        "net/http"
        "net/http/httptest"
    )

    func fetchData(url string) (string, error) {
        resp, err := http.Get(url)
        if err != nil {
            return "", err
        }
        defer resp.Body.Close()

        body, err := io.ReadAll(resp.Body)
        if err != nil {
            return "", err
        }

        return string(body), nil
    }

    func main() {
        // Create a test server
        testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprint(w, `{"message":"test response"}`)
        }))
        defer testServer.Close()

        // Use the test server URL
        result, err := fetchData(testServer.URL)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }

        fmt.Println("Response:", result)
    }
    ```

=== "The Explanation"

    - **httptest.NewServer**: Creates a local HTTP server for testing
    - **http.HandlerFunc**: Adapts a function to the `Handler` interface
    - **testServer.Close**: Shuts down the test server after tests
    - **testServer.URL**: The URL of the local test server

=== "The Terminal Output"

    ```
    Response: {"message":"test response"}
    ```

!!! go "Testing Tip"
Use `httptest.NewTLSServer` for testing HTTPS clients. It provides a self-signed certificate for secure connection testing.

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Always close response bodies | Use `defer resp.Body.Close()` immediately after checking for errors |
| Set appropriate timeouts | Configure both client-level and request-level timeouts |
| Reuse clients | Create one `http.Client` and reuse it across requests |
| Check status codes | Don't assume 200 OK; handle all expected status codes |
| Use context | Implement context for cancellation and timeout control |
| Handle redirects | Set redirect policies based on your security requirements |
| Read body limits | Use `io.LimitReader` to prevent memory exhaustion |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Connection refused | Check if the server is running and accessible |
| Timeout errors | Increase timeout values or check network connectivity |
| EOF errors | Server closed connection prematurely; check server logs |
| Too many open files | Increase file descriptor limits or reduce connection pool size |
| Context cancelled | Check for premature context cancellation in code |

## Summary

- `http.Get` and `http.Post` provide simple APIs for basic requests
- `http.NewRequest` gives full control over request creation
- `http.Client` with custom `http.Transport` enables connection pooling
- Context-based timeouts provide fine-grained request control
- `httptest` package enables effective client testing
- Always close response bodies and handle errors properly

## Next Steps

- [JSON & Encoding](json-encoding.md) - Learn to parse HTTP response bodies
- [Testing](testing.md) - Master HTTP client testing techniques
- [Concurrency](../advanced/concurrency-patterns.md) - Use goroutines for concurrent HTTP requests
- [Error Handling](error-handling.md) - Improve HTTP error handling patterns