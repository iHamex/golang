# CLI Applications

Go is an excellent choice for building command-line tools due to its fast compilation, static binaries, and rich standard library. From simple scripts to complex multi-command tools, Go provides everything you need to create professional CLI applications.

---

## What You Will Learn

- Parsing command-line arguments with `os.Args`
- Using the `flag` package for built-in argument parsing
- Building complex CLIs with the `cobra` library
- Exploring `urfave/cli` for alternative CLI patterns
- Implementing command structures and subcommands
- Handling flags and positional arguments
- Validating user input
- Creating interactive prompts
- Managing exit codes properly
- Cross-compiling for multiple platforms

---

## Prerequisites

- Basic Go knowledge and syntax
- Understanding of packages and imports
- Familiarity with error handling

---

## Basic Argument Parsing with os.Args

The simplest way to access command-line arguments.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
    )

    func main() {
        // os.Args contains all command-line arguments
        fmt.Printf("Program name: %s\n", os.Args[0])
        fmt.Printf("Number of arguments: %d\n", len(os.Args)-1)
        fmt.Println("\nAll arguments:")

        for i, arg := range os.Args[1:] {
            fmt.Printf("  arg[%d]: %s\n", i, arg)
        }
    }
    ```

=== "The Explanation"

    - **os.Args**: Slice of command-line arguments
    - **os.Args[0]**: The program name
    - **os.Args[1:]**: All arguments except program name
    - **len(os.Args)-1**: Count of actual arguments

=== "The Terminal Output"

    ```
    $ go run main.go --name Alice --age 30
    Program name: /tmp/go-build123456/b001/exe/main
    Number of arguments: 4

    All arguments:
      arg[0]: --name
      arg[1]: Alice
      arg[2]: --age
      arg[3]: 30
    ```

!!! danger "Limitation"
`os.Args` provides raw string arguments without type conversion or validation. Use `flag` or a CLI library for production applications.

---

## The flag Package

Go's standard library provides robust argument parsing with `flag`.

=== "The Code"

    ```go
    package main

    import (
        "flag"
        "fmt"
        "os"
    )

    func main() {
        // Define flags
        name := flag.String("name", "World", "Name to greet")
        count := flag.Int("count", 1, "Number of times to greet")
        uppercase := flag.Bool("uppercase", false, "Convert greeting to uppercase")

        // Custom usage message
        flag.Usage = func() {
            fmt.Fprintf(os.Stderr, "Usage: %s [options]\n\n", os.Args[0])
            fmt.Println("A friendly greeting program")
            fmt.Println("\nOptions:")
            flag.PrintDefaults()
        }

        // Parse flags
        flag.Parse()

        // Use flag values
        greeting := fmt.Sprintf("Hello, %s!", *name)
        if *uppercase {
            greeting = fmt.Sprintf("HELLO, %s!", *name)
        }

        for i := 0; i < *count; i++ {
            fmt.Println(greeting)
        }
    }
    ```

=== "The Explanation"

    - **flag.String**: Defines a string flag with default value
    - **flag.Int**: Defines an integer flag
    - **flag.Bool**: Defines a boolean flag
    - **flag.Parse**: Parses command-line arguments
    - **Dereference**: Use `*name` to get the flag value

=== "The Terminal Output"

    ```
    $ go run main.go --name Alice --count 2 --uppercase
    HELLO, ALICE!
    HELLO, ALICE!

    $ go run main.go -help
    Usage: /tmp/main [options]

    A friendly greeting program

    Options:
      -count int
            Number of times to greet (default 1)
      -uppercase
            Convert greeting to uppercase (name string)
            Name to greet (default "World")
    ```

### Positional Arguments

=== "The Code"

    ```go
    package main

    import (
        "flag"
        "fmt"
        "os"
    )

    func main() {
        verbose := flag.Bool("verbose", false, "Enable verbose output")
        flag.Parse()

        // Positional arguments come after flags
        args := flag.Args()

        if len(args) == 0 {
            fmt.Println("No files specified")
            fmt.Println("Usage: program [options] <file1> <file2> ...")
            os.Exit(1)
        }

        if *verbose {
            fmt.Printf("Processing %d files\n", len(args))
        }

        for _, filename := range args {
            fmt.Printf("Processing: %s\n", filename)
        }
    }
    ```

=== "The Explanation"

    - **flag.Args**: Returns remaining non-flag arguments
    - **Positional args**: Arguments after all flags are parsed
    - **os.Exit(1)**: Non-zero exit code indicates error
    - **Usage**: Show usage when required args missing

=== "The Terminal Output"

    ```
    $ go run main.go -verbose file1.txt file2.txt file3.txt
    Processing 3 files
    Processing: file1.txt
    Processing: file2.txt
    Processing: file3.txt

    $ go run main.go
    No files specified
    Usage: program [options] <file1> <file2> ...
    ```

---

## Building CLIs with Cobra

Cobra is the most popular library for building Go CLI applications.

### Installation

```bash
go get github.com/spf13/cobra
```

=== "The Code"

    ```go
    // cmd/root.go
    package cmd

    import (
        "fmt"
        "os"
        "github.com/spf13/cobra"
    )

    var rootCmd = &cobra.Command{
        Use:   "myapp",
        Short: "My awesome CLI application",
        Long: `A longer description that spans multiple lines and likely includes
    examples and usage of using your application.`,
        Run: func(cmd *cobra.Command, args []string) {
            fmt.Println("Welcome to MyApp!")
        },
    }

    func Execute() {
        if err := rootCmd.Execute(); err != nil {
            fmt.Println(err)
            os.Exit(1)
        }
    }

    func init() {
        // Global flags
        rootCmd.PersistentFlags().StringP("config", "c", "", "Config file path")
        rootCmd.PersistentFlags().BoolP("verbose", "v", false, "Verbose output")
    }
    ```

=== "The Code"

    ```go
    // cmd/greet.go
    package cmd

    import (
        "fmt"
        "strings"
        "github.com/spf13/cobra"
    )

    var greetCmd = &cobra.Command{
        Use:   "greet [name]",
        Short: "Greet someone",
        Long:  `Print a greeting message to the specified person.`,
        Args:  cobra.ExactArgs(1),
        Run: func(cmd *cobra.Command, args []string) {
            name := args[0]
            uppercase, _ := cmd.Flags().GetBool("uppercase")
            repeat, _ := cmd.Flags().GetInt("repeat")

            greeting := fmt.Sprintf("Hello, %s!", name)
            if uppercase {
                greeting = strings.ToUpper(greeting)
            }

            for i := 0; i < repeat; i++ {
                fmt.Println(greeting)
            }
        },
    }

    func init() {
        rootCmd.AddCommand(greetCmd)

        greetCmd.Flags().BoolP("uppercase", "u", false, "Uppercase the greeting")
        greetCmd.Flags().IntP("repeat", "r", 1, "Number of times to repeat")
    }
    ```

=== "The Code"

    ```go
    // main.go
    package main

    import "myapp/cmd"

    func main() {
        cmd.Execute()
    }
    ```

=== "The Explanation"

    - **cobra.Command**: Defines a command with usage, description, and handler
    - **PersistentFlags**: Available to all subcommands
    - **LocalFlags**: Only available to the specific command
    - **Args validators**: `cobra.ExactArgs(1)` ensures correct argument count
    - **AddCommand**: Registers subcommands with root command

=== "The Terminal Output"

    ```
    $ go run main.go greet Alice
    Hello, Alice!

    $ go run main.go greet Bob --uppercase --repeat 2
    HELLO, BOB!
    HELLO, BOB!

    $ go run main.go
    Welcome to MyApp!

    $ go run main.go --help
    A longer description that spans multiple lines and likely includes
    examples and usage of using your application.

    Usage:
      myapp [command]

    Available Commands:
      greet       Greet someone
      help        Help about any command

    Flags:
      -c, --config string     Config file path
      -h, --help              help for myapp
      -v, --verbose           Verbose output

    Use "myapp [command] --help" for more information about a command.
    ```

!!! go "Tip"
Cobra auto-generates help text and completions. Use `myapp completion bash` to generate shell completions.

---

## urfave/cli Alternative

urfave/cli is another popular library with a simpler API.

### Installation

```bash
go get github.com/urfave/cli/v2
```

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "os"
        "strings"
        "github.com/urfave/cli/v2"
    )

    func main() {
        app := &cli.App{
            Name:  "myapp",
            Usage: "A simple CLI application",
            Action: func(c *cli.Context) error {
                fmt.Println("Hello from MyApp!")
                return nil
            },
            Commands: []*cli.Command{
                {
                    Name:    "greet",
                    Aliases: []string{"g"},
                    Usage:   "Greet a person",
                    Flags: []cli.Flag{
                        &cli.StringFlag{
                            Name:    "name",
                            Aliases: []string{"n"},
                            Value:   "World",
                            Usage:   "Name of person to greet",
                        },
                        &cli.BoolFlag{
                            Name:    "uppercase",
                            Aliases: []string{"u"},
                            Usage:   "Uppercase the greeting",
                        },
                    },
                    Action: func(c *cli.Context) error {
                        name := c.String("name")
                        greeting := fmt.Sprintf("Hello, %s!", name)

                        if c.Bool("uppercase") {
                            greeting = strings.ToUpper(greeting)
                        }

                        fmt.Println(greeting)
                        return nil
                    },
                },
                {
                    Name:  "version",
                    Usage: "Print version information",
                    Action: func(c *cli.Context) error {
                        fmt.Println("MyApp v1.0.0")
                        return nil
                    },
                },
            },
        }

        if err := app.Run(os.Args); err != nil {
            log.Fatal(err)
        }
    }
    ```

=== "The Explanation"

    - **cli.App**: The main application container
    - **Commands**: Slice of command definitions
    - **Flags**: Typed flags with default values
    - **Aliases**: Alternative names for commands/flags
    - **c.String**: Get string flag value by name

=== "The Terminal Output"

    ```
    $ go run main.go
    Hello from MyApp!

    $ go run main.go greet --name Alice --uppercase
    HELLO, ALICE!

    $ go run main.go greet -n Bob
    Hello, Bob!

    $ go run main.go version
    MyApp v1.0.0
    ```

---

## Input Validation

Validate user input before processing.

=== "The Code"

    ```go
    package main

    import (
        "errors"
        "fmt"
        "os"
        "strconv"
    )

    type Config struct {
        Host string
        Port int
    }

    func validateHost(host string) error {
        if host == "" {
            return errors.New("host cannot be empty")
        }
        if len(host) > 255 {
            return errors.New("host too long (max 255 characters)")
        }
        return nil
    }

    func validatePort(portStr string) (int, error) {
        port, err := strconv.Atoi(portStr)
        if err != nil {
            return 0, fmt.Errorf("invalid port number: %s", portStr)
        }
        if port < 1 || port > 65535 {
            return 0, fmt.Errorf("port must be between 1 and 65535, got %d", port)
        }
        return port, nil
    }

    func parseArgs(args []string) (*Config, error) {
        if len(args) < 2 {
            return nil, errors.New("usage: program <host> <port>")
        }

        host := args[0]
        if err := validateHost(host); err != nil {
            return nil, fmt.Errorf("invalid host: %w", err)
        }

        port, err := validatePort(args[1])
        if err != nil {
            return nil, err
        }

        return &Config{Host: host, Port: port}, nil
    }

    func main() {
        config, err := parseArgs(os.Args[1:])
        if err != nil {
            fmt.Fprintf(os.Stderr, "Error: %v\n", err)
            os.Exit(1)
        }

        fmt.Printf("Connecting to %s:%d\n", config.Host, config.Port)
    }
    ```

=== "The Explanation"

    - **Input validation**: Check all required inputs
    - **Error wrapping**: Use `fmt.Errorf` with `%w` for error chains
    - **Descriptive errors**: Tell users what went wrong
    - **Exit codes**: Non-zero for errors, zero for success

=== "The Terminal Output"

    ```
    $ go run main.go localhost 8080
    Connecting to localhost:8080

    $ go run main.go "" 8080
    Error: invalid host: host cannot be empty

    $ go run main.go localhost abc
    Error: invalid port number: abc

    $ go run main.go localhost 99999
    Error: port must be between 1 and 65535, got 99999

    $ go run main.go
    Error: usage: program <host> <port>
    ```

!!! warning "Always Validate"
Never trust user input. Validate all external data including command-line arguments, file contents, and network data.

---

## Interactive Prompts

Create user-friendly interactive CLI experiences.

=== "The Code"

    ```go
    package main

    import (
        "bufio"
        "fmt"
        "os"
        "strings"
    )

    func promptYesNo(reader *bufio.Reader, message string) bool {
        for {
            fmt.Printf("%s (y/n): ", message)
            response, _ := reader.ReadString('\n')
            response = strings.TrimSpace(strings.ToLower(response))

            switch response {
            case "y", "yes":
                return true
            case "n", "no":
                return false
            default:
                fmt.Println("Please enter 'y' or 'n'")
            }
        }
    }

    func promptString(reader *bufio.Reader, message, defaultValue string) string {
        fmt.Printf("%s [%s]: ", message, defaultValue)
        response, _ := reader.ReadString('\n')
        response = strings.TrimSpace(response)

        if response == "" {
            return defaultValue
        }
        return response
    }

    func promptInt(reader *bufio.Reader, message string, defaultVal int) int {
        for {
            fmt.Printf("%s [%d]: ", message, defaultVal)
            response, _ := reader.ReadString('\n')
            response = strings.TrimSpace(response)

            if response == "" {
                return defaultVal
            }

            var val int
            _, err := fmt.Sscanf(response, "%d", &val)
            if err != nil {
                fmt.Println("Please enter a valid number")
                continue
            }
            return val
        }
    }

    func main() {
        reader := bufio.NewReader(os.Stdin)

        fmt.Println("=== Setup Wizard ===")
        fmt.Println()

        host := promptString(reader, "Server host", "localhost")
        port := promptInt(reader, "Server port", 8080)
        useSSL := promptYesNo(reader, "Enable SSL?")

        fmt.Println("\n=== Configuration ===")
        fmt.Printf("Host: %s\n", host)
        fmt.Printf("Port: %d\n", port)
        fmt.Printf("SSL: %v\n", useSSL)
    }
    ```

=== "The Explanation"

    - **bufio.Reader**: Reads user input line by line
    - **strings.TrimSpace**: Removes whitespace from input
    - **Default values**: Provide sensible defaults
    - **Input validation**: Loop until valid input received
    - **Reusable functions**: Create helper functions for prompts

=== "The Terminal Output"

    ```
    === Setup Wizard ===

    Server host [localhost]: myserver.com
    Server port [8080]: 3000
    Enable SSL? (y/n): y

    === Configuration ===
    Host: myserver.com
    Port: 3000
    SSL: true
    ```

---

## Exit Codes

Use proper exit codes to indicate success or failure.

=== "The Code"

    ```go
    package main

    import (
        "errors"
        "fmt"
        "os"
    )

    const (
        ExitSuccess = 0
        ExitError   = 1
        ExitUsage   = 2
    )

    var (
        ErrInvalidArgs = errors.New("invalid arguments")
        ErrFileNotFound = errors.New("file not found")
        ErrPermission = errors.New("permission denied")
    )

    func processFile(filename string) error {
        _, err := os.Stat(filename)
        if os.IsNotExist(err) {
            return ErrFileNotFound
        }
        if os.IsPermission(err) {
            return ErrPermission
        }

        fmt.Printf("Processing %s\n", filename)
        return nil
    }

    func main() {
        if len(os.Args) < 2 {
            fmt.Fprintf(os.Stderr, "Usage: %s <filename>\n", os.Args[0])
            os.Exit(ExitUsage)
        }

        filename := os.Args[1]
        err := processFile(filename)

        if err != nil {
            switch {
            case errors.Is(err, ErrFileNotFound):
                fmt.Fprintf(os.Stderr, "Error: File not found: %s\n", filename)
                os.Exit(ExitError)
            case errors.Is(err, ErrPermission):
                fmt.Fprintf(os.Stderr, "Error: Permission denied: %s\n", filename)
                os.Exit(ExitError)
            default:
                fmt.Fprintf(os.Stderr, "Error: %v\n", err)
                os.Exit(ExitError)
            }
        }

        fmt.Println("Success!")
        os.Exit(ExitSuccess)
    }
    ```

=== "The Explanation"

    - **Exit codes**: 0=success, 1=error, 2=usage error
    - **Named constants**: Make exit codes readable
    - **Error types**: Differentiate error types
    - **os.Stderr**: Error messages go to stderr
    - **switch on error**: Handle different error types

=== "The Terminal Output"

    ```
    $ go run main.go existingfile.txt
    Processing existingfile.txt
    Success!

    $ go run main.go nonexistent.txt
    Error: File not found: nonexistent.txt

    $ go run main.go
    Usage: main <filename>
    ```

!!! go "Unix Convention"
Exit code 0 means success. Non-zero codes indicate different error types. Scripts and tools rely on these codes for automation.

---

## Cross-Compilation

Build Go binaries for multiple platforms.

### Basic Cross-Compilation

```bash
# Linux (AMD64)
GOOS=linux GOARCH=amd64 go build -o myapp-linux-amd64

# Windows (AMD64)
GOOS=windows GOARCH=amd64 go build -o myapp-windows-amd64.exe

# macOS (ARM64)
GOOS=darwin GOARCH=arm64 go build -o myapp-darwin-arm64

# Raspberry Pi
GOOS=linux GOARCH=arm GOARM=7 go build -o myapp-rpi
```

=== "The Code"

    ```go
    // build.go - Build script
    package main

    import (
        "fmt"
        "os"
        "os/exec"
    )

    type Platform struct {
        OS   string
        Arch string
        Ext  string
    }

    var platforms = []Platform{
        {"linux", "amd64", ""},
        {"linux", "arm64", ""},
        {"windows", "amd64", ".exe"},
        {"darwin", "amd64", ""},
        {"darwin", "arm64", ""},
    }

    func build(platform Platform) error {
        output := fmt.Sprintf("dist/myapp-%s-%s%s",
            platform.OS, platform.Arch, platform.Ext)

        fmt.Printf("Building for %s/%s... ", platform.OS, platform.Arch)

        cmd := exec.Command("go", "build", "-o", output, ".")
        cmd.Env = append(os.Environ(),
            "GOOS="+platform.OS,
            "GOARCH="+platform.Arch,
        )
        cmd.Stdout = os.Stdout
        cmd.Stderr = os.Stderr

        if err := cmd.Run(); err != nil {
            fmt.Println("FAILED")
            return err
        }

        fmt.Println("OK")
        return nil
    }

    func main() {
        os.MkdirAll("dist", 0755)

        for _, platform := range platforms {
            if err := build(platform); err != nil {
                fmt.Printf("Error building for %s/%s: %v\n",
                    platform.OS, platform.Arch, err)
            }
        }

        fmt.Println("\nBuild complete! Check the dist/ directory.")
    }
    ```

=== "The Explanation"

    - **GOOS**: Target operating system
    - **GOARCH**: Target architecture
    - **Cross compilation**: Build for any platform from any platform
    - **Static binaries**: No external dependencies needed
    - **Build script**: Automate multi-platform builds

=== "The Terminal Output"

    ```
    $ go run build.go
    Building for linux/amd64... OK
    Building for linux/arm64... OK
    Building for windows/amd64... OK
    Building for darwin/amd64... OK
    Building for darwin/arm64... OK

    Build complete! Check the dist/ directory.
    ```

!!! abstract "Supported Platforms"
Go supports many platforms including: linux, darwin (macOS), windows, freebsd, openbsd, netbsd, plan9, and more. Use `go tool dist list` to see all supported combinations.

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Use standard patterns | Follow Unix CLI conventions |
| Provide help text | Include usage examples and descriptions |
| Validate input | Check all arguments before processing |
| Use exit codes | Return meaningful exit codes |
| Support --help | Automatically generate help output |
| Handle errors gracefully | Show user-friendly error messages |
| Use flags over positional args | Prefer named flags for clarity |
| Keep output clean | Separate stdout (data) from stderr (errors) |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Command not found | Check PATH and binary permissions |
| Flag parsing fails | Ensure flags come before positional arguments |
| Cross-compilation fails | Check target platform is supported |
| Permission denied | Use chmod to make binary executable |
| Interactive input hangs | Check for stdin/stdout buffering issues |

## Summary

- `os.Args` provides raw command-line arguments
- `flag` package offers built-in argument parsing
- Cobra is the industry standard for complex CLIs
- urfave/cli provides a simpler alternative
- Always validate user input
- Use proper exit codes (0=success, non-zero=error)
- Go enables easy cross-compilation
- Create help text and usage examples

## Next Steps

- [Testing](testing.md) - Write tests for your CLI tools
- [File & IO](file-io.md) - Process files in CLI applications
- [JSON & Encoding](json-encoding.md) - Handle structured data
- [HTTP Clients](http-clients.md) - Make API calls from CLI tools