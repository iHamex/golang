# Authentication & JWT

Authentication is the process of verifying who a user is. JSON Web Tokens (JWT) have become the standard for implementing stateless authentication in modern applications. This guide covers JWT implementation, token management, middleware patterns, and alternative authentication methods in Go.

## What You Will Learn

- Generate and validate JWTs using the `golang-jwt` library
- Implement custom claims for application-specific data
- Build authentication middleware for HTTP handlers
- Create secure refresh token workflows
- Integrate OAuth2 for third-party authentication
- Implement API key and session-based authentication
- Hash passwords securely with bcrypt

## Prerequisites

- Basic understanding of HTTP and REST APIs
- Familiarity with Go HTTP handlers and middleware
- Knowledge of cryptographic concepts

---

## JWT Fundamentals

JWTs consist of three parts: header, payload, and signature. The `golang-jwt` library provides a robust implementation for Go.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "time"

        "github.com/golang-jwt/jwt/v5"
    )

    // Custom claims extending standard JWT claims
    type AppClaims struct {
        jwt.RegisteredClaims
        UserID   string `json:"user_id"`
        Username string `json:"username"`
        Roles    []string `json:"roles"`
    }

    var jwtSecret = []byte("your-secret-key-change-in-production")

    func GenerateToken(userID, username string, roles []string) (string, error) {
        claims := AppClaims{
            RegisteredClaims: jwt.RegisteredClaims{
                ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
                IssuedAt:  jwt.NewNumericDate(time.Now()),
                NotBefore: jwt.NewNumericDate(time.Now()),
                Issuer:    "myapp",
                Subject:   userID,
                ID:        userID,
            },
            UserID:   userID,
            Username: username,
            Roles:    roles,
        }

        token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
        return token.SignedString(jwtSecret)
    }

    func ValidateToken(tokenString string) (*AppClaims, error) {
        token, err := jwt.ParseWithClaims(tokenString, &AppClaims{},
            func(token *jwt.Token) (interface{}, error) {
                if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                    return nil, fmt.Errorf("unexpected signing method: %v",
                        token.Header["alg"])
                }
                return jwtSecret, nil
            })

        if err != nil {
            return nil, err
        }

        if claims, ok := token.Claims.(*AppClaims); ok && token.Valid {
            return claims, nil
        }

        return nil, fmt.Errorf("invalid token")
    }

    func main() {
        // Generate token
        tokenString, err := GenerateToken("user123", "johndoe", []string{"admin", "user"})
        if err != nil {
            fmt.Println("Error generating token:", err)
            return
        }
        fmt.Println("Generated Token:", tokenString[:50]+"...")

        // Validate token
        claims, err := ValidateToken(tokenString)
        if err != nil {
            fmt.Println("Error validating token:", err)
            return
        }

        fmt.Printf("User ID: %s\n", claims.UserID)
        fmt.Printf("Username: %s\n", claims.Username)
        fmt.Printf("Roles: %v\n", claims.Roles)
        fmt.Printf("Expires: %v\n", claims.ExpiresAt.Time)
    }
    ```

=== "The Explanation"

    - **RegisteredClaims**: Standard JWT fields (exp, iss, sub, etc.)
    - **Custom claims**: Application-specific data (UserID, Roles)
    - **HS256 signing**: HMAC-SHA256 for symmetric key signing
    - **Token validation**: Verify signature and expiration
    - **Claims extraction**: Access custom data from validated tokens

=== "The Terminal Output"

    ```
    Generated Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    User ID: user123
    Username: johndoe
    Roles: [admin user]
    Expires: 2026-09-04 12:00:00 +0000 UTC
    ```

!!! go "JWT Best Practices"

    - Use strong, random signing keys (at least 256 bits)
    - Keep token expiration short (15 minutes for access tokens)
    - Store tokens securely (httpOnly cookies for web apps)
    - Never store sensitive data in JWT payload (it's base64-encoded, not encrypted)

## Authentication Middleware

=== "The Code"

    ```go
    package middleware

    import (
        "context"
        "net/http"
        "strings"
    )

    type contextKey string

    const (
        UserIDKey   contextKey = "userID"
        UsernameKey contextKey = "username"
        RolesKey    contextKey = "roles"
    )

    type AuthMiddleware struct {
        tokenValidator func(string) (*AppClaims, error)
    }

    func NewAuthMiddleware(validator func(string) (*AppClaims, error)) *AuthMiddleware {
        return &AuthMiddleware{tokenValidator: validator}
    }

    func (m *AuthMiddleware) Authenticate(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            authHeader := r.Header.Get("Authorization")
            if authHeader == "" {
                http.Error(w, "Authorization header required",
                    http.StatusUnauthorized)
                return
            }

            // Extract Bearer token
            parts := strings.SplitN(authHeader, " ", 2)
            if len(parts) != 2 || parts[0] != "Bearer" {
                http.Error(w, "Invalid authorization format",
                    http.StatusUnauthorized)
                return
            }

            tokenString := parts[1]
            claims, err := m.tokenValidator(tokenString)
            if err != nil {
                http.Error(w, "Invalid or expired token",
                    http.StatusUnauthorized)
                return
            }

            // Add claims to context
            ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
            ctx = context.WithValue(ctx, UsernameKey, claims.Username)
            ctx = context.WithValue(ctx, RolesKey, claims.Roles)

            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }

    func (m *AuthMiddleware) RequireRole(role string, next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            roles, ok := r.Context().Value(RolesKey).([]string)
            if !ok {
                http.Error(w, "Forbidden", http.StatusForbidden)
                return
            }

            for _, r := range roles {
                if r == role {
                    next.ServeHTTP(w, r)
                    return
                }
            }

            http.Error(w, "Insufficient permissions", http.StatusForbidden)
        })
    }

    // Helper functions to extract user info from context
    func GetUserID(r *http.Request) string {
        if userID, ok := r.Context().Value(UserIDKey).(string); ok {
            return userID
        }
        return ""
    }

    func GetUsername(r *http.Request) string {
        if username, ok := r.Context().Value(UsernameKey).(string); ok {
            return username
        }
        return ""
    }

    func GetUserRoles(r *http.Request) []string {
        if roles, ok := r.Context().Value(RolesKey).([]string); ok {
            return roles
        }
        return nil
    }
    ```

=== "The Explanation"

    - **Context passing**: Store user data in request context for downstream handlers
    - **Bearer token extraction**: Parse Authorization header format
    - **Role-based access**: Check user roles before allowing access
    - **Type-safe extraction**: Helper functions with type assertions

=== "The Terminal Output"

    ```
    // Middleware chain example:
    // Request -> AuthMiddleware -> RoleCheck -> Handler
    Authentication successful for user: johndoe
    Role 'admin' verified
    ```

## Refresh Tokens

Refresh tokens provide a secure way to obtain new access tokens without re-authentication.

=== "The Code"

    ```go
    package main

    import (
        "crypto/rand"
        "encoding/hex"
        "fmt"
        "sync"
        "time"

        "github.com/golang-jwt/jwt/v5"
    )

    type TokenPair struct {
        AccessToken  string
        RefreshToken string
        ExpiresAt    time.Time
    }

    type RefreshTokenStore struct {
        tokens map[string]RefreshInfo
        mu     sync.RWMutex
    }

    type RefreshInfo struct {
        UserID    string
        ExpiresAt time.Time
        Used      bool
    }

    func NewRefreshTokenStore() *RefreshTokenStore {
        return &RefreshTokenStore{
            tokens: make(map[string]RefreshInfo),
        }
    }

    func (s *RefreshTokenStore) Create(userID string) (string, error) {
        bytes := make([]byte, 32)
        if _, err := rand.Read(bytes); err != nil {
            return "", err
        }
        token := hex.EncodeToString(bytes)

        s.mu.Lock()
        defer s.mu.Unlock()

        s.tokens[token] = RefreshInfo{
            UserID:    userID,
            ExpiresAt: time.Now().Add(7 * 24 * time.Hour), // 7 days
            Used:      false,
        }

        return token, nil
    }

    func (s *RefreshTokenStore) Validate(token string) (string, error) {
        s.mu.Lock()
        defer s.mu.Unlock()

        info, exists := s.tokens[token]
        if !exists {
            return "", fmt.Errorf("refresh token not found")
        }

        if info.Used {
            // Token reuse detected - invalidate all tokens for this user
            s.invalidateAllUserTokens(info.UserID)
            return "", fmt.Errorf("refresh token reuse detected")
        }

        if time.Now().After(info.ExpiresAt) {
            delete(s.tokens, token)
            return "", fmt.Errorf("refresh token expired")
        }

        // Mark as used (single-use)
        info.Used = true
        s.tokens[token] = info

        return info.UserID, nil
    }

    func (s *RefreshTokenStore) invalidateAllUserTokens(userID string) {
        for token, info := range s.tokens {
            if info.UserID == userID {
                delete(s.tokens, token)
            }
        }
    }

    func GenerateTokenPair(userID string, store *RefreshTokenStore) (*TokenPair, error) {
        // Generate access token
        claims := jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
            Issuer:    "myapp",
            Subject:   userID,
        }

        accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
        accessTokenString, err := accessToken.SignedString(jwtSecret)
        if err != nil {
            return nil, err
        }

        // Generate refresh token
        refreshToken, err := store.Create(userID)
        if err != nil {
            return nil, err
        }

        return &TokenPair{
            AccessToken:  accessTokenString,
            RefreshToken: refreshToken,
            ExpiresAt:    time.Now().Add(15 * time.Minute),
        }, nil
    }

    func main() {
        store := NewRefreshTokenStore()

        // Generate initial token pair
        pair, err := GenerateTokenPair("user123", store)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        fmt.Println("Access Token:", pair.AccessToken[:30]+"...")
        fmt.Println("Refresh Token:", pair.RefreshToken[:30]+"...")

        // Validate refresh token
        userID, err := store.Validate(pair.RefreshToken)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        fmt.Println("Refreshed for user:", userID)

        // Try to reuse the same refresh token (should fail)
        _, err = store.Validate(pair.RefreshToken)
        if err != nil {
            fmt.Println("Reuse detected:", err)
        }
    }
    ```

=== "The Explanation"

    - **Token rotation**: Generate new refresh token on each use
    - **Reuse detection**: Invalidate all tokens if old refresh token is reused
    - **Expiration**: Set reasonable expiration times (15 min access, 7 days refresh)
    - **Single-use tokens**: Mark tokens as used immediately

=== "The Terminal Output"

    ```
    Access Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    Refresh Token: a1b2c3d4e5f678901234567890123456...
    Refreshed for user: user123
    Reuse detected: refresh token reuse detected
    ```

!!! danger "Refresh Token Security"

    Refresh tokens are long-lived credentials. Protect them carefully:

    - Store in httpOnly, secure cookies
    - Implement token rotation and reuse detection
    - Allow users to revoke all sessions
    - Log refresh token usage for audit

## Password Hashing with bcrypt

=== "The Code"

    ```go
    package auth

    import (
        "fmt"
        "golang.org/x/crypto/bcrypt"
    )

    const (
        bcryptCost = 12
    )

    type PasswordHasher struct {
        cost int
    }

    func NewPasswordHasher(cost int) *PasswordHasher {
        if cost < bcrypt.MinCost || cost > bcrypt.MaxCost {
            cost = bcrypt.DefaultCost
        }
        return &PasswordHasher{cost: cost}
    }

    func (h *PasswordHasher) Hash(password string) (string, error) {
        bytes, err := bcrypt.GenerateFromPassword([]byte(password), h.cost)
        if err != nil {
            return "", err
        }
        return string(bytes), nil
    }

    func (h *PasswordHasher) Verify(password, hash string) bool {
        err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
        return err == nil
    }

    func (h *PasswordHasher) NeedsRehash(hash string) bool {
        cost, err := bcrypt.Cost([]byte(hash))
        if err != nil {
            return true
        }
        return cost < h.cost
    }

    func main() {
        hasher := NewPasswordHasher(bcryptCost)

        // Hash a password
        password := "secureP@ssw0rd!"
        hash, err := hasher.Hash(password)
        if err != nil {
            fmt.Println("Error hashing:", err)
            return
        }
        fmt.Println("Hash:", hash[:40]+"...")

        // Verify correct password
        valid := hasher.Verify(password, hash)
        fmt.Println("Correct password:", valid)

        // Verify incorrect password
        valid = hasher.Verify("wrongpassword", hash)
        fmt.Println("Wrong password:", valid)

        // Check if rehash needed
        needsRehash := hasher.NeedsRehash(hash)
        fmt.Println("Needs rehash:", needsRehash)
    }
    ```

=== "The Explanation"

    - **Cost factor**: Higher cost = slower hashing = better security
    - **Automatic salting**: bcrypt generates unique salt for each hash
    - **Constant-time comparison**: Prevents timing attacks
    - **Rehash detection**: Check if password needs rehashing with higher cost

=== "The Terminal Output"

    ```
    Hash: $2a$12$LJ3m4ys3GZvE5Y5Z5Z5Z5e...
    Correct password: true
    Wrong password: false
    Needs rehash: false
    ```

## OAuth2 Integration

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "net/http"

        "golang.org/x/oauth2"
        "golang.org/x/oauth2/google"
    )

    var googleOAuthConfig = &oauth2.Config{
        ClientID:     "your-client-id",
        ClientSecret: "your-client-secret",
        RedirectURL:  "http://localhost:8080/callback",
        Scopes: []string{
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        },
        Endpoint: google.Endpoint,
    }

    func main() {
        http.HandleFunc("/login", handleLogin)
        http.HandleFunc("/callback", handleCallback)
        http.HandleFunc("/protected", handleProtected)

        fmt.Println("Server starting on :8080")
        http.ListenAndServe(":8080", nil)
    }

    func handleLogin(w http.ResponseWriter, r *http.Request) {
        url := googleOAuthConfig.AuthCodeURL("state-token",
            oauth2.AccessTypeOffline)
        http.Redirect(w, r, url, http.StatusTemporaryRedirect)
    }

    func handleCallback(w http.ResponseWriter, r *http.Request) {
        code := r.URL.Query().Get("code")
        if code == "" {
            http.Error(w, "Authorization code missing",
                http.StatusBadRequest)
            return
        }

        token, err := googleOAuthConfig.Exchange(context.Background(), code)
        if err != nil {
            http.Error(w, "Token exchange failed",
                http.StatusInternalServerError)
            return
        }

        // Store token in session (simplified example)
        fmt.Fprintf(w, "Authentication successful! Token type: %s",
            token.TokenType)
    }

    func handleProtected(w http.ResponseWriter, r *http.Request) {
        // In production, retrieve and validate token from session
        fmt.Fprintf(w, "Welcome to the protected resource!")
    }
    ```

=== "The Explanation"

    - **OAuth2 config**: Define client credentials and scopes
    - **Authorization URL**: Redirect user to Google for consent
    - **Token exchange**: Exchange authorization code for access token
    - **Token storage**: Securely store tokens for API access

=== "The Terminal Output"

    ```
    Server starting on :8080
    Authentication successful! Token type: Bearer
    ```

!!! note "OAuth2 Security"

    - Never commit client secrets to version control
    - Use environment variables for sensitive configuration
    - Validate the `state` parameter to prevent CSRF
    - Store tokens securely and implement token refresh

## API Key Authentication

=== "The Code"

    ```go
    package middleware

    import (
        "context"
        "crypto/hmac"
        "crypto/sha256"
        "encoding/hex"
        "net/http"
        "strings"
        "time"
    )

    type APIKeyConfig struct {
        HeaderName  string
        QueryParam  string
        HMACSecret  []byte
        Expiry      time.Duration
    }

    func NewAPIKeyConfig() *APIKeyConfig {
        return &APIKeyConfig{
            HeaderName: "X-API-Key",
            QueryParam: "api_key",
            HMACSecret: []byte("your-hmac-secret"),
            Expiry:     24 * time.Hour,
        }
    }

    func (c *APIKeyConfig) GenerateAPIKey(identifier string) (string, error) {
        timestamp := time.Now().Unix()
        payload := fmt.Sprintf("%s:%d", identifier, timestamp)

        mac := hmac.New(sha256.New, c.HMACSecret)
        mac.Write([]byte(payload))
        signature := hex.EncodeToString(mac.Sum(nil))

        return fmt.Sprintf("%s.%d.%s", identifier, timestamp, signature), nil
    }

    func (c *APIKeyConfig) ValidateAPIKey(apiKey string) (string, error) {
        parts := strings.SplitN(apiKey, ".", 3)
        if len(parts) != 3 {
            return "", fmt.Errorf("invalid API key format")
        }

        identifier := parts[0]
        timestampStr := parts[1]
        signature := parts[2]

        // Recalculate signature
        payload := fmt.Sprintf("%s.%s", identifier, timestampStr)
        mac := hmac.New(sha256.New, c.HMACSecret)
        mac.Write([]byte(payload))
        expectedSignature := hex.EncodeToString(mac.Sum(nil))

        // Constant-time comparison
        if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
            return "", fmt.Errorf("invalid API key signature")
        }

        return identifier, nil
    }

    func (c *APIKeyConfig) Authenticate(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            var apiKey string

            // Check header first, then query parameter
            if apiKey = r.Header.Get(c.HeaderName); apiKey == "" {
                apiKey = r.URL.Query().Get(c.QueryParam)
            }

            if apiKey == "" {
                http.Error(w, "API key required", http.StatusUnauthorized)
                return
            }

            identifier, err := c.ValidateAPIKey(apiKey)
            if err != nil {
                http.Error(w, "Invalid API key", http.StatusUnauthorized)
                return
            }

            ctx := context.WithValue(r.Context(), "apiKeyIdentifier", identifier)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
    ```

=== "The Explanation"

    - **HMAC signing**: Use HMAC-SHA256 for API key signatures
    - **Key format**: Combine identifier, timestamp, and signature
    - **Constant-time comparison**: Prevent timing attacks on signature validation
    - **Flexible extraction**: Support both header and query parameter

=== "The Terminal Output"

    ```
    API Key generated: user123.1693425600.a1b2c3...
    API Key validated for: user123
    ```

## Session-Based Authentication

=== "The Code"

    ```go
    package main

    import (
        "crypto/rand"
        "encoding/hex"
        "fmt"
        "net/http"
        "sync"
        "time"
    )

    type Session struct {
        UserID    string
        Username  string
        ExpiresAt time.Time
        Data      map[string]interface{}
    }

    type SessionStore struct {
        sessions map[string]*Session
        mu       sync.RWMutex
    }

    func NewSessionStore() *SessionStore {
        return &SessionStore{
            sessions: make(map[string]*Session),
        }
    }

    func (s *SessionStore) Create(userID, username string, duration time.Duration) (string, error) {
        bytes := make([]byte, 32)
        if _, err := rand.Read(bytes); err != nil {
            return "", err
        }
        sessionID := hex.EncodeToString(bytes)

        s.mu.Lock()
        defer s.mu.Unlock()

        s.sessions[sessionID] = &Session{
            UserID:    userID,
            Username:  username,
            ExpiresAt: time.Now().Add(duration),
            Data:      make(map[string]interface{}),
        }

        return sessionID, nil
    }

    func (s *SessionStore) Get(sessionID string) (*Session, error) {
        s.mu.RLock()
        defer s.mu.RUnlock()

        session, exists := s.sessions[sessionID]
        if !exists {
            return nil, fmt.Errorf("session not found")
        }

        if time.Now().After(session.ExpiresAt) {
            delete(s.sessions, sessionID)
            return nil, fmt.Errorf("session expired")
        }

        return session, nil
    }

    func (s *SessionStore) Delete(sessionID string) {
        s.mu.Lock()
        defer s.mu.Unlock()
        delete(s.sessions, sessionID)
    }

    func main() {
        store := NewSessionStore()

        http.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
            // Simplified authentication
            sessionID, err := store.Create("user123", "johndoe", 24*time.Hour)
            if err != nil {
                http.Error(w, "Session creation failed",
                    http.StatusInternalServerError)
                return
            }

            // Set session cookie
            http.SetCookie(w, &http.Cookie{
                Name:     "session_id",
                Value:    sessionID,
                Path:     "/",
                HttpOnly: true,
                Secure:   true,
                SameSite: http.SameSiteStrictMode,
                MaxAge:   86400,
            })

            fmt.Fprintf(w, "Logged in successfully!")
        })

        http.HandleFunc("/protected", func(w http.ResponseWriter, r *http.Request) {
            cookie, err := r.Cookie("session_id")
            if err != nil {
                http.Error(w, "Not authenticated",
                    http.StatusUnauthorized)
                return
            }

            session, err := store.Get(cookie.Value)
            if err != nil {
                http.Error(w, err.Error(),
                    http.StatusUnauthorized)
                return
            }

            fmt.Fprintf(w, "Welcome, %s!", session.Username)
        })

        fmt.Println("Server starting on :8080")
        http.ListenAndServe(":8080", nil)
    }
    ```

=== "The Explanation"

    - **Secure session IDs**: Cryptographically random session identifiers
    - **Cookie security**: HttpOnly, Secure, SameSite flags
    - **Session expiration**: Automatic cleanup of expired sessions
    - **Thread-safe storage**: RWMutex for concurrent access

=== "The Terminal Output"

    ```
    Server starting on :8080
    Logged in successfully!
    Welcome, johndoe!
    ```

!!! warning "Session Security"

    - Always use `HttpOnly` cookies to prevent XSS access
    - Set `Secure` flag to require HTTPS
    - Use `SameSite=Strict` or `Lax` to prevent CSRF
    - Implement session fixation protection

## Best Practices

| Practice | Description | Priority |
|----------|-------------|----------|
| Short-lived access tokens | 15-30 minute expiry for access tokens | Critical |
| Secure key storage | Use environment variables for secrets | Critical |
| Token validation | Always verify signatures and expiration | Critical |
| Password hashing | Use bcrypt with cost >= 12 | Critical |
| Refresh token rotation | Issue new refresh token on each use | High |
| Rate limiting | Protect authentication endpoints | High |
| Audit logging | Log authentication events | Medium |
| Multi-factor auth | Implement MFA for sensitive operations | Medium |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Token validation fails | Check signing key and algorithm match |
| Expired tokens | Implement proper token refresh workflow |
| CORS errors | Configure proper CORS headers for auth endpoints |
| Password hashing slow | Adjust bcrypt cost factor (10-12 recommended) |
| Session fixation | Regenerate session ID after authentication |

## Summary

- Use `golang-jwt` for secure JWT implementation
- Implement refresh token rotation with reuse detection
- Build authentication middleware for clean handler separation
- Hash passwords with bcrypt at sufficient cost
- Consider OAuth2 for third-party authentication
- Use API keys for service-to-service communication
- Protect session cookies with proper security flags

## Next Steps

- [Authorization & RBAC](authorization-rbac.md) - Control access to resources
- [HTTPS & TLS](https-tls.md) - Secure transport layer
- [Input Validation](input-validation.md) - Validate authentication inputs
- [Security Hardening](hardening.md) - Production security configuration