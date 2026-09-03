# Error Handling

Go takes a unique approach to error handling: errors are values, not exceptions. This explicit philosophy encourages developers to handle errors at every call site, leading to more robust and predictable programs. Understanding Go's error patterns is essential for writing production-quality code.

## What You Will Learn

- Working with the `error` interface and creating custom errors
- Using `errors.New` and `fmt.Errorf` for error creation
- Implementing sentinel errors and error wrapping/unwrapping
- Leveraging `errors.Is` and `errors.As` for error inspection
- Designing custom error types with rich context
- Applying idiomatic error handling patterns in Go
- Understanding when to use `panic` and `recover`

## Prerequisites

- Basic Go syntax and function declarations
- Understanding of interfaces
- Familiarity with package structure

---

## The error Interface

At its core, Go's error handling revolves around the built-in `error` interface.

=== "The Code"

    ```go
    package main

    import (
        "errors"
        "fmt"
    )

    // The error interface (built-in)
    // type error interface {
    //     Error() string
    // }

    // Simple function returning error
    func divide(a, b float64) (float64, error) {
        if b == 0 {
            return 0, errors.New("division by zero")
        }
        return a / b, nil
    }

    // Error checking pattern
    func main() {
        result, err := divide(10, 3)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        fmt.Printf("10 / 3 = %.2f\n", result)

        result, err = divide(10, 0)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        fmt.Printf("10 / 0 = %.2f\n", result)
    }
    ```

=== "The Explanation"

    - **`error` interface**: Any type implementing `Error() string` satisfies the interface
    - **`nil` error**: Indicates success; always check for `nil` first
    - **`errors.New()`**: Creates a simple error with a message string
    - **Multiple returns**: Convention is to return `(result, error)` tuples
    - **Error last**: Errors are always the last return value

=== "The Terminal Output"

    ```
    10 / 3 = 3.33
    Error: division by zero
    ```

---

## Creating Errors

Go provides multiple ways to create errors with varying levels of detail.

=== "The Code"

    ```go
    package main

    import (
        "errors"
        "fmt"
    )

    // errors.New for simple static errors
    var (
        ErrNotFound     = errors.New("resource not found")
        ErrUnauthorized = errors.New("unauthorized access")
    )

    // fmt.Errorf for formatted error messages
    func findUser(id int) (string, error) {
        if id <= 0 {
            return "", fmt.Errorf("invalid user ID: %d", id)
        }
        if id > 1000 {
            return "", fmt.Errorf("user ID %d exceeds maximum", id)
        }
        // Simulate not found
        if id == 404 {
            return "", ErrNotFound
        }
        return fmt.Sprintf("User_%d", id), nil
    }

    func main() {
        testCases := []int{-1, 404, 500, 2000}

        for _, id := range testCases {
            user, err := findUser(id)
            if err != nil {
                fmt.Printf("ID %d: Error - %v\n", id, err)
                continue
            }
            fmt.Printf("ID %d: Found - %s\n", id, user)
        }
    }
    ```

=== "The Explanation"

    - **`errors.New()`**: Best for static, reusable error messages
    - **`fmt.Errorf()`**: Best for dynamic error messages with context
    - **Sentinel errors**: Package-level error variables for comparison
    - **Error context**: Include relevant values in error messages for debugging

=== "The Terminal Output"

    ```
    ID -1: Error - invalid user ID: -1
    ID 404: Error - resource not found
    ID 500: Found - User_500
    ID 2000: Error - user ID 2000 exceeds maximum
    ```

---

## Sentinel Errors

Sentinel errors are package-level error values used for comparison and program flow control.

=== "The Code"

    ```go
    package main

    import (
        "errors"
        "fmt"
    )

    // Sentinel errors for database operations
    var (
        ErrConnectionFailed = errors.New("database connection failed")
        ErrQueryFailed      = errors.New("query execution failed")
        ErrNoRows           = errors.New("no rows returned")
        ErrDuplicateKey     = errors.New("duplicate key error")
    )

    // Simulated database operation
    func queryDatabase(query string) error {
        switch query {
        case "connect":
            return ErrConnectionFailed
        case "select":
            return ErrNoRows
        case "insert":
            return ErrDuplicateKey
        default:
            return nil
        }
    }

    // Compare using errors.Is
    func handleQuery(query string) {
        err := queryDatabase(query)
        if err == nil {
            fmt.Printf("Query '%s': Success\n", query)
            return
        }

        switch {
        case errors.Is(err, ErrConnectionFailed):
            fmt.Printf("Query '%s': Connection error - retry later\n", query)
        case errors.Is(err, ErrNoRows):
            fmt.Printf("Query '%s': No data found\n", query)
        case errors.Is(err, ErrDuplicateKey):
            fmt.Printf("Query '%s': Data already exists\n", query)
        default:
            fmt.Printf("Query '%s': Unexpected error - %v\n", query, err)
        }
    }

    func main() {
        queries := []string{"connect", "select", "insert", "unknown"}
        for _, q := range queries {
            handleQuery(q)
        }
    }
    ```

=== "The Explanation"

    - **Sentinel errors**: Package-level variables that serve as error markers
    - **`errors.Is()`**: Compares errors using `==` or unwrapping chain
    - **Pattern matching**: Use switch/case for handling different error types
    - **Exported errors**: Capitalize sentinel errors for package-level access
    - **Error identity**: Sentinel errors are compared by value, not message

=== "The Terminal Output"

    ```
    Query 'connect': Connection error - retry later
    Query 'select': No data found
    Query 'insert': Data already exists
    Query 'unknown': Unexpected error - <nil>
    ```

---

## Error Wrapping and Unwrapping

Go 1.13 introduced error wrapping to preserve context while maintaining error identity.

=== "The Code"

    ```go
    package main

    import (
        "errors"
        "fmt"
    )

    // Base errors
    var (
        ErrConnection = errors.New("connection failed")
        ErrTimeout    = errors.New("timeout exceeded")
        ErrPermission = errors.New("permission denied")
    )

    // Wrapping errors with context
    func connectToServer(addr string) error {
        // Simulate connection failure
        if addr == "invalid" {
            return fmt.Errorf("connect to %s: %w", addr, ErrConnection)
        }
        if addr == "slow" {
            return fmt.Errorf("connect to %s: %w", addr, ErrTimeout)
        }
        return nil
    }

    func accessResource(resource string) error {
        // Simulate permission error
        if resource == "admin" {
            return fmt.Errorf("access %s: %w", resource, ErrPermission)
        }
        return nil
    }

    // Double wrapping
    func fetchUserData(userID int) error {
        err := connectToServer("invalid")
        if err != nil {
            return fmt.Errorf("fetch user %d: %w", userID, err)
        }
        return nil
    }

    func main() {
        // Test connection errors
        err := connectToServer("invalid")
        if err != nil {
            fmt.Println("Original:", err)
            fmt.Println("Unwrapped:", errors.Unwrap(err))
            fmt.Println("Is ErrConnection:", errors.Is(err, ErrConnection))
        }

        fmt.Println()

        // Test timeout error
        err = connectToServer("slow")
        if err != nil {
            fmt.Println("Original:", err)
            fmt.Println("Is ErrTimeout:", errors.Is(err, ErrTimeout))
        }

        fmt.Println()

        // Test double wrapping
        err = fetchUserData(123)
        if err != nil {
            fmt.Println("Original:", err)
            fmt.Println("Is ErrConnection:", errors.Is(err, ErrConnection))
            fmt.Println("Unwrap chain:")
            for unwrapped := err; unwrapped != nil; unwrapped = errors.Unwrap(unwrapped) {
                fmt.Printf("  -> %v\n", unwrapped)
            }
        }

        fmt.Println()

        // Permission error
        err = accessResource("admin")
        if err != nil {
            fmt.Println("Original:", err)
            fmt.Println("Is ErrPermission:", errors.Is(err, ErrPermission))
        }
    }
    ```

=== "The Explanation"

    - **`%w` verb**: Wraps an error with additional context in `fmt.Errorf()`
    - **`errors.Unwrap()`**: Extracts the inner error from a wrapped error
    - **`errors.Is()`**: Checks if any error in the chain matches the target
    - **Error chain**: Wrapping creates a chain that can be traversed
    - **Preserving identity**: Wrapped errors maintain their original identity

=== "The Terminal Output"

    ```
    Original: connect to invalid: connection failed
    Unwrapped: connection failed
    Is ErrConnection: true

    Original: connect to slow: timeout exceeded
    Is ErrTimeout: true

    Original: fetch user 123: connect to invalid: connection failed
    Is ErrConnection: true
    Unwrap chain:
      -> fetch user 123: connect to invalid: connection failed
      -> connect to invalid: connection failed
      -> connection failed

    Original: access admin: permission denied
    Is ErrPermission: true
    ```

---

## errors.Is and errors.As

These functions provide powerful tools for inspecting error chains without manual unwrapping.

=== "The Code"

    ```go
    package main

    import (
        "errors"
        "fmt"
        "os"
    )

    // Custom error types
    type ValidationError struct {
        Field   string
        Message string
    }

    func (e *ValidationError) Error() string {
        return fmt.Sprintf("validation error on field '%s': %s", e.Field, e.Message)
    }

    type NotFoundError struct {
        Resource string
        ID       int
    }

    func (e *NotFoundError) Error() string {
        return fmt.Sprintf("%s with ID %d not found", e.Resource, e.ID)
    }

    // Functions returning custom errors
    func validateAge(age int) error {
        if age < 0 {
            return &ValidationError{
                Field:   "age",
                Message: "must be non-negative",
            }
        }
        if age > 150 {
            return &ValidationError{
                Field:   "age",
                Message: "must be less than 150",
            }
        }
        return nil
    }

    func findUserByID(id int) (string, error) {
        if id == 0 {
            return "", &NotFoundError{Resource: "User", ID: id}
        }
        return fmt.Sprintf("User_%d", id), nil
    }

    func main() {
        // errors.Is for simple comparisons
        err := os.ErrNotExist
        fmt.Println("Is os.ErrNotExist:", errors.Is(err, os.ErrNotExist))

        // errors.As for custom error types
        err = validateAge(-5)
        var validationErr *ValidationError
        if errors.As(err, &validationErr) {
            fmt.Printf("Validation failed: field=%s, message=%s\n",
                validationErr.Field, validationErr.Message)
        }

        err = validateAge(200)
        if errors.As(err, &validationErr) {
            fmt.Printf("Validation failed: field=%s, message=%s\n",
                validationErr.Field, validationErr.Message)
        }

        // errors.As with NotFoundError
        _, err = findUserByID(0)
        var notFoundErr *NotFoundError
        if errors.As(err, &notFoundErr) {
            fmt.Printf("Not found: %s with ID %d\n",
                notFoundErr.Resource, notFoundErr.ID)
        }

        // Working with wrapped errors
        err = fmt.Errorf("processing failed: %w", validateAge(-1))
        if errors.As(err, &validationErr) {
            fmt.Printf("Wrapped validation: field=%s\n", validationErr.Field)
        }
    }
    ```

=== "The Explanation"

    - **`errors.Is()`**: Checks if target error is in the chain (recursive comparison)
    - **`errors.As()`**: Extracts the first error of a specific type from the chain
    - **Pointer to interface**: Pass a pointer to the error type variable
    - **Custom types**: Define struct types implementing `error` interface
    - **Chain traversal**: Both functions work through wrapped errors

=== "The Terminal Output"

    ```
    Is os.ErrNotExist: true
    Validation failed: field=age, message=must be non-negative
    Validation failed: field=age, message=must be less than 150
    Not found: User with ID 0
    Wrapped validation: field=age
    ```

---

## Custom Error Types

Design rich error types that provide context and enable programmatic handling.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "time"
    )

    // Rich error type with context
    type AppError struct {
        Code      string
        Message   string
        Operation string
        Err       error
        Timestamp time.Time
    }

    func (e *AppError) Error() string {
        if e.Err != nil {
            return fmt.Sprintf("[%s] %s: %s (caused by: %v)",
                e.Code, e.Operation, e.Message, e.Err)
        }
        return fmt.Sprintf("[%s] %s: %s", e.Code, e.Operation, e.Message)
    }

    func (e *AppError) Unwrap() error {
        return e.Err
    }

    // Helper function to create app errors
    func NewAppError(code, operation, message string, err error) *AppError {
        return &AppError{
            Code:      code,
            Message:   message,
            Operation: operation,
            Err:       err,
            Timestamp: time.Now(),
        }
    }

    // Simulated operations
    func connectDB() error {
        return NewAppError(
            "DB_CONN_ERROR",
            "connect",
            "failed to establish connection",
            fmt.Errorf("connection refused"),
        )
    }

    func processOrder(orderID int) error {
        err := connectDB()
        if err != nil {
            return NewAppError(
                "PROC_ERROR",
                "processOrder",
                fmt.Sprintf("failed to process order %d", orderID),
                err,
            )
        }
        return nil
    }

    func main() {
        err := processOrder(12345)
        if err != nil {
            fmt.Println("Error:", err)

            // Type assertion to get custom fields
            if appErr, ok := err.(*AppError); ok {
                fmt.Printf("Code: %s\n", appErr.Code)
                fmt.Printf("Operation: %s\n", appErr.Operation)
                fmt.Printf("Time: %v\n", appErr.Timestamp)
            }
        }
    }
    ```

=== "The Explanation"

    - **Custom struct**: Include fields for code, message, context, and wrapped error
    - **`Error()` method**: Format error message with all relevant information
    - **`Unwrap()` method**: Enable error chain traversal
    - **Type assertion**: Extract custom fields after checking error type
    - **Error codes**: Use string codes for programmatic error handling

=== "The Terminal Output"

    ```
    Error: [DB_CONN_ERROR] connect: failed to establish connection (caused by: connection refused)
    Code: DB_CONN_ERROR
    Operation: connect
    Time: 2026-09-03 12:00:00 +0000 UTC
    ```

---

## Error Handling Patterns

Go's explicit error handling leads to consistent, predictable code patterns.

=== "The Code"

    ```go
    package main

    import (
        "errors"
        "fmt"
        "strings"
    )

    // Pattern 1: Simple error check
    func readConfig(path string) (string, error) {
        if path == "" {
            return "", errors.New("path cannot be empty")
        }
        return "config data", nil
    }

    // Pattern 2: Early return
    func processFile(path string) error {
        if path == "" {
            return errors.New("empty path")
        }

        data, err := readConfig(path)
        if err != nil {
            return fmt.Errorf("read config: %w", err)
        }

        if data == "" {
            return errors.New("empty config")
        }

        fmt.Println("Processing:", data)
        return nil
    }

    // Pattern 3: Error aggregation
    func validateMultiple(fields map[string]string) []error {
        var errs []error

        for field, value := range fields {
            if value == "" {
                errs = append(errs, fmt.Errorf("%s is required", field))
            }
            if len(value) < 2 {
                errs = append(errs, fmt.Errorf("%s must be at least 2 characters", field))
            }
        }
        return errs
    }

    // Pattern 4: Sentinel error checking
    func divide(a, b float64) (float64, error) {
        if b == 0 {
            return 0, errors.New("division by zero")
        }
        return a / b, nil
    }

    // Pattern 5: Error context chain
    func fetchData(url string) error {
        // Simulate different errors
        if url == "" {
            return errors.New("empty URL")
        }
        if strings.Contains(url, "timeout") {
            return fmt.Errorf("fetch %s: %w", url, errors.New("request timeout"))
        }
        if strings.Contains(url, "auth") {
            return fmt.Errorf("fetch %s: %w", url, errors.New("unauthorized"))
        }
        return nil
    }

    func main() {
        // Pattern 1: Simple check
        _, err := readConfig("")
        fmt.Println("Pattern 1:", err)

        // Pattern 2: Early return
        err = processFile("test.txt")
        fmt.Println("Pattern 2:", err)

        // Pattern 3: Error aggregation
        fields := map[string]string{
            "name":  "",
            "email": "a",
            "age":   "25",
        }
        errs := validateMultiple(fields)
        fmt.Println("Pattern 3: Validation errors:")
        for _, e := range errs {
            fmt.Println("  -", e)
        }

        // Pattern 4: Sentinel check
        result, err := divide(10, 0)
        if err != nil {
            fmt.Println("Pattern 4:", err)
        } else {
            fmt.Printf("Pattern 4: %.2f\n", result)
        }

        // Pattern 5: Error context
        urls := []string{"", "http://timeout.com", "http://auth.com", "http://ok.com"}
        for _, url := range urls {
            if err := fetchData(url); err != nil {
                fmt.Printf("Pattern 5: %v\n", err)
            } else {
                fmt.Printf("Pattern 5: %s - success\n", url)
            }
        }
    }
    ```

=== "The Explanation"

    - **Early return**: Check errors immediately and return if found
    - **Error wrapping**: Add context at each level with `%w`
    - **Error aggregation**: Collect multiple errors for batch validation
    - **Sentinel errors**: Use predefined errors for known failure cases
    - **Consistent patterns**: Follow idioms for readable, maintainable code

=== "The Terminal Output"

    ```
    Pattern 1: path cannot be empty
    Pattern 2: read config: path cannot be empty
    Pattern 3: Validation errors:
      - name is required
      - name must be at least 2 characters
      - email must be at least 2 characters
    Pattern 4: division by zero
    Pattern 5: empty URL
    Pattern 5: fetch http://timeout.com: request timeout
    Pattern 5: fetch http://auth.com: unauthorized
    Pattern 5: http://ok.com - success
    ```

---

## When to Panic

`panic` is reserved for truly unrecoverable situations, not regular error handling.

=== "The Code"

    ```go
    package main

    import "fmt"

    // Panic for programmer errors
    func divide(a, b int) int {
        if b == 0 {
            panic("division by zero: programmer error")
        }
        return a / b
    }

    // Recover from panic
    func safeDivide(a, b int) (result int, err error) {
        defer func() {
            if r := recover(); r != nil {
                err = fmt.Errorf("recovered from panic: %v", r)
            }
        }()
        return divide(a, b), nil
    }

    // Panic in initialization
    func initConfig() map[string]string {
        config := map[string]string{
            "env":  "production",
            "port": "8080",
        }
        if config["env"] == "" {
            panic("missing required configuration: env")
        }
        return config
    }

    func main() {
        // Using panic directly (not recommended)
        fmt.Println("Testing panic recovery:")
        result, err := safeDivide(10, 0)
        if err != nil {
            fmt.Println("Error:", err)
        } else {
            fmt.Println("Result:", result)
        }

        // Successful operation
        result, err = safeDivide(10, 2)
        if err != nil {
            fmt.Println("Error:", err)
        } else {
            fmt.Println("Result:", result)
        }

        // Using recovered config
        config := initConfig()
        fmt.Println("Config:", config)

        // Demonstrating when to panic
        fmt.Println("\nWhen to use panic:")
        fmt.Println("- Unrecoverable programming errors")
        fmt.Println("- Failed initialization of required resources")
        fmt.Println("- Library functions that guarantee no panics")
        fmt.Println("- Never for expected error conditions")
    }
    ```

=== "The Explanation"

    - **`panic()`**: Stops normal execution and begins unwinding the stack
    - **`recover()`**: Catches panics only in deferred functions
    - **`defer/recover`**: Use together for graceful panic recovery
    - **When to panic**: Programmer errors, failed initialization, invariant violations
    - **When NOT to panic**: Expected errors, user input validation, network failures

=== "The Terminal Output"

    ```
    Testing panic recovery:
    Error: recovered from panic: division by zero: programmer error
    Result: 5
    Config: map[env:production port:8080]

    When to use panic:
    - Unrecoverable programming errors
    - Failed initialization of required resources
    - Library functions that guarantee no panics
    - Never for expected error conditions
    ```

---

## Error Handling in Go vs Other Languages

Go's explicit approach differs fundamentally from exception-based languages.

=== "The Code"

    ```go
    package main

    import (
        "errors"
        "fmt"
        "strconv"
    )

    // Go: Explicit error handling
    func parseInt(s string) (int, error) {
        n, err := strconv.Atoi(s)
        if err != nil {
            return 0, fmt.Errorf("parse int: %w", err)
        }
        return n, nil
    }

    // Go: Multiple error returns
    func divide(a, b float64) (float64, error) {
        if b == 0 {
            return 0, errors.New("division by zero")
        }
        return a / b, nil
    }

    // Comparison with pseudocode from other languages
    func comparison() {
        // JavaScript style (pseudocode):
        // try {
        //   const result = parseInt("abc");
        // } catch (e) {
        //   console.log(e.message);
        // }

        // Go style:
        _, err := parseInt("abc")
        if err != nil {
            fmt.Println("Go: Error handled explicitly:", err)
        }

        // Python style (pseudocode):
        // try:
        //     result = int("abc")
        // except ValueError as e:
        //     print(f"Error: {e}")

        // Go: No hidden control flow
        fmt.Println("\nGo's Error Handling Philosophy:")
        fmt.Println("1. Errors are values, not exceptions")
        fmt.Println("2. Explicit checking at every call site")
        fmt.Println("3. No hidden control flow")
        fmt.Println("4. Compile-time safety")
        fmt.Println("5. Easy to reason about")
    }

    func main() {
        // Direct comparison
        values := []string{"123", "abc", "456", "xyz"}

        fmt.Println("Processing values:")
        for _, v := range values {
            if n, err := parseInt(v); err != nil {
                fmt.Printf("  %s: Error - %v\n", v, err)
            } else {
                fmt.Printf("  %s: Success - %d\n", v, n)
            }
        }

        comparison()
    }
    ```

=== "The Explanation"

    - **No exceptions**: Go uses explicit error returns instead of try/catch
    - **Error as value**: Errors are first-class values that can be inspected
    - **No hidden flow**: Control flow is always explicit in the code
    - **Trade-offs**: More verbose but more predictable and maintainable
    - **Cultural shift**: Requires thinking differently about error handling

=== "The Terminal Output"

    ```
    Processing values:
      123: Success - 123
      abc: Error - parse int: strconv.Atoi: parsing "abc": invalid syntax
      456: Success - 456
      xyz: Error - parse int: strconv.Atoi: parsing "xyz": invalid syntax
    Go: Error handled explicitly: parse int: strconv.Atoi: parsing "abc": invalid syntax

    Go's Error Handling Philosophy:
    1. Errors are values, not exceptions
    2. Explicit checking at every call site
    3. No hidden control flow
    4. Compile-time safety
    5. Easy to reason about
    ```

---

## Best Practices

| Practice | Recommendation | Reason |
|----------|---------------|--------|
| Error checking | Check every error | Prevents silent failures |
| Error wrapping | Add context with `%w` | Enables better debugging |
| Sentinel errors | Export for package users | Enables error comparison |
| Error types | Use for rich context | Provides programmatic handling |
| Panic usage | Only for unrecoverable errors | Maintains program stability |
| Error messages | Lowercase, no punctuation | Follow Go conventions |

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Ignored errors | Not checking return values | Always check `err != nil` |
| Wrapped error not found | Using `==` instead of `errors.Is()` | Use `errors.Is()` for comparison |
| Panic not recovered | `recover()` not in deferred function | Ensure `defer func() { recover() }()` |
| Error context lost | Not wrapping at each level | Wrap errors with `%w` at each call |
| Custom error not extracted | Using `errors.Is()` instead of `errors.As()` | Use `errors.As()` for type extraction |

## Summary

- Go uses explicit error handling with the `error` interface
- Create errors with `errors.New()` and `fmt.Errorf()`
- Wrap errors with `%w` to preserve context and identity
- Use `errors.Is()` for comparison and `errors.As()` for type extraction
- Design custom error types for rich context
- Reserve `panic` for truly unrecoverable situations

## Next Steps

- [HTTP Servers](http-servers.md) - Apply error handling in web applications
- [Functions & Methods](functions-methods.md) - Understand error return patterns
- [Structs & Interfaces](structs-interfaces.md) - Design custom error types
