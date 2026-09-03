# Your First Program

The traditional first step in any language is the "Hello, World!" program. In Go, this is deliberately simple — but there is more happening beneath the surface than you might expect. This chapter explains every line, every concept, and every command you need to understand to go from zero to a running Go program.

## What You Will Learn

- Write, build, and run your first Go program
- Understand `package main` and why it matters
- Use the `fmt` package for formatted output
- Compile vs interpret — how Go binaries work
- Write and run your first test

## Prerequisites

- [Setup & Installation](setup-installation.md) — Go 1.22+ installed and verified

---

## Hello, World!

Here is the complete source code for a minimal Go program:

=== "The Code"

    ```go
    // File: main.go
    package main

    import "fmt"

    func main() {
        fmt.Println("Hello, World!")
    }
    ```

=== "The Explanation"

    - **`package main`**: Declares this file belongs to the `main` package. In Go, the `main` package tells the compiler to produce an executable binary rather than a library.
    - **`import "fmt"`**: Imports the `fmt` package from the standard library. This package provides functions for formatted I/O (printing to stdout, scanning input, formatting strings).
    - **`func main()`**: The entry point of your program. When you run a Go binary, execution begins here. The `main` function takes no arguments and returns nothing.
    - **`fmt.Println("Hello, World!")`**: Prints the string to stdout followed by a newline. `Println` is the "print line" function — it adds spacing between arguments and a trailing newline.

=== "The Terminal Output"

    ```bash
    $ go run main.go
    Hello, World!
    ```

---

## Understanding package main

In Go, every source file belongs to a package. The package declaration is always the first line of the file.

```go
package main    // This file is in the "main" package
```

The `main` package is special: it tells the Go compiler to create an executable program. Every other package in Go compiles to a library (a non-executable archive).

=== "main Package"

    ```go
    // main.go
    package main

    import "fmt"

    func main() {
        fmt.Println("This produces a binary")
    }
    ```

    ```bash
    $ go build -o myapp
    $ ./myapp
    This produces a binary
    ```

=== "Non-main Package"

    ```go
    // greet/greet.go
    package greet

    import "fmt"

    // Greet prints a greeting
    func Greet(name string) {
        fmt.Printf("Hello, %s!\n", name)
    }
    ```

    ```bash
    # This does NOT produce a binary
    $ go build ./greet/
    # It compiles to a library archive (.a file)
    ```

!!! go "Go 1.22+ Feature"

    In Go 1.22, the `for` loop variable scoping changed. Each iteration of a `for` loop now creates a new variable, eliminating a classic closure bug. While not relevant to Hello World, keep this in mind as you write more complex programs.

---

## The fmt Package

The `fmt` package is your primary tool for output. Here are the key functions:

```go
package main

import "fmt"

func main() {
    // Println adds a newline and spaces between arguments
    fmt.Println("Hello", "World")
    // Output: Hello World

    // Print does NOT add a newline
    fmt.Print("Hello")
    fmt.Print(" World\n")

    // Printf for formatted output
    name := "Go"
    version := 1.22
    fmt.Printf("Language: %s, Version: %.1f\n", name, version)
    // Output: Language: Go, Version: 1.2

    // Sprintf returns a string instead of printing
    msg := fmt.Sprintf("Version %.1f", version)
    fmt.Println(msg)

    // Errorf for creating formatted errors
    err := fmt.Errorf("invalid input: %q", "bad value")
    fmt.Println(err)
}
```

=== "Format Verbs Reference"

    | Verb | Description | Example |
    |------|-------------|---------|
    | `%s` | String | `fmt.Sprintf("%s", "hello")` → `"hello"` |
    | `%d` | Decimal integer | `fmt.Sprintf("%d", 42)` → `"42"` |
    | `%f` | Decimal floating point | `fmt.Sprintf("%f", 3.14)` → `"3.140000"` |
    | `%.2f` | Floating point, 2 decimals | `fmt.Sprintf("%.2f", 3.14)` → `"3.14"` |
    | `%v` | Default format (any type) | `fmt.Sprintf("%v", myStruct)` → struct string |
    | `%+v` | Struct with field names | `fmt.Sprintf("%+v", myStruct)` → `{Name: "Go"}` |
    | `%T` | Type of the value | `fmt.Sprintf("%T", 42)` → `"int"` |
    | `%p` | Pointer address | `fmt.Sprintf("%p", &x)` → `"0xc0000b4000"` |
    | `%q` | Quoted string | `fmt.Sprintf("%q", "hello")` → `"\"hello\""` |
    | `%b` | Binary | `fmt.Sprintf("%b", 8)` → `"1000"` |
    | `%x` | Hexadecimal | `fmt.Sprintf("%x", 255)` → `"ff"` |

=== "The Terminal Output"

    ```bash
    $ go run fmt_example.go
    Hello World
    Hello World
    Language: Go, Version: 1.2
    Version 1.2
    invalid input: "bad value"
    ```

---

## Compile vs Interpret

Go is a **compiled language**. This means your source code is translated into machine code before execution, producing a standalone binary.

=== "Compile and Run (go build)"

    ```bash
    # Compile to a binary
    $ go build -o hello

    # Run the binary
    $ ./hello
    Hello, World!

    # The binary is self-contained — no Go installation needed to run it
    $ file hello
    hello: Mach-O 64-bit executable arm64
    ```

=== "Run Directly (go run)"

    ```bash
    # go run compiles and executes in one step
    $ go run main.go
    Hello, World!

    # No binary is left behind — it runs from a temp directory
    $ ls -la hello
    ls: hello: No such file or directory
    ```

=== "Comparison"

    | Command | Compiles | Runs | Leaves Binary | Use Case |
    |---------|----------|------|---------------|----------|
    | `go run` | Yes | Yes | No | Development, quick testing |
    | `go build` | Yes | No | Yes | Production deployment |
    | `go install` | Yes | No | Yes (to `$GOBIN`) | Installing CLI tools |

!!! note "Why Compiled Matters"

    Compiled binaries have significant advantages for production:
    - **No runtime dependencies** — the binary includes everything it needs
    - **Startup time** — binaries start instantly, no interpreter to load
    - **Performance** — no interpretation overhead
    - **Deployment** — copy a single file to deploy

---

## A Slightly More Complex Program

Let's expand beyond Hello World to see more Go features:

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
        "time"
    )

    func main() {
        // Variables with explicit types
        var name string
        var age int
        var height float64
        var active bool

        // Short declaration (type inferred)
        name = "Gopher"
        age = 3
        height = 1.8
        active = true

        // Print all variables
        fmt.Printf("Name:    %s\n", name)
        fmt.Printf("Age:     %d years\n", age)
        fmt.Printf("Height:  %.1fm\n", height)
        fmt.Printf("Active:  %t\n", active)

        // Current time
        fmt.Printf("Time:    %s\n", time.Now().Format(time.RFC3339))

        // Command-line arguments
        args := os.Args
        fmt.Printf("Args:    %v\n", args)

        // Conditional
        if active {
            fmt.Println("Status:  Active")
        } else {
            fmt.Println("Status:  Inactive")
        }
    }
    ```

=== "The Explanation"

    - **`var name string`**: Declares a variable with explicit type. Go infers zero values (`""` for strings, `0` for numbers, `false` for bools).
    - **`name = "Gopher"`**: Assigns a value to the declared variable.
    - **`fmt.Printf`**: Uses format verbs (`%s`, `%d`, `%.1f`, `%t`) for controlled output formatting.
    - **`time.Now().Format(time.RFC3339)`**: Gets the current time and formats it as an ISO 8601 string.
    - **`os.Args`**: Slice of command-line arguments. `os.Args[0]` is the program name.
    - **`if active { ... }`**: Conditional execution. No parentheses needed around the condition.

=== "The Terminal Output"

    ```bash
    $ go run main.go
    Name:    Gopher
    Age:     3 years
    Height:  1.8m
    Active:  true
    Time:    2024-01-15T10:30:00Z
    Args:    [main.go]
    Status:  Active

    $ go run main.go --verbose
    Args:    [main.go --verbose]
    Status:  Active
    ```

---

## Writing Your First Test

Go has built-in testing support. Tests live in `_test.go` files alongside your code.

=== "The Code"

    ```go
    // File: greet.go
    package main

    import "fmt"

    func greet(name string) string {
        return fmt.Sprintf("Hello, %s!", name)
    }
    ```

    ```go
    // File: greet_test.go
    package main

    import "testing"

    func TestGreet(t *testing.T) {
        result := greet("Go")
        expected := "Hello, Go!"
        if result != expected {
            t.Errorf("greet(\"Go\") = %q, want %q", result, expected)
        }
    }

    func TestGreetEmpty(t *testing.T) {
        result := greet("")
        expected := "Hello, !"
        if result != expected {
            t.Errorf("greet(\"\") = %q, want %q", result, expected)
        }
    }
    ```

=== "The Explanation"

    - **`package main`**: Tests must be in the same package as the code they test.
    - **`func TestGreet(t *testing.T)`**: Test functions must start with `Test` and accept `*testing.T` as their only argument.
    - **`t.Errorf(...)`**: Reports a test failure with a formatted message. The test continues running after a failure (unlike `t.Fatalf` which stops immediately).
    - **`_test.go` suffix**: Files ending in `_test.go` are excluded from normal builds — they are only compiled when running `go test`.

=== "The Terminal Output"

    ```bash
    $ go test -v .
    === RUN   TestGreet
    --- PASS: TestGreet (0.00s)
    === RUN   TestGreetEmpty
    --- PASS: TestGreetEmpty (0.00s)
    PASS
    ok      github.com/user/hello    0.002s
    ```

!!! go "Test Naming Convention"

    Go test functions are named `TestXxx` where `Xxx` starts with an uppercase letter. Common patterns:
    - `TestFunctionName` — basic test
    - `TestFunctionName_Scenario` — scenario-specific test
    - `TestFunctionName_ErrorCase` — error path test

---

## Building for Production

When you are ready to deploy, build an optimized binary:

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "runtime"
    )

    // These variables are set at build time using -ldflags
    var (
        version   = "dev"
        buildTime = "unknown"
        gitCommit = "unknown"
    )

    func main() {
        fmt.Printf("App Version:   %s\n", version)
        fmt.Printf("Build Time:    %s\n", buildTime)
        fmt.Printf("Git Commit:    %s\n", gitCommit)
        fmt.Printf("Go Version:    %s\n", runtime.Version())
        fmt.Printf("OS/Arch:       %s/%s\n", runtime.GOOS, runtime.GOARCH)
    }
    ```

=== "Building with Version Info"

    ```bash
    # Build with version information embedded
    $ go build \
        -ldflags "-X main.version=1.0.0 \
                  -X main.buildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
                  -X main.gitCommit=$(git rev-parse --short HEAD)" \
        -o myapp

    # Run the binary
    $ ./myapp
    App Version:   1.0.0
    Build Time:    2024-01-15T10:30:00Z
    Git Commit:    a1b2c3d
    Go Version:    go1.22.0
    OS/Arch:       darwin/arm64
    ```

=== "Cross-Compilation"

    ```bash
    # Build for Linux (from macOS or any OS)
    $ GOOS=linux GOARCH=amd64 go build -o myapp-linux-amd64

    # Build for Windows
    $ GOOS=windows GOARCH=amd64 go build -o myapp.exe

    # Build for Linux ARM64 (e.g., Raspberry Pi)
    $ GOOS=linux GOARCH=arm64 go build -o myapp-linux-arm64

    # Available GOOS/GOARCH combinations
    $ go tool dist list
    ```

---

## Best Practices

| Practice | Recommendation |
|----------|---------------|
| **File naming** | Use lowercase, underscores for multi-word files (`hello_world.go`) |
| **Package naming** | Short, lowercase, single-word (`main`, `user`, `http`) |
| **Function naming** | CamelCase for exported, camelCase for unexported |
| **Entry point** | Always put `func main()` in `package main` |
| **Imports** | Group stdlib, then external, then internal packages |
| **Tests** | Write tests alongside code in `_test.go` files |
| **Formatting** | Always run `gofmt` or `goimports` before committing |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `undefined: main` | Ensure you have `package main` and `func main()` |
| `cannot find module` | Run `go mod init` if you are in a new directory |
| `syntax error` | Check for missing braces, semicolons, or import statements |
| `imported and not used` | Remove unused imports or use `_` blank identifier |
| `go run` is slow | First run compiles; subsequent runs use cache |
| `cannot use string as int` | Go is statically typed — use explicit conversion |
| `test failed` | Read the error output; fix the condition in your test |
| Binary is large | Go binaries include runtime; use `ldflags` and strip debug info |

## Summary

- `package main` + `func main()` = executable program
- `go run` compiles and runs; `go build` compiles only
- `fmt` is the primary package for output
- Go is compiled — binaries are self-contained and fast
- Tests live in `_test.go` files and run with `go test`
- Use `-ldflags` to embed build information in binaries

## Next Steps

- [Go Modules & Dependencies](go-modules.md) — Manage dependencies and modules
- [Project Structure](project-structure.md) — Organize your codebase
- [Basic Syntax & Types](basic-syntax.md) — Learn Go's type system
- [IDE Setup & Tooling](ide-setup.md) — Configure your editor for productivity
