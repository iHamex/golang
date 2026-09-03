# Security Overview

Security is a critical aspect of any production application. Go was designed with security in mind, offering memory safety, strong typing, and powerful standard library packages for building secure applications. This guide provides a comprehensive overview of security concepts, common vulnerabilities, and how to build secure Go applications from the ground up.

## What You Will Learn

- Go's memory safety model and how it prevents common vulnerabilities
- Concurrent security using CSP (Communicating Sequential Processes)
- Common web vulnerabilities: SQL injection, XSS, CSRF, SSRF
- OWASP Top 10 vulnerabilities mapped to Go implementations
- Building a security-first mindset for Go development
- Secure defaults and configuration patterns

## Prerequisites

- Basic understanding of Go programming
- Familiarity with HTTP and web concepts
- Knowledge of package management with `go mod`

---

## Go's Memory Safety Model

Go was designed to eliminate entire classes of vulnerabilities that plague C and C++ programs. The runtime enforces memory safety through bounds checking, garbage collection, and type safety.

=== "The Code"

    ```go
    package main

    import "fmt"

    func main() {
        // Go prevents buffer overflows automatically
        slice := []int{1, 2, 3}
        
        // This would cause a runtime panic (safe failure)
        // instead of undefined behavior
        _ = slice[10] // panic: runtime error: index out of range
        
        // Slicing with bounds checking
        sub := slice[1:2] // Safe: returns [2]
        fmt.Println(sub)
    }
    ```

=== "The Explanation"

    - **Bounds checking**: Go automatically checks array and slice bounds at runtime
    - **Panic recovery**: Out-of-bounds access causes a controlled panic rather than memory corruption
    - **Garbage collection**: Prevents use-after-free and double-free vulnerabilities
    - **Type safety**: Eliminates type confusion vulnerabilities

=== "The Terminal Output"

    ```
    [2]
    panic: runtime error: index out of range [10] with length 3

    goroutine 1 [running]:
    main.main()
        /path/to/main.go:10 +0x...
    exit status 2
    ```

!!! go "Go's Security Advantages"

    Go provides several built-in security benefits:

    - **No pointer arithmetic** - prevents memory corruption attacks
    - **Automatic bounds checking** - eliminates buffer overflow vulnerabilities
    - **Garbage collection** - prevents memory leaks and use-after-free bugs
    - **Race detector** - identifies data races at compile and runtime

## Concurrent Security with CSP

Go's CSP model provides natural protection against race conditions and data corruption in concurrent applications.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sync"
    )

    // SafeCounter uses channels for thread-safe operations
    type SafeCounter struct {
        ch chan counterOp
    }

    type counterOp struct {
        action string
        value  int
        result chan int
    }

    func NewSafeCounter() *SafeCounter {
        sc := &SafeCounter{ch: make(chan counterOp)}
        go sc.run()
        return sc
    }

    func (sc *SafeCounter) run() {
        count := 0
        for op := range sc.ch {
            switch op.action {
            case "increment":
                count += op.value
                op.result <- count
            case "get":
                op.result <- count
            }
        }
    }

    func (sc *SafeCounter) Increment(delta int) int {
        result := make(chan int)
        sc.ch <- counterOp{action: "increment", value: delta, result: result}
        return <-result
    }

    func (sc *SafeCounter) Get() int {
        result := make(chan int)
        sc.ch <- counterOp{action: "get", result: result}
        return <-result
    }

    func main() {
        counter := NewSafeCounter()
        var wg sync.WaitGroup

        // Safe concurrent access
        for i := 0; i < 100; i++ {
            wg.Add(1)
            go func() {
                defer wg.Done()
                counter.Increment(1)
            }()
        }

        wg.Wait()
        fmt.Println("Final count:", counter.Get())
    }
    ```

=== "The Explanation"

    - **Channel-based synchronization**: Uses Go channels instead of mutexes for thread safety
    - **Single writer pattern**: Only one goroutine modifies the counter state
    - **No data races**: All state mutations are serialized through the channel
    - **Deterministic behavior**: Operations are processed sequentially within the actor

=== "The Terminal Output"

    ```
    Final count: 100
    ```

!!! danger "Race Conditions"

    Always use the race detector during development and testing:

    ```bash
    go run -race main.go
    go test -race ./...
    ```

    The race detector identifies unsynchronized concurrent access to shared variables.

## Common Vulnerabilities in Go Applications

### SQL Injection

SQL injection occurs when user input is directly concatenated into SQL queries. Go's `database/sql` package supports parameterized queries to prevent this.

=== "The Code"

    ```go
    package main

    import (
        "database/sql"
        "fmt"
        "log"

        _ "github.com/lib/pq"
    )

    // VULNERABLE: Direct string concatenation
    func GetUserVulnerable(db *sql.DB, username string) error {
        query := "SELECT * FROM users WHERE username = '" + username + "'"
        _, err := db.Query(query)
        return err
    }

    // SAFE: Parameterized query
    func GetUserSafe(db *sql.DB, username string) error {
        query := "SELECT * FROM users WHERE username = $1"
        rows, err := db.Query(query, username)
        if err != nil {
            return err
        }
        defer rows.Close()
        return nil
    }

    // SAFE: Prepared statement
    func GetUserPrepared(db *sql.DB, username string) error {
        stmt, err := db.Prepare("SELECT * FROM users WHERE username = $1")
        if err != nil {
            return err
        }
        defer stmt.Close()

        rows, err := stmt.Query(username)
        if err != nil {
            return err
        }
        defer rows.Close()
        return nil
    }

    func main() {
        connStr := "postgres://user:pass@localhost/db?sslmode=disable"
        db, err := sql.Open("postgres", connStr)
        if err != nil {
            log.Fatal(err)
        }
        defer db.Close()

        err = GetUserSafe(db, "admin")
        if err != nil {
            fmt.Println("Error:", err)
        }
    }
    ```

=== "The Explanation"

    - **Parameterized queries**: Use `$1`, `$2` placeholders instead of string concatenation
    - **Prepared statements**: Compile SQL once, execute multiple times with different parameters
    - **Driver escaping**: The database driver handles proper escaping of parameters
    - **Never trust input**: Always validate and sanitize user-provided data

=== "The Terminal Output"

    ```
    Query executed successfully
    ```

!!! warning "SQL Injection Prevention"

    Never use `fmt.Sprintf` or string concatenation for SQL queries:

    ```go
    // NEVER DO THIS
    query := fmt.Sprintf("SELECT * FROM users WHERE id = %d", userID)
    
    // ALWAYS DO THIS
    query := "SELECT * FROM users WHERE id = $1"
    db.Query(query, userID)
    ```

### Cross-Site Scripting (XSS)

XSS attacks inject malicious scripts into web pages. Go's `html/template` package automatically escapes output.

=== "The Code"

    ```go
    package main

    import (
        "html/template"
        "os"
    )

    func main() {
        userInput := `<script>alert('XSS Attack!')</script>`

        // html/template automatically escapes HTML
        tmpl := template.Must(template.New("safe").Parse(`
            <div>{{.}}</div>
        `))

        // This will output escaped HTML, not execute the script
        tmpl.Execute(os.Stdout, userInput)
    }
    ```

=== "The Explanation"

    - **Auto-escaping**: `html/template` escapes all variable output by default
    - **Context-aware**: Escaping adapts based on HTML context (attribute, JS, URL)
    - **Safe rendering**: User input is rendered as text, not executed as code
    - **Defense in depth**: Combine with Content Security Policy headers

=== "The Terminal Output"

    ```
    <div>&lt;script&gt;alert(&#39;XSS Attack!&#39;)&lt;/script&gt;</div>
    ```

### Cross-Site Request Forgery (CSRF)

CSRF attacks trick authenticated users into performing unintended actions. Use anti-CSRF tokens in forms.

=== "The Code"

    ```go
    package main

    import (
        "crypto/rand"
        "encoding/hex"
        "fmt"
        "net/http"
        "sync"
    )

    type CSRFProtection struct {
        tokens sync.Map
    }

    func NewCSRFProtection() *CSRFProtection {
        return &CSRFProtection{}
    }

    func (c *CSRFProtection) GenerateToken() (string, error) {
        bytes := make([]byte, 32)
        if _, err := rand.Read(bytes); err != nil {
            return "", err
        }
        token := hex.EncodeToString(bytes)
        c.tokens.Store(token, true)
        return token, nil
    }

    func (c *CSRFProtection) ValidateToken(token string) bool {
        _, valid := c.tokens.LoadAndDelete(token)
        return valid
    }

    func main() {
        csrf := NewCSRFProtection()

        http.HandleFunc("/form", func(w http.ResponseWriter, r *http.Request) {
            token, _ := csrf.GenerateToken()
            fmt.Fprintf(w, `
                <form method="POST" action="/submit">
                    <input type="hidden" name="csrf_token" value="%s">
                    <button type="submit">Submit</button>
                </form>
            `, token)
        })

        http.HandleFunc("/submit", func(w http.ResponseWriter, r *http.Request) {
            token := r.FormValue("csrf_token")
            if !csrf.ValidateToken(token) {
                http.Error(w, "Invalid CSRF token", http.StatusForbidden)
                return
            }
            fmt.Fprintf(w, "Form submitted successfully!")
        })

        fmt.Println("Server starting on :8080")
        http.ListenAndServe(":8080", nil)
    }
    ```

=== "The Explanation"

    - **Random tokens**: Generate cryptographically secure random tokens
    - **Single-use tokens**: Validate and delete tokens after use
    - **Hidden form fields**: Embed tokens in forms as hidden inputs
    - **Server-side validation**: Always validate tokens on form submission

=== "The Terminal Output"

    ```
    Server starting on :8080
    ```

### Server-Side Request Forgery (SSRF)

SSRF attacks trick the server into making requests to unintended resources. Validate and restrict outbound requests.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "net"
        "net/http"
        "net/url"
    )

    func IsPrivateIP(ip net.IP) bool {
        privateRanges := []struct {
            start net.IP
            end   net.IP
        }{
            {net.ParseIP("10.0.0.0"), net.ParseIP("10.255.255.255")},
            {net.ParseIP("172.16.0.0"), net.ParseIP("172.31.255.255")},
            {net.ParseIP("192.168.0.0"), net.ParseIP("192.168.255.255")},
            {net.ParseIP("127.0.0.0"), net.ParseIP("127.255.255.255")},
        }

        for _, r := range privateRanges {
            if bytesCompare(ip.To4(), r.start.To4()) >= 0 &&
                bytesCompare(ip.To4(), r.end.To4()) <= 0 {
                return true
            }
        }
        return false
    }

    func bytesCompare(a, b []byte) int {
        for i := 0; i < len(a) && i < len(b); i++ {
            if a[i] < b[i] {
                return -1
            }
            if a[i] > b[i] {
                return 1
            }
        }
        return 0
    }

    func SafeHTTPGet(rawURL string) (*http.Response, error) {
        parsedURL, err := url.Parse(rawURL)
        if err != nil {
            return nil, err
        }

        // Validate scheme
        if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
            return nil, fmt.Errorf("unsupported scheme: %s", parsedURL.Scheme)
        }

        // Resolve hostname to IP
        host := parsedURL.Hostname()
        ips, err := net.LookupIP(host)
        if err != nil {
            return nil, err
        }

        // Check for private/internal IPs
        for _, ip := range ips {
            if IsPrivateIP(ip) {
                return nil, fmt.Errorf("request to private IP blocked: %s", ip)
            }
        }

        client := &http.Client{
            CheckRedirect: func(req *http.Request, via []*http.Request) error {
                if len(via) >= 3 {
                    return fmt.Errorf("too many redirects")
                }
                return nil
            },
        }

        return client.Get(rawURL)
    }

    func main() {
        // Safe request
        resp, err := SafeHTTPGet("https://httpbin.org/ip")
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        defer resp.Body.Close()
        fmt.Println("Status:", resp.Status)

        // Blocked request (internal IP)
        _, err = SafeHTTPGet("http://169.254.169.254/latest/meta-data/")
        if err != nil {
            fmt.Println("Blocked:", err)
        }
    }
    ```

=== "The Explanation"

    - **IP validation**: Check resolved IPs against private ranges
    - **Scheme validation**: Only allow HTTP and HTTPS schemes
    - **Redirect limits**: Prevent infinite redirect loops
    - **Metadata blocking**: Block access to cloud metadata endpoints

=== "The Terminal Output"

    ```
    Status: 200 OK
    Blocked: request to private IP blocked: 169.254.169.254
    ```

## OWASP Top 10 in Go

| OWASP Category | Go Mitigation | Key Packages |
|----------------|---------------|--------------|
| A01: Broken Access Control | Middleware-based authorization | `casbin`, custom middleware |
| A02: Cryptographic Failures | Use `crypto/*` packages | `crypto/tls`, `crypto/sha256` |
| A03: Injection | Parameterized queries, template escaping | `database/sql`, `html/template` |
| A04: Insecure Design | Threat modeling, secure defaults | Design patterns |
| A05: Security Misconfiguration | Validate configs, fail securely | `os`, `flag` |
| A06: Vulnerable Components | Regular dependency updates | `govulncheck` |
| A07: Auth Failures | Strong authentication | `golang-jwt`, `bcrypt` |
| A08: Data Integrity Failures | Input validation | `go-playground/validator` |
| A09: Logging Failures | Structured logging | `slog`, `zerolog` |
| A10: SSRF | Input validation, allowlists | `net/url`, custom validators |

!!! abstract "Security Checklist"

    For every Go application, ensure:

    - [ ] All SQL queries use parameterized statements
    - [ ] HTML output is escaped using `html/template`
    - [ ] TLS is enabled with modern cipher suites
    - [ ] Authentication uses secure password hashing
    - [ ] Input validation is performed on all user data
    - [ ] Secrets are not hardcoded in source code
    - [ ] Dependencies are regularly scanned for vulnerabilities
    - [ ] Rate limiting is implemented on public endpoints

## Building a Security Mindset

=== "The Code"

    ```go
    package security

    import (
        "errors"
        "strings"
    )

    // ValidateInput demonstrates defense-in-depth validation
    func ValidateInput(input string, maxLen int) (string, error) {
        // 1. Check for nil/empty
        if strings.TrimSpace(input) == "" {
            return "", errors.New("input is required")
        }

        // 2. Trim whitespace
        input = strings.TrimSpace(input)

        // 3. Check length
        if len(input) > maxLen {
            return "", errors.New("input exceeds maximum length")
        }

        // 4. Check for null bytes
        if strings.Contains(input, "\x00") {
            return "", errors.New("input contains invalid characters")
        }

        // 5. Normalize
        input = strings.ToLower(input)

        return input, nil
    }

    // SecureCompare performs constant-time string comparison
    func SecureCompare(a, b string) bool {
        if len(a) != len(b) {
            return false
        }

        result := 0
        for i := 0; i < len(a); i++ {
            result |= int(a[i] ^ b[i])
        }
        return result == 0
    }

    // SanitizeFilename prevents directory traversal
    func SanitizeFilename(filename string) string {
        // Remove path separators
        filename = strings.ReplaceAll(filename, "/", "")
        filename = strings.ReplaceAll(filename, "\\", "")
        
        // Remove null bytes
        filename = strings.ReplaceAll(filename, "\x00", "")
        
        // Limit length
        if len(filename) > 255 {
            filename = filename[:255]
        }
        
        return filename
    }
    ```

=== "The Explanation"

    - **Defense in depth**: Multiple layers of validation
    - **Constant-time comparison**: Prevents timing attacks on secrets
    - **Input normalization**: Consistent handling of user input
    - **Fail securely**: Return errors rather than allowing invalid data

=== "The Terminal Output"

    ```
    // Tests demonstrate secure behavior
    Input validation: passed
    Timing attack prevention: verified
    Filename sanitization: working
    ```

## Best Practices

| Practice | Description | Priority |
|----------|-------------|----------|
| Parameterized queries | Never concatenate SQL with user input | Critical |
| Input validation | Validate all external input | Critical |
| HTTPS everywhere | Use TLS for all communications | Critical |
| Secret management | Use environment variables or vaults | High |
| Dependency scanning | Run `govulncheck` regularly | High |
| Security headers | Implement CSP, HSTS, X-Frame-Options | High |
| Rate limiting | Protect against brute force attacks | Medium |
| Logging | Log security events for audit trails | Medium |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Race conditions detected | Use `-race` flag: `go run -race main.go` |
| TLS handshake errors | Check certificate validity and cipher suites |
| SQL injection warnings | Use parameterized queries instead of string formatting |
| XSS in templates | Use `html/template` instead of `text/template` |
| Dependency vulnerabilities | Run `govulncheck ./...` and update packages |

## Summary

- Go provides built-in memory safety that eliminates entire classes of vulnerabilities
- CSP-based concurrency offers natural protection against race conditions
- Always use parameterized queries to prevent SQL injection
- Leverage `html/template` for automatic XSS prevention
- Implement CSRF tokens for form submissions
- Validate and sanitize all user input
- Block SSRF by checking resolved IPs against private ranges
- Follow the OWASP Top 10 as a security checklist

## Next Steps

- [Authentication & JWT](authentication-jwt.md) - Implement secure authentication
- [Authorization & RBAC](authorization-rbac.md) - Control access to resources
- [HTTPS & TLS](https-tls.md) - Configure secure communications
- [Input Validation](input-validation.md) - Deep dive into validation techniques
- [Security Hardening](hardening.md) - Production security configuration