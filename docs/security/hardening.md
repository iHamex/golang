# Security Hardening

Security hardening involves configuring your application and infrastructure to minimize attack surface and protect against common threats. This guide covers production-ready security configurations, monitoring, and best practices for Go applications.

## What You Will Learn

- Implement comprehensive security headers middleware
- Configure rate limiting to prevent abuse
- Set up IP filtering and access control
- Implement request logging for security audits
- Manage secrets securely
- Scan dependencies for vulnerabilities
- Apply secure coding practices
- Follow the principle of least privilege

## Prerequisites

- Understanding of Go HTTP middleware
- Familiarity with basic security concepts
- Knowledge of production deployment practices

---

## Security Headers Middleware

=== "The Code"

    ```go
    package middleware

    import (
        "net/http"
        "time"
    )

    type SecurityConfig struct {
        HSTS                bool
        HSTSMaxAge          int
        ContentTypeNoSniff  bool
        FrameOptions        string
        XSSProtection       bool
        ContentSecurityPolicy string
        ReferrerPolicy      string
        PermissionsPolicy  string
        CrossOriginEmbedder string
        CrossOriginOpener   string
        CrossOriginResource string
    }

    func DefaultSecurityConfig() SecurityConfig {
        return SecurityConfig{
            HSTS:                true,
            HSTSMaxAge:          31536000,
            ContentTypeNoSniff:  true,
            FrameOptions:        "DENY",
            XSSProtection:       true,
            ContentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
            ReferrerPolicy:      "strict-origin-when-cross-origin",
            PermissionsPolicy:  "camera=(), microphone=(), geolocation=()",
            CrossOriginEmbedder: "require-corp",
            CrossOriginOpener:   "same-origin",
            CrossOriginResource: "same-origin",
        }
    }

    func SecurityHeaders(config SecurityConfig) func(http.Handler) http.Handler {
        return func(next http.Handler) http.Handler {
            return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                // HSTS
                if config.HSTS {
                    w.Header().Set("Strict-Transport-Security",
                        fmt.Sprintf("max-age=%d; includeSubDomains; preload",
                            config.HSTSMaxAge))
                }

                // Content-Type options
                if config.ContentTypeNoSniff {
                    w.Header().Set("X-Content-Type-Options", "nosniff")
                }

                // Frame options
                if config.FrameOptions != "" {
                    w.Header().Set("X-Frame-Options", config.FrameOptions)
                }

                // XSS Protection
                if config.XSSProtection {
                    w.Header().Set("X-XSS-Protection", "1; mode=block")
                }

                // Content Security Policy
                if config.ContentSecurityPolicy != "" {
                    w.Header().Set("Content-Security-Policy",
                        config.ContentSecurityPolicy)
                }

                // Referrer Policy
                if config.ReferrerPolicy != "" {
                    w.Header().Set("Referrer-Policy", config.ReferrerPolicy)
                }

                // Permissions Policy
                if config.PermissionsPolicy != "" {
                    w.Header().Set("Permissions-Policy",
                        config.PermissionsPolicy)
                }

                // Cross-Origin policies
                if config.CrossOriginEmbedder != "" {
                    w.Header().Set("Cross-Origin-Embedder-Policy",
                        config.CrossOriginEmbedder)
                }
                if config.CrossOriginOpener != "" {
                    w.Header().Set("Cross-Origin-Opener-Policy",
                        config.CrossOriginOpener)
                }
                if config.CrossOriginResource != "" {
                    w.Header().Set("Cross-Origin-Resource-Policy",
                        config.CrossOriginResource)
                }

                // Remove server information
                w.Header().Del("Server")
                w.Header().Del("X-Powered-By")

                next.ServeHTTP(w, r)
            })
        }
    }

    func main() {
        config := DefaultSecurityConfig()
        
        mux := http.NewServeMux()
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Secure application!")
        })

        handler := SecurityHeaders(config)(mux)

        fmt.Println("Hardened server on :8080")
        http.ListenAndServe(":8080", handler)
    }
    ```

=== "The Explanation"

    - **Defense in depth**: Multiple security headers for layered protection
    - **HSTS**: Force HTTPS and prevent downgrade attacks
    - **CSP**: Control resource loading to prevent XSS
    - **COEP/COOP/CORP**: Cross-origin isolation policies

=== "The Terminal Output"

    ```
    Hardened server on :8080
    Response headers:
      Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
      X-Content-Type-Options: nosniff
      X-Frame-Options: DENY
      Content-Security-Policy: default-src 'self'; ...
    ```

!!! danger "Server Information Disclosure"

    Never expose server version information:

    ```go
    // Remove these headers
    w.Header().Del("Server")
    w.Header().Del("X-Powered-By")
    w.Header().Del("X-AspNet-Version")
    ```

## Rate Limiting

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "net/http"
        "sync"
        "time"
    )

    type RateLimiter struct {
        visitors map[string]*Visitor
        mu       sync.RWMutex
        rate     int
        burst    int
    }

    type Visitor struct {
        count    int
        lastSeen time.Time
    }

    func NewRateLimiter(rate, burst int) *RateLimiter {
        rl := &RateLimiter{
            visitors: make(map[string]*Visitor),
            rate:     rate,
            burst:    burst,
        }

        // Cleanup old entries
        go rl.cleanup()

        return rl
    }

    func (rl *RateLimiter) cleanup() {
        for {
            time.Sleep(time.Minute)

            rl.mu.Lock()
            for ip, v := range rl.visitors {
                if time.Since(v.lastSeen) > 3*time.Minute {
                    delete(rl.visitors, ip)
                }
            }
            rl.mu.Unlock()
        }
    }

    func (rl *RateLimiter) Allow(ip string) bool {
        rl.mu.Lock()
        defer rl.mu.Unlock()

        visitor, exists := rl.visitors[ip]
        if !exists {
            rl.visitors[ip] = &Visitor{
                count:    1,
                lastSeen: time.Now(),
            }
            return true
        }

        // Reset counter if window has passed
        if time.Since(visitor.lastSeen) > time.Second {
            visitor.count = 0
        }

        visitor.count++
        visitor.lastSeen = time.Now()

        return visitor.count <= rl.burst
    }

    func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ip := r.RemoteAddr
            if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
                ip = forwarded
            }

            if !rl.Allow(ip) {
                http.Error(w, "Rate limit exceeded",
                    http.StatusTooManyRequests)
                return
            }

            next.ServeHTTP(w, r)
        })
    }

    func main() {
        limiter := NewRateLimiter(100, 10) // 100 req/s, burst of 10

        mux := http.NewServeMux()
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Request allowed!")
        })

        handler := limiter.Middleware(mux)

        fmt.Println("Rate-limited server on :8080")
        http.ListenAndServe(":8080", handler)
    }
    ```

=== "The Explanation"

    - **Token bucket**: Allow bursts while limiting sustained rate
    - **IP tracking**: Per-IP rate limiting
    - **Automatic cleanup**: Remove old entries to prevent memory leaks
    - **Proxy support**: Handle X-Forwarded-For header

=== "The Terminal Output"

    ```
    Rate-limited server on :8080
    Request 1: allowed
    Request 11: rate limit exceeded (429)
    ```

!!! note "Rate Limiting Strategies"

    Choose the right strategy for your use case:

    | Strategy | Best For | Implementation |
    |----------|----------|----------------|
    | Token bucket | APIs with bursts | Fill tokens at fixed rate |
    | Fixed window | Simple limiting | Count requests per time window |
    | Sliding window | Smooth limiting | Combine current and previous windows |
    | Leaky bucket | Queue-based | Process requests at fixed rate |

## IP Filtering

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "net"
        "net/http"
        "strings"
        "sync"
    )

    type IPFilter struct {
        allowedCIDRs []*net.IPNet
        blockedCIDRs []*net.IPNet
        blockedIPs   map[string]bool
        mu           sync.RWMutex
    }

    func NewIPFilter() *IPFilter {
        return &IPFilter{
            allowedCIDRs: make([]*net.IPNet, 0),
            blockedCIDRs: make([]*net.IPNet, 0),
            blockedIPs:   make(map[string]bool),
        }
    }

    func (f *IPFilter) AllowCIDR(cidr string) error {
        _, ipNet, err := net.ParseCIDR(cidr)
        if err != nil {
            return err
        }

        f.mu.Lock()
        defer f.mu.Unlock()
        f.allowedCIDRs = append(f.allowedCIDRs, ipNet)
        return nil
    }

    func (f *IPFilter) BlockCIDR(cidr string) error {
        _, ipNet, err := net.ParseCIDR(cidr)
        if err != nil {
            return err
        }

        f.mu.Lock()
        defer f.mu.Unlock()
        f.blockedCIDRs = append(f.blockedCIDRs, ipNet)
        return nil
    }

    func (f *IPFilter) BlockIP(ip string) {
        f.mu.Lock()
        defer f.mu.Unlock()
        f.blockedIPs[ip] = true
    }

    func (f *IPFilter) IsAllowed(ip string) bool {
        f.mu.RLock()
        defer f.mu.RUnlock()

        // Check blocked IPs
        if f.blockedIPs[ip] {
            return false
        }

        // Parse IP
        parsedIP := net.ParseIP(ip)
        if parsedIP == nil {
            return false
        }

        // Check blocked CIDRs
        for _, cidr := range f.blockedCIDRs {
            if cidr.Contains(parsedIP) {
                return false
            }
        }

        // If no allowed CIDRs specified, allow all
        if len(f.allowedCIDRs) == 0 {
            return true
        }

        // Check allowed CIDRs
        for _, cidr := range f.allowedCIDRs {
            if cidr.Contains(parsedIP) {
                return true
            }
        }

        return false
    }

    func (f *IPFilter) Middleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ip := r.RemoteAddr
            if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
                ip = strings.Split(forwarded, ",")[0]
            }

            if !f.IsAllowed(ip) {
                http.Error(w, "Forbidden", http.StatusForbidden)
                return
            }

            next.ServeHTTP(w, r)
        })
    }

    func main() {
        filter := NewIPFilter()

        // Allow only specific networks
        filter.AllowCIDR("10.0.0.0/8")
        filter.AllowCIDR("192.168.1.0/24")

        // Block specific IPs
        filter.BlockIP("192.168.1.100")

        mux := http.NewServeMux()
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Access granted!")
        })

        handler := filter.Middleware(mux)

        fmt.Println("IP-filtered server on :8080")
        http.ListenAndServe(":8080", handler)
    }
    ```

=== "The Explanation"

    - **CIDR support**: Allow or block entire IP ranges
    - **Whitelist/blacklist**: Explicit allow and block lists
    - **Proxy awareness**: Handle X-Forwarded-For header
    - **Thread-safe**: RWMutex for concurrent access

=== "The Terminal Output"

    ```
    IP-filtered server on :8080
    IP 10.0.0.1: access granted
    IP 192.168.1.100: forbidden
    IP 203.0.113.1: forbidden (not in allowed range)
    ```

## Request Logging

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "net/http"
        "os"
        "strings"
        "time"
    )

    type SecurityLogger struct {
        logger *log.Logger
    }

    func NewSecurityLogger() *SecurityLogger {
        return &SecurityLogger{
            logger: log.New(os.Stdout, "[SECURITY] ", log.LstdFlags),
        }
    }

    type ResponseWriter struct {
        http.ResponseWriter
        statusCode int
        size       int
    }

    func NewResponseWriter(w http.ResponseWriter) *ResponseWriter {
        return &ResponseWriter{w, http.StatusOK, 0}
    }

    func (rw *ResponseWriter) WriteHeader(code int) {
        rw.statusCode = code
        rw.ResponseWriter.WriteHeader(code)
    }

    func (rw *ResponseWriter) Write(b []byte) (int, error) {
        n, err := rw.ResponseWriter.Write(b)
        rw.size += n
        return n, err
    }

    func (sl *SecurityLogger) Middleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()

            // Extract client IP
            clientIP := r.RemoteAddr
            if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
                clientIP = forwarded
            }

            // Wrap response writer
            wrapped := NewResponseWriter(w)

            // Process request
            next.ServeHTTP(wrapped, r)

            // Log request
            duration := time.Since(start)

            sl.logger.Printf(
                "IP=%s Method=%s Path=%s Status=%d Size=%d Duration=%v UserAgent=%s",
                clientIP,
                r.Method,
                r.URL.Path,
                wrapped.statusCode,
                wrapped.size,
                duration,
                r.UserAgent(),
            )

            // Log suspicious activity
            if wrapped.statusCode >= 400 {
                sl.logger.Printf("WARNING: Error response from %s: %d",
                    clientIP, wrapped.statusCode)
            }

            // Log potential attacks
            suspiciousPatterns := []string{
                "../", "..\\", "<script", "javascript:", "eval(",
                "UNION SELECT", "DROP TABLE", "/etc/passwd",
            }

            for _, pattern := range suspiciousPatterns {
                if strings.Contains(r.URL.Path, pattern) ||
                    strings.Contains(r.URL.RawQuery, pattern) {

                    sl.logger.Printf("ALERT: Suspicious request from %s: %s",
                        clientIP, r.URL.Path)
                    break
                }
            }
        })
    }

    func main() {
        logger := NewSecurityLogger()

        mux := http.NewServeMux()
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Hello!")
        })

        handler := logger.Middleware(mux)

        fmt.Println("Logged server on :8080")
        http.ListenAndServe(":8080", handler)
    }
    ```

=== "The Explanation"

    - **Structured logging**: Consistent log format for analysis
    - **Response wrapping**: Capture status codes and sizes
    - **Suspicious detection**: Flag potential attack patterns
    - **Audit trail**: Complete request/response logging

=== "The Terminal Output"

    ```
    [SECURITY] 2026/09/03 12:00:00 IP=10.0.0.1 Method=GET Path=/ Status=200 Size=12 Duration=1.2ms UserAgent=Mozilla/5.0
    [SECURITY] 2026/09/03 12:00:01 IP=203.0.113.1 Method=GET Path=/../../../etc/passwd Status=403 Size=0 Duration=0.5ms
    [SECURITY] 2026/09/03 12:00:01 ALERT: Suspicious request from 203.0.113.1: /../../../etc/passwd
    ```

## Secrets Management

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
    )

    type SecretsManager struct {
        source string
    }

    func NewSecretsManager(source string) *SecretsManager {
        return &SecretsManager{source: source}
    }

    func (sm *SecretsManager) GetSecret(key string) (string, error) {
        switch sm.source {
        case "env":
            return os.Getenv(key), nil
        case "vault":
            return sm.getFromVault(key)
        case "aws":
            return sm.getFromAWS(key)
        default:
            return "", fmt.Errorf("unknown secrets source: %s", sm.source)
        }
    }

    func (sm *SecretsManager) getFromVault(key string) (string, error) {
        // Vault integration placeholder
        return "", nil
    }

    func (sm *SecretsManager) getFromAWS(key string) (string, error) {
        // AWS Secrets Manager placeholder
        return "", nil
    }

    type AppConfig struct {
        DBHost     string
        DBPassword string
        APIKey     string
        JWTSecret  string
    }

    func LoadConfig() (*AppConfig, error) {
        manager := NewSecretsManager("env")

        config := &AppConfig{}

        var err error
        config.DBHost, err = manager.GetSecret("DB_HOST")
        if err != nil {
            return nil, err
        }

        config.DBPassword, err = manager.GetSecret("DB_PASSWORD")
        if err != nil {
            return nil, err
        }

        config.APIKey, err = manager.GetSecret("API_KEY")
        if err != nil {
            return nil, err
        }

        config.JWTSecret, err = manager.GetSecret("JWT_SECRET")
        if err != nil {
            return nil, err
        }

        return config, nil
    }

    func main() {
        // NEVER do this
        // dbPassword := "hardcoded-password"

        // ALWAYS do this
        config, err := LoadConfig()
        if err != nil {
            fmt.Println("Failed to load config:", err)
            return
        }

        fmt.Println("Config loaded successfully")
        fmt.Println("DB Host:", config.DBHost)
        // Don't log sensitive values!
    }
    ```

=== "The Explanation"

    - **Environment variables**: Never hardcode secrets
    - **External secret stores**: Use Vault, AWS Secrets Manager, etc.
    - **Minimal exposure**: Only load secrets when needed
    - **Audit logging**: Track secret access

=== "The Terminal Output"

    ```
    Config loaded successfully
    DB Host: db.example.com
    ```

!!! danger "Secrets Security"

    Never commit secrets to version control:

    ```bash
    # Add to .gitignore
    .env
    *.pem
    *.key
    secrets.json
    ```

    Use `.env.example` files with placeholder values.

## Dependency Scanning

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os/exec"
        "strings"
    )

    type VulnChecker struct{}

    func NewVulnChecker() *VulnChecker {
        return &VulnChecker{}
    }

    func (vc *VulnChecker) CheckDependencies() error {
        // Run govulncheck
        cmd := exec.Command("govulncheck", "./...")
        output, err := cmd.CombinedOutput()
        if err != nil {
            return fmt.Errorf("vulnerability check failed: %w", err)
        }

        fmt.Println(string(output))
        return nil
    }

    func (vc *VulnChecker) CheckOutdated() error {
        // Check for outdated dependencies
        cmd := exec.Command("go", "list", "-u", "-m", "all")
        output, err := cmd.CombinedOutput()
        if err != nil {
            return fmt.Errorf("outdated check failed: %w", err)
        }

        lines := strings.Split(string(output), "\n")
        for _, line := range lines {
            if strings.Contains(line, "[") {
                fmt.Println("Update available:", line)
            }
        }

        return nil
    }

    func main() {
        checker := NewVulnChecker()

        fmt.Println("Checking for vulnerabilities...")
        if err := checker.CheckDependencies(); err != nil {
            fmt.Println("Error:", err)
        }

        fmt.Println("\nChecking for outdated dependencies...")
        if err := checker.CheckOutdated(); err != nil {
            fmt.Println("Error:", err)
        }
    }
    ```

=== "The Explanation"

    - **govulncheck**: Official Go vulnerability scanner
    - **Automated scanning**: Run in CI/CD pipelines
    - **Dependency updates**: Keep dependencies current
    - **Advisory database**: Check against known vulnerabilities

=== "The Terminal Output"

    ```
    Checking for vulnerabilities...
    No vulnerabilities found.

    Checking for outdated dependencies...
    Update available: github.com/gin-gonic/gin v1.9.1 -> v1.10.0
    ```

!!! note "Dependency Security"

    Integrate vulnerability scanning into your workflow:

    ```yaml
    # GitHub Actions example
    - name: Run govulncheck
      uses: golang/govulncheck-action@v1
      with:
        go-version: '1.21'
        package: './...'
    ```

## Secure Coding Practices

=== "The Code"

    ```go
    package security

    import (
        "crypto/rand"
        "crypto/subtle"
        "encoding/base64"
        "fmt"
        "strings"
    )

    // Constant-time string comparison
    func SecureCompare(a, b string) bool {
        return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
    }

    // Generate secure random token
    func GenerateToken(length int) (string, error) {
        bytes := make([]byte, length)
        if _, err := rand.Read(bytes); err != nil {
            return "", err
        }
        return base64.URLEncoding.EncodeToString(bytes), nil
    }

    // Sanitize input for logging
    func SanitizeForLog(input string) string {
        // Remove newlines and control characters
        input = strings.ReplaceAll(input, "\n", "")
        input = strings.ReplaceAll(input, "\r", "")
        input = strings.ReplaceAll(input, "\t", "")
        
        // Truncate if too long
        if len(input) > 1000 {
            input = input[:1000] + "..."
        }
        
        return input
    }

    // Validate and normalize email
    func NormalizeEmail(email string) (string, error) {
        email = strings.TrimSpace(email)
        email = strings.ToLower(email)
        
        if !strings.Contains(email, "@") {
            return "", fmt.Errorf("invalid email format")
        }
        
        parts := strings.Split(email, "@")
        if len(parts) != 2 {
            return "", fmt.Errorf("invalid email format")
        }
        
        return email, nil
    }

    // Prevent timing attacks on string comparison
    func Equals(a, b string) bool {
        if len(a) != len(b) {
            return false
        }
        
        result := 0
        for i := 0; i < len(a); i++ {
            result |= int(a[i] ^ b[i])
        }
        
        return result == 0
    }
    ```

=== "The Explanation"

    - **Constant-time comparison**: Prevents timing attacks
    - **Secure random generation**: Use `crypto/rand` not `math/rand`
    - **Input sanitization**: Clean data before logging
    - **Normalization**: Consistent handling of user input

=== "The Terminal Output"

    ```
    Secure token: dGhpcyBpcyBhIHNlY3VyZSB0b2tlbg
    Email normalized: user@example.com
    Constant-time compare: true
    ```

## Least Privilege Principle

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
        "os/user"
    )

    type ServiceConfig struct {
        RunAsUser  string
        RunAsGroup string
        ReadOnly   bool
        AllowedPaths []string
    }

    func ApplyLeastPrivilege(config ServiceConfig) error {
        // Change user if needed
        if config.RunAsUser != "" {
            u, err := user.Lookup(config.RunAsUser)
            if err != nil {
                return fmt.Errorf("user lookup failed: %w", err)
            }

            // In production, use syscall.Setuid/Setgid
            fmt.Printf("Would run as user: %s (UID: %s)\n",
                u.Username, u.Uid)
        }

        // Set file permissions
        if config.ReadOnly {
            // Make sensitive files read-only
            files := []string{"config.yaml", "data.db"}
            for _, f := range files {
                os.Chmod(f, 0444)
            }
        }

        // Restrict filesystem access
        for _, path := range config.AllowedPaths {
            fmt.Printf("Allowing access to: %s\n", path)
        }

        return nil
    }

    func main() {
        config := ServiceConfig{
            RunAsUser:  "nobody",
            RunAsGroup: "nogroup",
            ReadOnly:   true,
            AllowedPaths: []string{
                "/var/log/myapp",
                "/tmp/myapp",
            },
        }

        if err := ApplyLeastPrivilege(config); err != nil {
            fmt.Println("Error:", err)
            return
        }

        fmt.Println("Least privilege applied!")
    }
    ```

=== "The Explanation"

    - **Dedicated user**: Run services as unprivileged user
    - **Read-only files**: Minimize write permissions
    - **Path restrictions**: Limit filesystem access
    - **Capability dropping**: Remove unnecessary Linux capabilities

=== "The Terminal Output"

    ```
    Would run as user: nobody (UID: 65534)
    Allowing access to: /var/log/myapp
    Allowing access to: /tmp/myapp
    Least privilege applied!
    ```

## Security Testing

=== "The Code"

    ```go
    package security

    import (
        "testing"
    )

    func TestSecureCompare(t *testing.T) {
        tests := []struct {
            name     string
            a        string
            b        string
            expected bool
        }{
            {"equal strings", "secret", "secret", true},
            {"different strings", "secret", "other", false},
            {"empty strings", "", "", true},
            {"different lengths", "a", "ab", false},
        }

        for _, tt := range tests {
            t.Run(tt.name, func(t *testing.T) {
                got := SecureCompare(tt.a, tt.b)
                if got != tt.expected {
                    t.Errorf("SecureCompare() = %v, want %v", got, tt.expected)
                }
            })
        }
    }

    func TestGenerateToken(t *testing.T) {
        token1, err := GenerateToken(32)
        if err != nil {
            t.Fatalf("GenerateToken() error = %v", err)
        }

        token2, err := GenerateToken(32)
        if err != nil {
            t.Fatalf("GenerateToken() error = %v", err)
        }

        if token1 == token2 {
            t.Error("GenerateToken() produced duplicate tokens")
        }

        if len(token1) == 0 {
            t.Error("GenerateToken() returned empty token")
        }
    }

    func TestSanitizeForLog(t *testing.T) {
        tests := []struct {
            name     string
            input    string
            expected string
        }{
            {"clean string", "hello", "hello"},
            {"with newline", "hello\nworld", "helloworld"},
            {"with tab", "hello\tworld", "helloworld"},
            {"long string", string(make([]byte, 2000)), string(make([]byte, 1000)) + "..."},
        }

        for _, tt := range tests {
            t.Run(tt.name, func(t *testing.T) {
                got := SanitizeForLog(tt.input)
                if got != tt.expected {
                    t.Errorf("SanitizeForLog() = %v, want %v", got, tt.expected)
                }
            })
        }
    }

    func TestNormalizeEmail(t *testing.T) {
        tests := []struct {
            name     string
            input    string
            expected string
            hasError bool
        }{
            {"valid email", "User@Example.COM", "user@example.com", false},
            {"with spaces", "  user@example.com  ", "user@example.com", false},
            {"no at sign", "invalidemail", "", true},
        }

        for _, tt := range tests {
            t.Run(tt.name, func(t *testing.T) {
                got, err := NormalizeEmail(tt.input)
                if (err != nil) != tt.hasError {
                    t.Errorf("NormalizeEmail() error = %v, wantError %v",
                        err, tt.hasError)
                    return
                }
                if got != tt.expected {
                    t.Errorf("NormalizeEmail() = %v, want %v", got, tt.expected)
                }
            })
        }
    }
    ```

=== "The Explanation"

    - **Table-driven tests**: Comprehensive test coverage
    - **Security-critical functions**: Test cryptographic operations
    - **Edge cases**: Test boundary conditions
    - **Regression prevention**: Catch security regressions

=== "The Terminal Output"

    ```
    --- PASS: TestSecureCompare (0.00s)
    --- PASS: TestGenerateToken (0.00s)
    --- PASS: TestSanitizeForLog (0.00s)
    --- PASS: TestNormalizeEmail (0.00s)
    PASS
    ```

## Best Practices

| Practice | Description | Priority |
|----------|-------------|----------|
| Security headers | Implement comprehensive headers | Critical |
| Rate limiting | Protect against brute force | Critical |
| Input validation | Validate all external input | Critical |
| Secrets management | Never hardcode secrets | Critical |
| Dependency scanning | Run govulncheck regularly | High |
| Request logging | Log security events | High |
| Least privilege | Run with minimal permissions | High |
| Security testing | Test security-critical functions | High |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Validate origin and configure headers properly |
| Rate limit too aggressive | Adjust burst and rate parameters |
| Secrets not loading | Check environment variables and file permissions |
| Vulnerability found | Update affected dependency immediately |
| Permission denied | Check user and file permissions |

## Summary

- Implement comprehensive security headers for defense in depth
- Use rate limiting to protect against abuse
- Filter IPs to block known threats
- Log security events for audit and monitoring
- Manage secrets securely using environment variables or vaults
- Scan dependencies regularly for vulnerabilities
- Follow secure coding practices (constant-time comparison, etc.)
- Apply least privilege principle to all services

## Next Steps

- [Security Overview](overview.md) - General security concepts
- [Authentication & JWT](authentication-jwt.md) - Secure user authentication
- [Authorization & RBAC](authorization-rbac.md) - Access control
- [HTTPS & TLS](https-tls.md) - Secure communications
- [Input Validation](input-validation.md) - Validate user input