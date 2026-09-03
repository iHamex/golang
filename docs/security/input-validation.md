# Input Validation

Input validation is the first line of defense against injection attacks, data corruption, and application errors. Proper validation ensures that only expected, well-formed data enters your application. This guide covers validation libraries, sanitization techniques, and preventing common injection vulnerabilities.

## What You Will Learn

- Use the `go-playground/validator` library for struct validation
- Implement custom validation rules
- Prevent SQL injection through input sanitization
- Block XSS attacks in user input
- Stop path traversal attacks
- Validate file uploads securely
- Enforce request size limits

## Prerequisites

- Basic understanding of Go structs and tags
- Familiarity with HTTP request handling
- Knowledge of common injection attacks

---

## Validator Library Basics

The `go-playground/validator` package provides struct-level validation using tags.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "time"

        "github.com/go-playground/validator/v10"
    )

    type UserRegistration struct {
        Username  string    `validate:"required,min=3,max=32,alphanum"`
        Email     string    `validate:"required,email"`
        Password  string    `validate:"required,min=8,max=64"`
        Age       int       `validate:"required,gte=13,lte=120"`
        BirthDate time.Time `validate:"required,before=today"`
        Website   string    `validate:"omitempty,url"`
        Phone     string    `validate:"omitempty,e164"`
    }

    type OrderRequest struct {
        ProductID string  `validate:"required,uuid"`
        Quantity  int     `validate:"required,gt=0,lte=1000"`
        Price     float64 `validate:"required,gt=0"`
        Currency  string  `validate:"required,oneof=USD EUR GBP"`
    }

    var validate *validator.Validate

    func init() {
        validate = validator.New()
    }

    func ValidateRegistration(reg UserRegistration) error {
        // Set custom time for validation
        validate.RegisterCustomTypeFunc(func(field reflect.Value) interface{} {
            if v, ok := field.Interface().(time.Time); ok {
                return v
            }
            return nil
        }, time.Time{})

        return validate.Struct(reg)
    }

    func main() {
        // Valid registration
        validUser := UserRegistration{
            Username:  "johndoe",
            Email:     "john@example.com",
            Password:  "secureP@ss1",
            Age:       25,
            BirthDate: time.Date(2001, 1, 1, 0, 0, 0, 0, time.UTC),
        }

        err := validate.Struct(validUser)
        if err != nil {
            fmt.Println("Validation error:", err)
        } else {
            fmt.Println("Valid user registration!")
        }

        // Invalid registration
        invalidUser := UserRegistration{
            Username: "ab",           // Too short
            Email:    "invalid-email", // Invalid email
            Password: "short",        // Too short
            Age:      10,             // Under 13
        }

        err = validate.Struct(invalidUser)
        if err != nil {
            fmt.Println("\nValidation errors:")
            if validationErrors, ok := err.(validator.ValidationErrors); ok {
                for _, e := range validationErrors {
                    fmt.Printf("  Field: %s, Tag: %s, Param: %s\n",
                        e.Field(), e.Tag(), e.Param())
                }
            }
        }

        // Order validation
        order := OrderRequest{
            ProductID: "550e8400-e29b-41d4-a716-446655440000",
            Quantity:  5,
            Price:     29.99,
            Currency:  "USD",
        }

        err = validate.Struct(order)
        if err != nil {
            fmt.Println("Order validation error:", err)
        } else {
            fmt.Println("\nValid order!")
        }
    }
    ```

=== "The Explanation"

    - **Struct tags**: Declarative validation rules
    - **Built-in validators**: Common validations (email, url, uuid)
    - **Custom messages**: Field-specific error messages
    - **Nested validation**: Validate complex struct hierarchies

=== "The Terminal Output"

    ```
    Valid user registration!

    Validation errors:
      Field: Username, Tag: min, Param: 3
      Field: Email, Tag: email, Param: 
      Field: Password, Tag: min, Param: 8
      Field: Age, Tag: gte, Param: 13

    Valid order!
    ```

!!! go "Validation Tags"

    Common validation tags in `go-playground/validator`:

    | Tag | Description |
    |-----|-------------|
    | `required` | Field must be present and non-zero |
    | `min` / `max` | String/numeric length bounds |
    | `email` | Valid email format |
    | `url` | Valid URL format |
    | `uuid` | Valid UUID format |
    | `oneof` | Must be one of specified values |
    | `gt` / `gte` / `lt` / `lte` | Numeric comparisons |
    | `alphanum` | Alphanumeric characters only |

## Custom Validators

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "net"
        "regexp"
        "strings"
        "unicode"

        "github.com/go-playground/validator/v10"
    )

    type ServerConfig struct {
        Host     string `validate:"required,ip_addr"`
        Port     int    `validate:"required,gt=0,lte=65535"`
        APIKey   string `validate:"required,api_key"`
        Username string `validate:"required,strong_password"`
    }

    var validate *validator.Validate

    func init() {
        validate = validator.New()

        // Custom IP address validator
        validate.RegisterValidation("ip_addr", func(fl validator.FieldLevel) bool {
            ip := net.ParseIP(fl.Field().String())
            return ip != nil
        })

        // Custom API key validator
        validate.RegisterValidation("api_key", func(fl validator.FieldLevel) bool {
            apiKey := fl.Field().String()
            if len(apiKey) < 32 {
                return false
            }
            // Check format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
            pattern := `^[a-zA-Z0-9]{32,}$`
            matched, _ := regexp.MatchString(pattern, apiKey)
            return matched
        })

        // Custom strong password validator
        validate.RegisterValidation("strong_password", func(fl validator.FieldLevel) bool {
            password := fl.Field().String()
            
            if len(password) < 8 {
                return false
            }

            var (
                hasUpper   bool
                hasLower   bool
                hasNumber  bool
                hasSpecial bool
            )

            for _, char := range password {
                switch {
                case unicode.IsUpper(char):
                    hasUpper = true
                case unicode.IsLower(char):
                    hasLower = true
                case unicode.IsDigit(char):
                    hasNumber = true
                case unicode.IsPunct(char) || unicode.IsSymbol(char):
                    hasSpecial = true
                }
            }

            return hasUpper && hasLower && hasNumber && hasSpecial
        })
    }

    func main() {
        configs := []ServerConfig{
            {
                Host:     "192.168.1.1",
                Port:     8080,
                APIKey:   "abcdefghijklmnopqrstuvwxyz123456",
                Username: "admin",
            },
            {
                Host:     "invalid-host",
                Port:     8080,
                APIKey:   "short",
                Username: "weak",
            },
        }

        for i, config := range configs {
            err := validate.Struct(config)
            if err != nil {
                fmt.Printf("Config %d invalid:\n", i+1)
                if validationErrors, ok := err.(validator.ValidationErrors); ok {
                    for _, e := range validationErrors {
                        fmt.Printf("  - %s: failed on '%s'\n",
                            e.Field(), e.Tag())
                    }
                }
            } else {
                fmt.Printf("Config %d valid!\n", i+1)
            }
        }
    }
    ```

=== "The Explanation"

    - **RegisterValidation**: Create custom validation functions
    - **Field access**: Use `fl.Field().String()` to get field value
    - **Complex logic**: Implement any validation rule
    - **Reusable validators**: Register once, use everywhere

=== "The Terminal Output"

    ```
    Config 1 valid!
    Config 2 invalid:
      - Host: failed on 'ip_addr'
      - APIKey: failed on 'api_key'
      - Username: failed on 'strong_password'
    ```

## SQL Injection Prevention

=== "The Code"

    ```go
    package main

    import (
        "database/sql"
        "fmt"
        "log"
        "strings"

        _ "github.com/lib/pq"
    )

    type UserRepository struct {
        db *sql.DB
    }

    func NewUserRepository(db *sql.DB) *UserRepository {
        return &UserRepository{db: db}
    }

    // VULNERABLE: Direct string concatenation
    func (r *UserRepository) SearchUsersVulnerable(name string) ([]User, error) {
        query := "SELECT id, name, email FROM users WHERE name LIKE '%" + name + "%'"
        rows, err := r.db.Query(query)
        if err != nil {
            return nil, err
        }
        defer rows.Close()
        return nil, nil
    }

    // SAFE: Parameterized query
    func (r *UserRepository) SearchUsersSafe(name string) ([]User, error) {
        query := "SELECT id, name, email FROM users WHERE name LIKE $1"
        searchTerm := "%" + name + "%"
        rows, err := r.db.Query(query, searchTerm)
        if err != nil {
            return nil, err
        }
        defer rows.Close()
        return nil, nil
    }

    // SAFE: Dynamic query building with whitelisting
    func (r *UserRepository) SearchUsersFiltered(filters map[string]string) ([]User, error) {
        allowedFields := map[string]bool{
            "name":  true,
            "email": true,
            "phone": true,
        }

        var conditions []string
        var args []interface{}
        argIndex := 1

        for field, value := range filters {
            if !allowedFields[field] {
                continue // Skip invalid fields
            }

            // Sanitize field name (already validated against whitelist)
            condition := fmt.Sprintf("%s LIKE $%d", field, argIndex)
            conditions = append(conditions, condition)
            args = append(args, "%"+value+"%")
            argIndex++
        }

        if len(conditions) == 0 {
            return []User{}, nil
        }

        query := "SELECT id, name, email FROM users WHERE " +
            strings.Join(conditions, " AND ")

        rows, err := r.db.Query(query, args...)
        if err != nil {
            return nil, err
        }
        defer rows.Close()

        return nil, nil
    }

    type User struct {
        ID    int
        Name  string
        Email string
    }

    func main() {
        connStr := "postgres://user:pass@localhost/db?sslmode=disable"
        db, err := sql.Open("postgres", connStr)
        if err != nil {
            log.Fatal(err)
        }
        defer db.Close()

        repo := NewUserRepository(db)

        // Safe query
        users, err := repo.SearchUsersSafe("john")
        if err != nil {
            fmt.Println("Error:", err)
        } else {
            fmt.Println("Found users:", len(users))
        }
    }
    ```

=== "The Explanation"

    - **Parameterized queries**: Never concatenate user input into SQL
    - **Whitelist fields**: Only allow known field names in dynamic queries
    - **Escape special characters**: Handle SQL metacharacters properly
    - **Use ORM**: Consider using an ORM for automatic parameterization

=== "The Terminal Output"

    ```
    Found users: 0
    ```

!!! danger "SQL Injection Attacks"

    SQL injection remains one of the most dangerous vulnerabilities:

    ```sql
    -- Attack example
    Input: ' OR '1'='1' --
    
    -- Generated query (VULNERABLE)
    SELECT * FROM users WHERE name = '' OR '1'='1' --'
    
    -- This returns ALL users!
    ```

    Always use parameterized queries or an ORM.

## XSS Prevention

=== "The Code"

    ```go
    package main

    (
        "html"
        "html/template"
        "net/http"
        "regexp"
        "strings"
    )

    type InputSanitizer struct {
        allowedTags    []string
        allowedAttrs   []string
        urlPattern     *regexp.Regexp
    }

    func NewInputSanitizer() *InputSanitizer {
        return &InputSanitizer{
            allowedTags:  []string{"b", "i", "em", "strong", "p", "br"},
            allowedAttrs: []string{},
            urlPattern:   regexp.MustCompile(`^https?://`),
        }
    }

    func (s *InputSanitizer) SanitizeHTML(input string) string {
        // Strip all HTML tags
        re := regexp.MustCompile(`<[^>]*>`)
        sanitized := re.ReplaceAllString(input, "")
        
        // Decode HTML entities
        sanitized = html.UnescapeString(sanitized)
        
        // Re-escape for safe output
        return html.EscapeString(sanitized)
    }

    func (s *InputSanitizer) SanitizeURL(url string) string {
        url = strings.TrimSpace(url)
        
        // Only allow http and https
        if !s.urlPattern.MatchString(url) {
            return ""
        }
        
        // Remove dangerous characters
        url = strings.ReplaceAll(url, "'", "")
        url = strings.ReplaceAll(url, "\"", "")
        url = strings.ReplaceAll(url, "<", "")
        url = strings.ReplaceAll(url, ">", "")
        
        return url
    }

    func (s *InputSanitizer) SanitizeAttribute(input string) string {
        // Remove any non-alphanumeric characters except - and _
        re := regexp.MustCompile(`[^a-zA-Z0-9\-_]`)
        return re.ReplaceAllString(input, "")
    }

    // Safe template rendering
    func SafeRender(w http.ResponseWriter, data interface{}) {
        tmpl := template.Must(template.New("safe").Funcs(
            template.FuncMap{
                "safe": func(s string) template.HTML {
                    return template.HTML(s)
                },
                "escape": func(s string) string {
                    return html.EscapeString(s)
                },
            },
        ).Parse(`
            <div>{{escape .UserInput}}</div>
            <a href="{{.SafeURL}}">Link</a>
        `))
        
        tmpl.Execute(w, data)
    }

    func main() {
        sanitizer := NewInputSanitizer()

        testInputs := []struct {
            name  string
            input string
        }{
            {"XSS attempt", "<script>alert('xss')</script>"},
            {"HTML injection", "<img src=x onerror=alert(1)>"},
            {"Safe HTML", "<b>Hello</b> <i>World</i>"},
            {"URL with script", "javascript:alert(1)"},
            {"Safe URL", "https://example.com"},
        }

        for _, test := range testInputs {
            sanitized := sanitizer.SanitizeHTML(test.input)
            fmt.Printf("%s:\n  Original: %s\n  Sanitized: %s\n\n",
                test.name, test.input, sanitized)
        }
    }
    ```

=== "The Explanation"

    - **HTML stripping**: Remove all tags from user input
    - **URL validation**: Only allow safe protocols
    - **Attribute sanitization**: Remove dangerous characters
    - **Template escaping**: Use `html/template` for automatic escaping

=== "The Terminal Output"

    ```
    XSS attempt:
      Original: <script>alert('xss')</script>
      Sanitized: 

    HTML injection:
      Original: <img src=x onerror=alert(1)>
      Sanitized: 

    Safe HTML:
      Original: <b>Hello</b> <i>World</i>
      Sanitized: Hello World

    URL with script:
      Original: javascript:alert(1)
      Sanitized: 

    Safe URL:
      Original: https://example.com
      Sanitized: https://example.com
    ```

## Path Traversal Prevention

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
        "path/filepath"
        "strings"
    )

    type FileValidator struct {
        AllowedDir  string
        AllowedExts []string
        MaxSize     int64
    }

    func NewFileValidator(allowedDir string) *FileValidator {
        return &FileValidator{
            AllowedDir:  allowedDir,
            AllowedExts: []string{".jpg", ".jpeg", ".png", ".gif", ".pdf"},
            MaxSize:     10 * 1024 * 1024, // 10MB
        }
    }

    func (v *FileValidator) ValidatePath(filename string) (string, error) {
        // Clean the path
        filename = filepath.Clean(filename)
        
        // Check for path traversal
        if strings.Contains(filename, "..") {
            return "", fmt.Errorf("path traversal detected")
        }

        // Check for absolute paths
        if filepath.IsAbs(filename) {
            return "", fmt.Errorf("absolute path not allowed")
        }

        // Resolve full path
        fullPath := filepath.Join(v.AllowedDir, filename)
        
        // Ensure path is within allowed directory
        if !strings.HasPrefix(fullPath, v.AllowedDir) {
            return "", fmt.Errorf("path outside allowed directory")
        }

        return fullPath, nil
    }

    func (v *FileValidator) ValidateExtension(filename string) error {
        ext := strings.ToLower(filepath.Ext(filename))
        
        for _, allowed := range v.AllowedExts {
            if ext == allowed {
                return nil
            }
        }

        return fmt.Errorf("extension %s not allowed", ext)
    }

    func (v *FileValidator) ValidateFile(filename string) error {
        // Validate path
        _, err := v.ValidatePath(filename)
        if err != nil {
            return err
        }

        // Validate extension
        err = v.ValidateExtension(filename)
        if err != nil {
            return err
        }

        // Check file exists and get info
        fullPath := filepath.Join(v.AllowedDir, filename)
        info, err := os.Stat(fullPath)
        if err != nil {
            return err
        }

        // Check size
        if info.Size() > v.MaxSize {
            return fmt.Errorf("file too large: %d bytes (max: %d)",
                info.Size(), v.MaxSize)
        }

        return nil
    }

    func main() {
        validator := NewFileValidator("/var/uploads")

        testCases := []struct {
            name     string
            filename string
        }{
            {"Valid file", "document.pdf"},
            {"Path traversal", "../../etc/passwd"},
            {"Absolute path", "/etc/passwd"},
            {"Double dots", "file..name.txt"},
            {"Invalid extension", "script.exe"},
        }

        for _, tc := range testCases {
            _, err := validator.ValidatePath(tc.filename)
            if err != nil {
                fmt.Printf("%s: BLOCKED - %v\n", tc.name, err)
            } else {
                fmt.Printf("%s: ALLOWED\n", tc.name)
            }
        }
    }
    ```

=== "The Explanation"

    - **Path cleaning**: Normalize paths to remove traversal sequences
    - **Directory containment**: Ensure files stay within allowed directory
    - **Extension whitelist**: Only allow safe file types
    - **Size limits**: Prevent denial of service with large files

=== "The Terminal Output"

    ```
    Valid file: ALLOWED
    Path traversal: BLOCKED - path traversal detected
    Absolute path: BLOCKED - absolute path not allowed
    Double dots: BLOCKED - path traversal detected
    Invalid extension: BLOCKED - extension .exe not allowed
    ```

!!! danger "Path Traversal Attacks"

    Path traversal attacks access files outside the intended directory:

    ```
    # Attack attempts
    ../../../../etc/passwd
    ....//....//....//etc/passwd
    %2e%2e%2f%2e%2e%2fetc/passwd
    ```

    Always validate and sanitize file paths.

## File Upload Validation

=== "The Code"

    ```go
    package main

    (
        "fmt"
        "io"
        "mime/multipart"
        "net/http"
        "os"
        "path/filepath"
        "strings"
    )

    type UploadConfig struct {
        MaxFileSize  int64
        AllowedTypes map[string]bool
        AllowedExts  []string
        UploadDir    string
    }

    func DefaultUploadConfig() UploadConfig {
        return UploadConfig{
            MaxFileSize: 10 * 1024 * 1024, // 10MB
            AllowedTypes: map[string]bool{
                "image/jpeg": true,
                "image/png":  true,
                "image/gif":  true,
                "application/pdf": true,
            },
            AllowedExts: []string{".jpg", ".jpeg", ".png", ".gif", ".pdf"},
            UploadDir:   "./uploads",
        }
    }

    func ValidateUpload(file multipart.File, header *multipart.FileHeader,
        config UploadConfig) error {

        // Check file size
        if header.Size > config.MaxFileSize {
            return fmt.Errorf("file too large: %d bytes", header.Size)
        }

        // Check extension
        ext := strings.ToLower(filepath.Ext(header.Filename))
        if !config.AllowedExts[ext] {
            return fmt.Errorf("file type %s not allowed", ext)
        }

        // Check content type
        buffer := make([]byte, 512)
        _, err := file.Read(buffer)
        if err != nil {
            return err
        }

        // Reset file position
        file.Seek(0, 0)

        // Detect content type
        contentType := http.DetectContentType(buffer)
        if !config.AllowedTypes[contentType] {
            return fmt.Errorf("content type %s not allowed", contentType)
        }

        // Check for double extensions (e.g., image.php.jpg)
        filename := strings.ToLower(header.Filename)
        if strings.Count(filename, ".") > 1 {
            parts := strings.Split(filename, ".")
            for _, part := range parts[1:] {
                dangerous := []string{"php", "js", "py", "rb", "sh"}
                for _, d := range dangerous {
                    if part == d {
                        return fmt.Errorf("suspicious file extension")
                    }
                }
            }
        }

        return nil
    }

    func SaveUpload(file multipart.File, header *multipart.FileHeader,
        config UploadDir) (string, error) {

        // Generate safe filename
        ext := filepath.Ext(header.Filename)
        filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
        
        dstPath := filepath.Join(config.UploadDir, filename)

        // Create destination file
        dst, err := os.Create(dstPath)
        if err != nil {
            return "", err
        }
        defer dst.Close()

        // Copy file contents
        _, err = io.Copy(dst, file)
        if err != nil {
            return "", err
        }

        return dstPath, nil
    }

    func UploadHandler(config UploadConfig) http.HandlerFunc {
        return func(w http.ResponseWriter, r *http.Request) {
            if r.Method != "POST" {
                http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
                return
            }

            // Parse multipart form
            err := r.ParseMultipartForm(config.MaxFileSize)
            if err != nil {
                http.Error(w, "File too large", http.StatusBadRequest)
                return
            }

            file, header, err := r.FormFile("file")
            if err != nil {
                http.Error(w, "No file provided", http.StatusBadRequest)
                return
            }
            defer file.Close()

            // Validate upload
            err = ValidateUpload(file, header, config)
            if err != nil {
                http.Error(w, err.Error(), http.StatusBadRequest)
                return
            }

            // Save file
            path, err := SaveUpload(file, header, config)
            if err != nil {
                http.Error(w, "Failed to save file",
                    http.StatusInternalServerError)
                return
            }

            fmt.Fprintf(w, "File uploaded: %s", path)
        }
    }

    func main() {
        config := DefaultUploadConfig()

        http.HandleFunc("/upload", UploadHandler(config))

        fmt.Println("Upload server starting on :8080")
        http.ListenAndServe(":8080", nil)
    }
    ```

=== "The Explanation"

    - **Multi-layer validation**: Check size, type, extension, and content
    - **Content detection**: Use file magic bytes, not just extension
    - **Double extension check**: Prevent bypass attempts
    - **Safe filenames**: Generate unique names to prevent overwrites

=== "The Terminal Output"

    ```
    Upload server starting on :8080
    File uploaded: ./uploads/1693425600000.pdf
    ```

## Request Size Limits

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "io"
        "net/http"
    )

    type LimitedReader struct {
        Reader  io.Reader
        MaxSize int64
        Current int64
    }

    func (lr *LimitedReader) Read(p []byte) (int, error) {
        if lr.Current >= lr.MaxSize {
            return 0, fmt.Errorf("request body too large")
        }

        n, err := lr.Reader.Read(p)
        lr.Current += int64(n)

        if lr.Current > lr.MaxSize {
            return 0, fmt.Errorf("request body too large")
        }

        return n, err
    }

    func RequestSizeLimit(maxSize int64, next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Limit request body size
            r.Body = &LimitedReader{
                Reader:  r.Body,
                MaxSize: maxSize,
            }

            // Set response timeout
            w.Header().Set("Connection", "close")

            next.ServeHTTP(w, r)
        })
    }

    func main() {
        mux := http.NewServeMux()

        mux.HandleFunc("/upload", func(w http.ResponseWriter, r *http.Request) {
            body, err := io.ReadAll(r.Body)
            if err != nil {
                http.Error(w, err.Error(), http.StatusBadRequest)
                return
            }
            defer r.Body.Close()

            fmt.Fprintf(w, "Received %d bytes", len(body))
        })

        // Apply 1MB limit
        handler := RequestSizeLimit(1024*1024, mux)

        fmt.Println("Server with size limits on :8080")
        http.ListenAndServe(":8080", handler)
    }
    ```

=== "The Explanation"

    - **Body limiting**: Cap request body size to prevent DoS
    - **Streaming validation**: Check size during read
    - **Connection handling**: Close connections that exceed limits
    - **Resource protection**: Prevent memory exhaustion

=== "The Terminal Output"

    ```
    Server with size limits on :8080
    Received 1024 bytes
    Request body too large
    ```

## Best Practices

| Practice | Description | Priority |
|----------|-------------|----------|
| Validate all input | Never trust user input | Critical |
| Whitelist, not blacklist | Allow known good, reject everything else | Critical |
| Parameterized queries | Never concatenate SQL with user input | Critical |
| Output encoding | Escape output for the appropriate context | Critical |
| File type validation | Check magic bytes, not just extension | High |
| Request size limits | Prevent denial of service | High |
| Sanitize file paths | Prevent directory traversal | High |
| Use validation libraries | Leverage battle-tested validation code | Medium |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Validation not working | Check struct tags and validator initialization |
| SQL injection still possible | Ensure all queries use parameters |
| XSS in output | Use `html/template` instead of `text/template` |
| File upload fails | Check MIME type detection and extension whitelist |
| Path traversal bypass | Use `filepath.Clean` and verify prefix |

## Summary

- Use `go-playground/validator` for comprehensive struct validation
- Create custom validators for application-specific rules
- Always use parameterized queries to prevent SQL injection
- Sanitize HTML output using `html/template`
- Validate file uploads with multiple checks (type, size, content)
- Prevent path traversal by validating file paths
- Implement request size limits to prevent DoS attacks

## Next Steps

- [Security Hardening](hardening.md) - Production security configuration
- [Security Overview](overview.md) - General security concepts
- [Authentication & JWT](authentication-jwt.md) - Secure user authentication