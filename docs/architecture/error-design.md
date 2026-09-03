# Error Design Philosophy

Go takes a fundamentally different approach to error handling compared to exception-based languages. Errors are values, not control flow mechanisms. This philosophy encourages explicit, composable error handling that makes failure paths visible and manageable. Understanding Go's error design is essential for writing robust, maintainable programs.

## What You Will Learn

- Why errors are values in Go, not exceptions
- The `error` interface and how it works
- Sentinel errors and when to use them
- Error wrapping with `fmt.Errorf` and `%w`
- `errors.Is` and `errors.As` for error inspection
- Common error handling patterns
- When to `panic` vs return an error
- The error vs exception mindset shift

## Prerequisites

- Basic Go syntax and interfaces
- Understanding of function return values
- Go 1.13 or later (for error wrapping)

---

## Errors Are Values

In Go, errors are ordinary values that implement the `error` interface. They can be stored in variables, passed to functions, returned from methods, and compared — just like any other value.

=== "Error as a Value"

    ```go
    package main

    import (
        "errors"
        "fmt"
    )

    func divide(a, b float64) (float64, error) {
        if b == 0 {
            return 0, errors.New("division by zero")
        }
        return a / b, nil
    }

    func main() {
        // Error is just a return value
        result, err := divide(10, 3)
        if err != nil {
            fmt.Printf("Error: %v\n", err)
            return
        }
        fmt.Printf("10 / 3 = %.2f\n", result)

        result, err = divide(10, 0)
        if err != nil {
            fmt.Printf("Error: %v\n", err)
            return
        }
        fmt.Printf("10 / 0 = %.2f\n", result)
    }
    ```

=== "The Explanation"

    - **`error` interface**: Any type with an `Error() string` method satisfies the interface
    - **`errors.New("message")`**: Creates a simple error with a string message
    - **`nil` error**: Indicates success; `err != nil` indicates failure
    - **Explicit checking**: You must check `err` at every call site — no hidden control flow

=== "The Terminal Output"

    ```
    10 / 3 = 3.33
    Error: division by zero
    ```

!!! go "The Error Interface"
    ```go
    type error interface {
        Error() string
    }
    ```
    Any value with an `Error() string` method is an error. This is Go's most important interface for error handling.

---

## The error Interface in Depth

The `error` interface is minimal — a single method returning a string. This simplicity is intentional.

=== "Custom Error Types"

    ```go
    package main

    import "fmt"

    type ValidationError struct {
        Field   string
        Message string
    }

    func (e *ValidationError) Error() string {
        return fmt.Sprintf("validation error: field %q - %s", e.Field, e.Message)
    }

    type NotFoundError struct {
        Resource string
        ID       int
    }

    func (e *NotFoundError) Error() string {
        return fmt.Sprintf("%s with ID %d not found", e.Resource, e.ID)
    }

    func findUser(id int) (*string, error) {
        if id == 1 {
            name := "Alice"
            return &name, nil
        }
        return nil, &NotFoundError{Resource: "User", ID: id}
    }

    func validateAge(age int) error {
        if age < 0 || age > 150 {
            return &ValidationError{Field: "age", Message: "must be between 0 and 150"}
        }
        return nil
    }

    func main() {
        user, err := findUser(1)
        if err != nil {
            fmt.Printf("Error: %v\n", err)
        } else {
            fmt.Printf("Found user: %s\n", *user)
        }

        user, err = findUser(99)
        if err != nil {
            fmt.Printf("Error: %v\n", err)
        }

        err = validateAge(25)
        if err != nil {
            fmt.Printf("Error: %v\n", err)
        } else {
            fmt.Println("Age 25 is valid")
        }

        err = validateAge(-5)
        if err != nil {
            fmt.Printf("Error: %v\n", err)
        }
    }
    ```

=== "The Explanation"

    - **`ValidationError`**: Custom error type with structured data
    - **`NotFoundError`**: Another custom error type for missing resources
    - **`Error() string`**: Method that makes the struct satisfy the `error` interface
    - **Structured errors**: Custom types carry context beyond a simple message string

=== "The Terminal Output"

    ```
    Found user: Alice
    User with ID 99 not found
    Age 25 is valid
    validation error: field "age" - must be between 0 and 150
    ```

---

## Sentinel Errors

Sentinel errors are package-level error variables that represent specific, known failure conditions. They are compared using `errors.Is`.

=== "Sentinel Error Definition"

    ```go
    package main

    import (
        "errors"
        "fmt"
        "os"
    )

    // Sentinel errors — predefined error values
    var (
        ErrNotFound     = errors.New("resource not found")
        ErrUnauthorized = errors.New("unauthorized access")
        ErrTimeout      = errors.New("operation timed out")
        ErrClosed       = errors.New("resource already closed")
    )

    func readFile(path string) ([]byte, error) {
        data, err := os.ReadFile(path)
        if err != nil {
            if errors.Is(err, os.ErrNotExist) {
                return nil, ErrNotFound
            }
            return nil, fmt.Errorf("read file: %w", err)
        }
        return data, nil
    }

    func main() {
        _, err := readFile("nonexistent.txt")
        if err != nil {
            fmt.Printf("Error type: %T\n", err)
            fmt.Printf("Error value: %v\n", err)
            fmt.Printf("Is ErrNotFound: %v\n", errors.Is(err, ErrNotFound))
        }

        _, err = os.ReadFile("/etc/hosts")
        if err != nil {
            fmt.Printf("Error: %v\n", err)
        } else {
            fmt.Println("Successfully read /etc/hosts")
        }
    }
    ```

=== "The Explanation"

    - **`var ErrNotFound = errors.New(...)`**: Package-level sentinel error
    - **`errors.Is(err, ErrNotFound)`**: Checks if the error chain contains the sentinel
    - **Comparison**: `errors.Is` unwraps the chain; `==` does not
    - **Convention**: Sentinel errors start with `Err` prefix

=== "The Terminal Output"

    ```
    Error type: *errors.errorString
    Error value: resource not found
    Is ErrNotFound: true
    Successfully read /etc/hosts
    ```

!!! warning "Sentinel Error Best Practices"
    - Only use sentinels for well-known, documented error conditions
    - Export sentinels from packages for consumers to check
    - Don't create too many — too many sentinels become a maintenance burden
    - Prefer custom error types over sentinels when context is needed

---

## Error Wrapping with fmt.Errorf %w

Go 1.13 introduced error wrapping with `%w`. This adds context to an error while preserving the original error for inspection.

=== "Error Wrapping"

    ```go
    package main

    import (
        "errors"
        "fmt"
        "os"
    )

    var ErrConfigNotFound = errors.New("config not found")

    func loadConfig(path string) (string, error) {
        data, err := os.ReadFile(path)
        if err != nil {
            if errors.Is(err, os.ErrNotExist) {
                return "", fmt.Errorf("load config: %w", ErrConfigNotFound)
            }
            return "", fmt.Errorf("load config: %w", err)
        }
        return string(data), nil
    }

    func main() {
        config, err := loadConfig("config.yaml")
        if err != nil {
            fmt.Printf("Error: %v\n", err)
            fmt.Printf("Unwrapped: %v\n", errors.Unwrap(err))

            // Can still check for the original error
            if errors.Is(err, ErrConfigNotFound) {
                fmt.Println("→ Config file not found, using defaults")
            }
        } else {
            fmt.Printf("Config: %s\n", config)
        }
    }
    ```

=== "The Explanation"

    - **`fmt.Errorf("context: %w", err)`**: Wraps `err` with additional context
    - **`%w` verb**: Creates a wrapped error that preserves the original
    - **`errors.Unwrap(err)`**: Returns the inner error
    - **`errors.Is`**: Unwraps the chain to check for specific errors

=== "The Terminal Output"

    ```
    Error: load config: config not found
    Unwrapped: config not found
    → Config file not found, using defaults
    ```

| Format Verb | Behavior |
|---|---|
| `%v` | Formats error as string, does NOT wrap |
| `%w` | Wraps the error, preserving it for `errors.Is`/`errors.As` |
| `%s` | Formats error as string, does NOT wrap |
| `%q` | Quoted string representation |

---

## errors.Is and errors.As

These functions inspect error chains without type assertions. They unwrap errors automatically.

=== "Error Inspection"

    ```go
    package main

    import (
        "errors"
        "fmt"
        "os"
        "path/filepath"
    )

    type PathError struct {
        Op   string
        Path string
        Err  error
    }

    func (e *PathError) Error() string {
        return fmt.Sprintf("%s %s: %v", e.Op, e.Path, e.Err)
    }

    func (e *PathError) Unwrap() error {
        return e.Err
    }

    func openFile(path string) error {
        _, err := os.Open(path)
        if err != nil {
            return &PathError{Op: "open", Path: path, Err: err}
        }
        return nil
    }

    func main() {
        err := openFile(filepath.Join(os.TempDir(), "nonexistent"))
        if err != nil {
            fmt.Printf("Original error: %v\n\n", err)

            // errors.Is checks the entire chain
            fmt.Printf("Is os.ErrNotExist: %v\n", errors.Is(err, os.ErrNotExist))

            // errors.As extracts a specific error type
            var pathErr *PathError
            if errors.As(err, &pathErr) {
                fmt.Printf("PathError found:\n")
                fmt.Printf("  Op: %s\n", pathErr.Op)
                fmt.Printf("  Path: %s\n", pathErr.Path)
                fmt.Printf("  Inner error: %v\n", pathErr.Err)
            }
        }
    }
    ```

=== "The Explanation"

    - **`errors.Is(err, target)`**: Walks the error chain checking for `target`
    - **`errors.As(err, &target)`**: Finds the first error in the chain matching the type
    - **`Unwrap()` method**: Required for `errors.Is`/`errors.As` to traverse the chain
    - **Type-safe extraction**: No type assertions needed; works through wrapping

=== "The Terminal Output"

    ```
    Original error: open /var/folders/.../nonexistent: no such file or directory

    Is os.ErrNotExist: true
    PathError found:
      Op: open
      Path: /var/folders/.../nonexistent
      Inner error: open /var/folders/.../nonexistent: no such file or directory
    ```

!!! go "errors.Is vs errors.As"
    Use `errors.Is` to check for specific sentinel errors or values. Use `errors.As` to extract structured error data from the chain. Never use `==` for error comparison — it doesn't unwrap.

---

## Error Handling Patterns

=== "Pattern: Error Accumulation"

    ```go
    package main

    import (
        "errors"
        "fmt"
    )

    type MultiError struct {
        errors []error
    }

    func (m *MultiError) Add(err error) {
        if err != nil {
            m.errors = append(m.errors, err)
        }
    }

    func (m *MultiError) Error() string {
        msgs := make([]string, len(m.errors))
        for i, err := range m.errors {
            msgs[i] = err.Error()
        }
        return fmt.Sprintf("%d errors: %s", len(m.errors),
            errors.Join(m.errors...))
    }

    func (m *MultiError) Unwrap() []error {
        return m.errors
    }

    func validate(name string, age int, email string) error {
        me := &MultiError{}

        if name == "" {
            me.Add(fmt.Errorf("name is required"))
        }
        if age < 0 || age > 150 {
            me.Add(fmt.Errorf("age must be between 0 and 150, got %d", age))
        }
        if email == "" {
            me.Add(fmt.Errorf("email is required"))
        }

        if len(me.errors) == 0 {
            return nil
        }
        return me
    }

    func main() {
        err := validate("", -5, "")
        if err != nil {
            fmt.Printf("Validation failed:\n%v\n", err)
        }
    }
    ```

=== "The Explanation"

    - **`MultiError`**: Collects multiple errors into a single value
    - **`errors.Join`**: Go 1.20+ joins multiple errors into one
    - **Validation**: Common use case where multiple fields can fail independently
    - **`Unwrap() []error`**: Returns all errors for inspection

=== "The Terminal Output"

    ```
    Validation failed:
    3 errors: name is required
    age must be between 0 and 150, got -5
    email is required
    ```

=== "Pattern: Error Handling at Boundaries"

    ```go
    package main

    import (
        "fmt"
        "log"
        "os"
    )

    func processFile(path string) error {
        file, err := os.Open(path)
        if err != nil {
            return fmt.Errorf("open file: %w", err)
        }
        defer file.Close()

        // Process file...
        fmt.Printf("Processing %s\n", path)
        return nil
    }

    func main() {
        // Library: return errors for callers to handle
        // Application: handle errors at the boundary

        files := []string{"file1.txt", "file2.txt"}

        for _, f := range files {
            if err := processFile(f); err != nil {
                // At the application boundary: log and continue
                log.Printf("Skipping %s: %v\n", f, err)
                continue
            }
            fmt.Printf("✓ Processed %s\n", f)
        }
    }
    ```

=== "The Explanation"

    - **Library code**: Return errors; let the caller decide how to handle them
    - **Application code**: Handle errors at boundaries (main, handlers, CLI entry points)
    - **`log.Printf`**: Log the error and continue with the next file
    - **Don't ignore errors**: Always check `err != nil` or use `_` explicitly

=== "The Terminal Output"

    ```
    Skipping file1.txt: open file1.txt: no such file or directory
    Skipping file2.txt: open file2.txt: no such file or directory
    ```

---

## When to Panic

Panics are for unrecoverable programmer errors, not for expected failures. Use them sparingly.

=== "Appropriate and Inappropriate Panics"

    ```go
    package main

    import "fmt"

    // Appropriate: programmer error — this should never happen
    func mustParseInt(s string) int {
        var n int
        _, err := fmt.Sscanf(s, "%d", &n)
        if err != nil {
            panic(fmt.Sprintf("mustParseInt: invalid input %q: %v", s, err))
        }
        return n
    }

    // Inappropriate: expected condition — should return error
    func connect(addr string) error {
        if addr == "" {
            return fmt.Errorf("address is required")
        }
        // Connection logic...
        return nil
    }

    func main() {
        // Valid use of panic — programmer error
        val := mustParseInt("42")
        fmt.Printf("Parsed: %d\n", val)

        // In production, recover from panics in goroutines
        defer func() {
            if r := recover(); r != nil {
                fmt.Printf("Recovered from panic: %v\n", r)
            }
        }()

        // Simulate a panic
        go func() {
            defer func() {
                if r := recover(); r != nil {
                    fmt.Printf("Goroutine recovered: %v\n", r)
                }
            }()
            panic("something went wrong in goroutine")
        }()

        // Wait for goroutine to panic and recover
        fmt.Println("Program continues after goroutine panic")
    }
    ```

=== "The Explanation"

    - **Panic for programmer errors**: Index out of bounds, nil pointer, invalid configuration
    - **Don't panic for user input**: Return errors instead — panics are not for expected failures
    - **`recover()`**: Catches panics; only works in deferred functions
    - **Goroutine panics**: Must be recovered within the goroutine; otherwise crash the program

=== "The Terminal Output"

    ```
    Parsed: 42
    Goroutine recovered: something went wrong in goroutine
    Program continues after goroutine panic
    ```

| Use `return error` | Use `panic` |
|---|---|
| Invalid user input | Programmer error (nil pointer, index out of range) |
| Network failures | Impossible conditions (invariant violation) |
| File not found | Initialization failure (config missing) |
| Authentication errors | Package-level initialization (must succeed) |
| Business logic errors | `must*` functions |

---

## Error vs Exception Mindset

Go's approach is fundamentally different from exception-based languages. This requires a mindset shift.

=== "Exception vs Error Comparison"

    ```go
    package main

    import (
        "errors"
        "fmt"
    )

    // Go style: explicit error handling
    func divideGo(a, b float64) (float64, error) {
        if b == 0 {
            return 0, errors.New("division by zero")
        }
        return a / b, nil
    }

    func main() {
        // Go: Error is part of the function signature
        // Callers MUST handle or explicitly ignore the error
        result, err := divideGo(10, 2)
        if err != nil {
            fmt.Printf("Error: %v\n", err)
            return
        }
        fmt.Printf("10 / 2 = %.2f\n", result)

        // Explicitly ignoring an error (not recommended but visible)
        _, _ = divideGo(10, 0) // _ = I'm choosing to ignore this

        result, err = divideGo(10, 0)
        if err != nil {
            fmt.Printf("Error: %v\n", err)
        }
    }
    ```

=== "The Explanation"

    - **Go style**: Errors are values in return positions; handling is explicit
    - **Exception style**: Errors unwind the stack implicitly; handlers are separate
    - **Visibility**: In Go, every error check is visible in the code flow
    - **`_, _ = fn()`**: Explicitly ignoring an error makes the decision visible

=== "The Terminal Output"

    ```
    10 / 2 = 5.00
    Error: division by zero
    ```

!!! go "Mindset Shift"
    | Exception Mindset | Go Error Mindset |
    |---|---|
    | Errors are exceptional | Errors are expected outcomes |
    | Handle with try/catch | Handle with if err != nil |
    | Implicit control flow | Explicit control flow |
    | Unhandled exceptions crash | Unhandled errors are bugs you chose to ignore |
    | One handler for many calls | One check per call |

---

## Best Practices

| Practice | Description |
|---|---|
| Check every error | Never ignore errors silently; use `_` explicitly |
| Add context with `%w` | Wrap errors with `fmt.Errorf("context: %w", err)` |
| Use sentinel errors sparingly | Prefer custom error types for structured errors |
| Return early on error | Use early returns to reduce nesting |
| Don't panic for user input | Return errors for expected failure conditions |
| Handle errors at boundaries | Libraries return errors; applications handle them |
| Use `errors.Is`/`errors.As` | Never use `==` to compare errors |

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Error context lost | Using `%v` instead of `%w` in `fmt.Errorf` | Use `%w` to preserve the error chain |
| `errors.Is` always false | Error wasn't wrapped with `%w` | Ensure errors are wrapped correctly |
| Panic in production | Unrecovered panic in goroutine | Add `defer recover()` in every goroutine |
| Nested error checks | Multiple sequential error-prone calls | Use early returns or helper functions |
| Error message unclear | Generic error without context | Add operation context: `fmt.Errorf("fetch users: %w", err)` |
| `errors.As` fails | Wrong target type or nil pointer | Pass pointer to error type: `errors.As(err, &target)` |

## Summary

- Errors are values in Go — they implement the `error` interface with `Error() string`
- Sentinel errors (`ErrNotFound`, etc.) represent known failure conditions
- Wrap errors with `fmt.Errorf("context: %w", err)` to add context while preserving the chain
- Use `errors.Is` to check for specific errors; `errors.As` to extract structured data
- Panics are for programmer errors only; expected failures should return errors
- Handle errors at application boundaries; libraries should return them
- The Go mindset: errors are expected, not exceptional — handle them explicitly

## Next Steps

- [Concurrency Model](concurrency-model.md) — Master goroutines and channels
- [Memory Model](memory-model.md) — Understand synchronization and happens-before
- [Runtime & GC](runtime-gc.md) — Learn about garbage collection internals
