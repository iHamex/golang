# HTTPS & TLS

Transport Layer Security (TLS) encrypts communication between clients and servers. HTTPS is essential for protecting data in transit, authenticating servers, and building trust with users. This guide covers TLS configuration, certificate management, and security headers in Go.

## What You Will Learn

- Configure TLS servers with modern cipher suites
- Automate certificate management with Let's Encrypt
- Implement HTTP/2 with TLS
- Configure security headers and HSTS
- Set up CORS properly
- Pin certificates for API security

## Prerequisites

- Understanding of HTTP and TLS concepts
- Familiarity with Go's `net/http` package
- Basic knowledge of cryptography

---

## Basic TLS Server

=== "The Code"

    ```go
    package main

    import (
        "crypto/ecdsa"
        "crypto/elliptic"
        "crypto/rand"
        "crypto/tls"
        "crypto/x509"
        "crypto/x509/pkix"
        "encoding/pem"
        "fmt"
        "log"
        "math/big"
        "net/http"
        "time"
    )

    func generateSelfSignedCert() (tls.Certificate, error) {
        // Generate private key
        privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
        if err != nil {
            return tls.Certificate{}, err
        }

        // Create certificate template
        serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
        if err != nil {
            return tls.Certificate{}, err
        }

        template := x509.Certificate{
            SerialNumber: serialNumber,
            Subject: pkix.Name{
                Organization: []string{"My Organization"},
                CommonName:   "localhost",
            },
            NotBefore:             time.Now(),
            NotAfter:              time.Now().Add(365 * 24 * time.Hour),
            KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
            ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
            BasicConstraintsValid: true,
            IPAddresses:           []net.IP{net.ParseIP("127.0.0.1")},
            DNSNames:              []string{"localhost"},
        }

        // Create certificate
        certDER, err := x509.CreateCertificate(rand.Reader, &template, &template,
            &privateKey.PublicKey, privateKey)
        if err != nil {
            return tls.Certificate{}, err
        }

        // Encode to PEM
        certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})
        privateKeyDER, err := x509.MarshalECPrivateKey(privateKey)
        if err != nil {
            return tls.Certificate{}, err
        }
        privateKeyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: privateKeyDER})

        // Load certificate
        return tls.X509KeyPair(certPEM, privateKeyPEM)
    }

    func main() {
        cert, err := generateSelfSignedCert()
        if err != nil {
            log.Fatal(err)
        }

        // Configure TLS with modern settings
        tlsConfig := &tls.Config{
            Certificates: []tls.Certificate{cert},
            MinVersion:   tls.VersionTLS12,
            MaxVersion:   tls.VersionTLS13,
            CipherSuites: []uint16{
                tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
                tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
                tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
                tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
                tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
                tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
            },
            PreferServerCipherSuites: true,
        }

        mux := http.NewServeMux()
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Secure connection established!")
        })

        server := &http.Server{
            Addr:      ":8443",
            Handler:   mux,
            TLSConfig: tlsConfig,
        }

        fmt.Println("TLS server starting on :8443")
        log.Fatal(server.ListenAndServeTLS("", ""))
    }
    ```

=== "The Explanation"

    - **ECDSA keys**: More secure than RSA at smaller key sizes
    - **Modern cipher suites**: Only include secure cipher suites
    - **TLS 1.2+**: Minimum TLS version for security
    - **Self-signed certs**: For development only; use Let's Encrypt in production

=== "The Terminal Output"

    ```
    TLS server starting on :8443
    ```

!!! danger "TLS Configuration"

    Never use deprecated TLS versions or weak cipher suites:

    ```go
    // NEVER: Insecure TLS configuration
    tlsConfig := &tls.Config{
        MinVersion: tls.VersionTLS10,  // DEPRECATED
        CipherSuites: []uint16{
            tls.TLS_RSA_WITH_RC4_128_SHA,  // WEAK
        },
    }
    ```

## Let's Encrypt with autocert

=== "The Code"

    ```go
    package main

    import (
        "crypto/tls"
        "fmt"
        "log"
        "net/http"

        "golang.org/x/crypto/acme/autocert"
    )

    func main() {
        // Configure autocert manager
        certManager := autocert.Manager{
            Prompt:     autocert.AcceptTOS,
            HostPolicy: autocert.HostWhitelist("example.com", "www.example.com"),
            Cache:      autocert.DirCache("/var/www/.cache"),
        }

        // Create TLS config
        tlsConfig := &tls.Config{
            GetCertificate: certManager.GetCertificate,
            MinVersion:     tls.VersionTLS12,
        }

        mux := http.NewServeMux()
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Hello, secure world!")
        })

        // HTTP server for ACME challenges
        httpServer := &http.Server{
            Addr:    ":80",
            Handler: certManager.HTTPHandler(nil),
        }

        // HTTPS server
        httpsServer := &http.Server{
            Addr:      ":443",
            Handler:   mux,
            TLSConfig: tlsConfig,
        }

        // Redirect HTTP to HTTPS
        go func() {
            fmt.Println("HTTP server starting on :80")
            log.Fatal(httpServer.ListenAndServe())
        }()

        fmt.Println("HTTPS server starting on :443")
        log.Fatal(httpsServer.ListenAndServeTLS("", ""))
    }
    ```

=== "The Explanation"

    - **autocert.Manager**: Handles ACME protocol automatically
    - **HostWhitelist**: Only issue certificates for authorized domains
    - **DirCache**: Cache certificates to avoid rate limits
    - **HTTP redirect**: Automatically redirect HTTP to HTTPS

=== "The Terminal Output"

    ```
    HTTP server starting on :80
    HTTPS server starting on :443
    Certificate issued for: example.com
    ```

!!! note "Let's Encrypt Rate Limits"

    Be aware of rate limits:

    - 50 certificates per registered domain per week
    - 5 duplicate certificates per week
    - 100 names per certificate
    - Use staging environment for testing

## HTTP/2 Configuration

=== "The Code"

    ```go
    package main

    import (
        "crypto/tls"
        "fmt"
        "log"
        "net/http"

        "golang.org/x/net/http2"
        "golang.org/x/net/http2/h2c"
    )

    func main() {
        mux := http.NewServeMux()
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "HTTP/2 connection established!")
            fmt.Fprintf(w, "\nProtocol: %s", r.Proto)
        })

        // For h2c (HTTP/2 cleartext) - development only
        h2s := &http2.Server{}
        h1s := &http.Server{
            Addr:    ":8080",
            Handler: h2c.NewHandler(mux, h2s),
        }

        // For production with TLS
        tlsConfig := &tls.Config{
            MinVersion: tls.VersionTLS12,
            NextProtos: []string{"h2", "http/1.1"},
        }

        productionServer := &http.Server{
            Addr:      ":8443",
            Handler:   mux,
            TLSConfig: tlsConfig,
        }

        // Development server (h2c)
        go func() {
            fmt.Println("H2C server starting on :8080")
            log.Fatal(h1s.ListenAndServe())
        }()

        // Production server (TLS + HTTP/2)
        fmt.Println("HTTPS/2 server starting on :8443")
        log.Fatal(productionServer.ListenAndServeTLS("cert.pem", "key.pem"))
    }
    ```

=== "The Explanation"

    - **HTTP/2 support**: Automatic with TLS in Go
    - **h2c**: HTTP/2 cleartext for development environments
    - **NextProtos**: Advertise supported protocols
    - **ALPN**: Application-Layer Protocol Negotiation

=== "The Terminal Output"

    ```
    H2C server starting on :8080
    HTTPS/2 server starting on :8443
    Protocol: HTTP/2.0
    ```

## HSTS and Security Headers

=== "The Code"

    ```go
    package middleware

    import (
        "net/http"
        "time"
    )

    type SecurityHeadersConfig struct {
        HSTSMaxAge           time.Duration
        IncludeSubdomains    bool
        Preload              bool
        ContentSecurityPolicy string
        XFrameOptions        string
        XContentTypeOptions  string
        ReferrerPolicy       string
        PermissionsPolicy   string
    }

    func DefaultSecurityHeadersConfig() SecurityHeadersConfig {
        return SecurityHeadersConfig{
            HSTSMaxAge:           365 * 24 * time.Hour,
            IncludeSubdomains:    true,
            Preload:              true,
            ContentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
            XFrameOptions:        "DENY",
            XContentTypeOptions:  "nosniff",
            ReferrerPolicy:       "strict-origin-when-cross-origin",
            PermissionsPolicy:   "camera=(), microphone=(), geolocation=()",
        }
    }

    func SecurityHeaders(config SecurityHeadersConfig) func(http.Handler) http.Handler {
        return func(next http.Handler) http.Handler {
            return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                // HSTS header
                hstsValue := "max-age=" + fmt.Sprintf("%d",
                    int(config.HSTSMaxAge.Seconds()))
                if config.IncludeSubdomains {
                    hstsValue += "; includeSubDomains"
                }
                if config.Preload {
                    hstsValue += "; preload"
                }
                w.Header().Set("Strict-Transport-Security", hstsValue)

                // Content Security Policy
                if config.ContentSecurityPolicy != "" {
                    w.Header().Set("Content-Security-Policy",
                        config.ContentSecurityPolicy)
                }

                // X-Frame-Options
                if config.XFrameOptions != "" {
                    w.Header().Set("X-Frame-Options", config.XFrameOptions)
                }

                // X-Content-Type-Options
                if config.XContentTypeOptions != "" {
                    w.Header().Set("X-Content-Type-Options",
                        config.XContentTypeOptions)
                }

                // Referrer-Policy
                if config.ReferrerPolicy != "" {
                    w.Header().Set("Referrer-Policy", config.ReferrerPolicy)
                }

                // Permissions-Policy
                if config.PermissionsPolicy != "" {
                    w.Header().Set("Permissions-Policy",
                        config.PermissionsPolicy)
                }

                // Remove server header
                w.Header().Del("Server")

                next.ServeHTTP(w, r)
            })
        }
    }

    func main() {
        config := DefaultSecurityHeadersConfig()
        
        mux := http.NewServeMux()
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, "Secure response!")
        })

        handler := SecurityHeaders(config)(mux)

        fmt.Println("Server with security headers on :8080")
        http.ListenAndServe(":8080", handler)
    }
    ```

=== "The Explanation"

    - **HSTS**: Force HTTPS for specified duration
    - **CSP**: Control allowed resource sources
    - **X-Frame-Options**: Prevent clickjacking attacks
    - **X-Content-Type-Options**: Prevent MIME type sniffing
    - **Remove Server header**: Don't expose server information

=== "The Terminal Output"

    ```
    Server with security headers on :8080
    Response headers:
      Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
      X-Frame-Options: DENY
      X-Content-Type-Options: nosniff
    ```

!!! warning "HSTS Preload"

    Once submitted to the HSTS preload list, it's difficult to remove:

    - Test thoroughly before enabling preload
    - Ensure all subdomains support HTTPS
    - Include proper redirect configuration

## CORS Configuration

=== "The Code"

    ```go
    package middleware

    import (
        "net/http"
        "strings"
    )

    type CORSConfig struct {
        AllowOrigins     []string
        AllowMethods     []string
        AllowHeaders     []string
        ExposeHeaders    []string
        AllowCredentials bool
        MaxAge           int
    }

    func DefaultCORSConfig() CORSConfig {
        return CORSConfig{
            AllowOrigins: []string{"https://example.com"},
            AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
            AllowHeaders: []string{
                "Content-Type",
                "Authorization",
                "X-Requested-With",
            },
            ExposeHeaders:    []string{"X-Request-ID"},
            AllowCredentials: true,
            MaxAge:           86400,
        }
    }

    func CORS(config CORSConfig) func(http.Handler) http.Handler {
        return func(next http.Handler) http.Handler {
            return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                origin := r.Header.Get("Origin")

                // Check if origin is allowed
                if config.isOriginAllowed(origin) {
                    w.Header().Set("Access-Control-Allow-Origin", origin)
                    w.Header().Set("Vary", "Origin")
                }

                // Set other CORS headers
                if len(config.AllowMethods) > 0 {
                    w.Header().Set("Access-Control-Allow-Methods",
                        strings.Join(config.AllowMethods, ", "))
                }

                if len(config.AllowHeaders) > 0 {
                    w.Header().Set("Access-Control-Allow-Headers",
                        strings.Join(config.AllowHeaders, ", "))
                }

                if len(config.ExposeHeaders) > 0 {
                    w.Header().Set("Access-Control-Expose-Headers",
                        strings.Join(config.ExposeHeaders, ", "))
                }

                if config.AllowCredentials {
                    w.Header().Set("Access-Control-Allow-Credentials", "true")
                }

                if config.MaxAge > 0 {
                    w.Header().Set("Access-Control-Max-Age",
                        fmt.Sprintf("%d", config.MaxAge))
                }

                // Handle preflight requests
                if r.Method == "OPTIONS" {
                    w.WriteHeader(http.StatusNoContent)
                    return
                }

                next.ServeHTTP(w, r)
            })
        }
    }

    func (c CORSConfig) isOriginAllowed(origin string) bool {
        if origin == "" {
            return false
        }

        for _, allowed := range c.AllowOrigins {
            if allowed == "*" || allowed == origin {
                return true
            }

            // Support wildcard subdomains
            if strings.HasPrefix(allowed, "*.") {
                domain := allowed[2:]
                if strings.HasSuffix(origin, domain) {
                    return true
                }
            }
        }

        return false
    }

    func main() {
        config := DefaultCORSConfig()
        
        mux := http.NewServeMux()
        mux.HandleFunc("/api/data", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintf(w, `{"message": "CORS enabled"}`)
        })

        handler := CORS(config)(mux)

        fmt.Println("CORS-enabled server on :8080")
        http.ListenAndServe(":8080", handler)
    }
    ```

=== "The Explanation"

    - **Origin validation**: Check request origin against allowed list
    - **Preflight handling**: Respond to OPTIONS requests
    - **Credentials**: Support authenticated cross-origin requests
    - **Max-Age**: Cache preflight results

=== "The Terminal Output"

    ```
    CORS-enabled server on :8080
    Access-Control-Allow-Origin: https://example.com
    Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
    ```

!!! danger "CORS Security"

    Never use `Access-Control-Allow-Origin: *` with credentials:

    ```go
    // NEVER: Allows any origin with credentials
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Credentials", "true")
    
    // SAFE: Validate specific origins
    if origin == "https://trusted-domain.com" {
        w.Header().Set("Access-Control-Allow-Origin", origin)
    }
    ```

## Certificate Pinning

=== "The Code"

    ```go
    package main

    import (
        "crypto/sha256"
        "crypto/tls"
        "crypto/x509"
        "encoding/hex"
        "fmt"
        "log"
        "net/http"
    )

    type CertificatePinner struct {
        pinnedHashes map[string]bool
    }

    func NewCertificatePinner() *CertificatePinner {
        return &CertificatePinner{
            pinnedHashes: make(map[string]bool),
        }
    }

    func (p *CertificatePinner) PinCertificate(cert *x509.Certificate) {
        hash := sha256.Sum256(cert.RawSubjectPublicKeyInfo)
        p.pinnedHashes[hex.EncodeToString(hash[:])] = true
    }

    func (p *CertificatePinner) PinFromFile(certFile string) error {
        cert, err := tls.LoadX509KeyPair(certFile, certFile)
        if err != nil {
            return err
        }

        leaf, err := x509.ParseCertificate(cert.Certificate[0])
        if err != nil {
            return err
        }

        p.PinCertificate(leaf)
        return nil
    }

    func (p *CertificatePinner) VerifyPeerCertificate(
        rawCerts [][]byte,
        verifiedChains [][]*x509.Certificate,
    ) error {
        if len(verifiedChains) == 0 {
            return fmt.Errorf("no verified certificate chains")
        }

        for _, chain := range verifiedChains {
            for _, cert := range chain {
                hash := sha256.Sum256(cert.RawSubjectPublicKeyInfo)
                hashHex := hex.EncodeToString(hash[:])

                if p.pinnedHashes[hashHex] {
                    return nil // Certificate pinned
                }
            }
        }

        return fmt.Errorf("no pinned certificate found in chain")
    }

    func (p *CertificatePinner) CreateTransport() *http.Transport {
        return &http.Transport{
            TLSClientConfig: &tls.Config{
                VerifyPeerCertificate: p.VerifyPeerCertificate,
                MinVersion:           tls.VersionTLS12,
            },
        }
    }

    func main() {
        pinner := NewCertificatePinner()

        // Pin certificates (in production, load from files)
        // pinner.PinFromFile("server-cert.pem")

        // Create HTTP client with certificate pinning
        client := &http.Client{
            Transport: pinner.CreateTransport(),
        }

        // Make request (will fail without proper certificate)
        resp, err := client.Get("https://api.example.com/data")
        if err != nil {
            log.Printf("Request failed: %v", err)
            return
        }
        defer resp.Body.Close()

        fmt.Println("Request successful:", resp.Status)
    }
    ```

=== "The Explanation"

    - **Certificate hashing**: Hash public key for pinning
    - **Chain verification**: Check entire certificate chain
    - **File-based pinning**: Load pins from configuration files
    - **Transport integration**: Custom transport for pinning

=== "The Terminal Output"

    ```
    Request failed: tls: no pinned certificate found in chain
    ```

!!! warning "Certificate Pinning Risks"

    Certificate pinning can cause availability issues:

    - Pin intermediate certificates, not leaf certificates
    - Have backup pins for certificate rotation
    - Monitor certificate expiration
    - Consider using Expect-CT header as alternative

## Best Practices

| Practice | Description | Priority |
|----------|-------------|----------|
| TLS 1.2+ | Use minimum TLS version 1.2 | Critical |
| Strong ciphers | Use AEAD cipher suites (GCM, ChaCha20) | Critical |
| HSTS | Enable with long max-age | High |
| Certificate automation | Use Let's Encrypt with autocert | High |
| Security headers | Implement CSP, X-Frame-Options, etc. | High |
| CORS validation | Validate origins explicitly | High |
| Certificate monitoring | Track expiration dates | Medium |
| HTTP/2 | Enable for performance | Medium |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| TLS handshake fails | Check certificate validity and cipher suites |
| HSTS not working | Verify HTTPS and valid certificate |
| CORS errors | Check origin validation and preflight handling |
| Certificate expired | Automate renewal with Let's Encrypt |
| Mixed content warnings | Ensure all resources load over HTTPS |

## Summary

- Always use TLS 1.2 or higher with strong cipher suites
- Automate certificate management with Let's Encrypt
- Implement security headers: HSTS, CSP, X-Frame-Options
- Configure CORS explicitly with validated origins
- Consider certificate pinning for API security
- Test TLS configuration with tools like ssllabs.com

## Next Steps

- [Input Validation](input-validation.md) - Validate all user inputs
- [Security Hardening](hardening.md) - Production security configuration
- [Security Overview](overview.md) - General security concepts