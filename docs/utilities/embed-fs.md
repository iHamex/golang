# Embed & FS

Go 1.16 introduced the `embed` package, which allows embedding files and directories directly into Go binaries. This eliminates the need for external asset management tools and simplifies deployment.

## What You Will Learn

- Embed files with the `go:embed` directive
- Use `embed.FS`, `embed.String`, and `embed.Byte`
- Serve embedded files in HTTP servers
- Embed and render templates
- Embed configuration files
- Test with embedded files
- Migrate from older tools like bindata

## Prerequisites

- Basic Go syntax and data types
- Understanding of file operations
- Familiarity with HTTP servers

---

## Basic Embedding

The `go:embed` directive embeds files at compile time into your binary.

=== "The Code"

    ```go
    package main

    import (
        "embed"
        "fmt"
    )

    //go:embed hello.txt
    var s string

    //go:embed hello.txt
    var b []byte

    //go:embed hello.txt
    var f embed.FS

    func main() {
        // Embedded as string
        fmt.Println("String:", s)

        // Embedded as byte slice
        fmt.Println("Bytes:", string(b))

        // Embedded as filesystem
        data, err := f.ReadFile("hello.txt")
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        fmt.Println("From FS:", string(data))
    }
    ```

=== "The Explanation"

    - **embed.String**: Embeds file content as a string
    - **embed.Byte**: Embeds file content as a byte slice
    - **embed.FS**: Embeds file as a filesystem
    - **//go:embed**: Directive that specifies which files to embed

=== "The Terminal Output"

    ```
    String: Hello, World!
    Bytes: Hello, World!
    From FS: Hello, World!
    ```

!!! go "File Location"
Embedded files must be in the same directory or a subdirectory of the Go source file containing the `//go:embed` directive.

## Embedding Directories

You can embed entire directories with their structure.

=== "The Code"

    ```go
    package main

    import (
        "embed"
        "fmt"
        "path/filepath"
    )

    //go:embed templates/*
    var templateFS embed.FS

    //go:embed static
    var staticFS embed.FS

    func main() {
        // List files in templates directory
        entries, err := templateFS.ReadDir("templates")
        if err != nil {
            fmt.Println("Error reading dir:", err)
            return
        }

        fmt.Println("Templates directory:")
        for _, entry := range entries {
            if !entry.IsDir() {
                fmt.Printf("  %s\n", entry.Name())
            }
        }

        // Read specific file
        data, err := templateFS.ReadFile("templates/index.html")
        if err != nil {
            fmt.Println("Error reading file:", err)
            return
        }
        fmt.Println("\nIndex template:")
        fmt.Println(string(data))

        // Walk through static directory
        fmt.Println("\nStatic directory:")
        err = staticFS.Walk("static", func(path string, info embed.DirEntry, err error) error {
            if err != nil {
                return err
            }
            if !info.IsDir() {
                fmt.Printf("  %s (%d bytes)\n", path, 0)
            }
            return nil
        })
        if err != nil {
            fmt.Println("Error walking:", err)
        }
    }
    ```

=== "The Explanation"

    - **embed.FS.ReadDir**: Lists directory contents
    - **embed.FS.ReadFile**: Reads specific file
    - **embed.FS.Walk**: Walks directory tree
    - **Pattern matching**: Use `*` for all files, `*.ext` for specific types

=== "The Terminal Output"

    ```
    Templates directory:
      index.html
      layout.html

    Index template:
    <!DOCTYPE html>
    <html>
    <head><title>{{.Title}}</title></head>
    <body><h1>Hello, {{.Name}}!</h1></body>
    </html>

    Static directory:
      static/css/style.css (0 bytes)
      static/js/app.js (0 bytes)
      static/images/logo.png (0 bytes)
    ```

## Pattern Matching

Go's embed supports various pattern matching for selective embedding.

=== "The Code"

    ```go
    package main

    import (
        "embed"
        "fmt"
    )

    //go:embed *.md
    var markdownFiles embed.FS

    //go:embed config/*.yaml
    var yamlConfigs embed.FS

    //go:embed assets/images/*
    var images embed.FS

    //go:embed all:text
    var allText embed.FS

    //go:embed !(*.test.go)
    var nonTestFiles embed.FS

    func main() {
        // List markdown files
        entries, _ := markdownFiles.ReadDir(".")
        fmt.Println("Markdown files:")
        for _, entry := range entries {
            if !entry.IsDir() {
                fmt.Printf("  %s\n", entry.Name())
            }
        }

        // List yaml configs
        entries, _ = yamlConfigs.ReadDir("config")
        fmt.Println("\nYAML configs:")
        for _, entry := range entries {
            fmt.Printf("  config/%s\n", entry.Name())
        }

        // List images
        entries, _ = images.ReadDir("assets/images")
        fmt.Println("\nImages:")
        for _, entry := range entries {
            fmt.Printf("  assets/images/%s\n", entry.Name())
        }
    }
    ```

=== "The Explanation"

    - **\*.md**: All markdown files in current directory
    - **config/*.yaml**: All YAML files in config directory
    - **assets/images/***: All files in images directory
    - **all:text**: Embed all files with .text extension
    - **!(\*.test.go)**: Exclude test files

=== "The Terminal Output"

    ```
    Markdown files:
      README.md
      CHANGELOG.md

    YAML configs:
      config/app.yaml
      config/database.yaml

    Images:
      assets/images/logo.png
      assets/images/icon.png
    ```

## Serving Embedded Files

Embed files are commonly used to serve static assets in web servers.

=== "The Code"

    ```go
    package main

    import (
        "embed"
        "fmt"
        "io/fs"
        "log"
        "net/http"
    )

    //go:embed static
    var staticFiles embed.FS

    //go:embed templates
    var templateFiles embed.FS

    func main() {
        // Create sub-filesystem for static files
        staticFS, err := fs.Sub(staticFiles, "static")
        if err != nil {
            log.Fatal(err)
        }

        // Serve static files
        http.Handle("/static/", http.StripPrefix("/static/",
            http.FileServer(http.FS(staticFS))))

        // Serve embedded template
        http.HandleFunc("/template", func(w http.ResponseWriter, r *http.Request) {
            data, err := templateFiles.ReadFile("templates/index.html")
            if err != nil {
                http.Error(w, "Template not found", http.StatusNotFound)
                return
            }
            w.Header().Set("Content-Type", "text/html")
            w.Write(data)
        })

        // API endpoint
        http.HandleFunc("/api/info", func(w http.ResponseWriter, r *http.Request) {
            info := map[string]string{
                "version": "1.0.0",
                "embed":   "true",
            }
            w.Header().Set("Content-Type", "application/json")
            fmt.Fprintf(w, `{"version":"%s","embed":"%s"}`, info["version"], info["embed"])
        })

        fmt.Println("Server starting on :8080")
        fmt.Println("Visit http://localhost:8080/static/")
        log.Fatal(http.ListenAndServe(":8080", nil))
    }
    ```

=== "The Explanation"

    - **fs.Sub**: Creates a sub-filesystem
    - **http.FileServer**: Serves files from filesystem
    - **http.StripPrefix**: Removes URL prefix
    - **embed.FS as http.FileSystem**: Works with standard library

=== "The Terminal Output"

    ```
    Server starting on :8080
    Visit http://localhost:8080/static/
    # When accessing /static/index.html, serves embedded file
    # When accessing /template, serves embedded template
    ```

## Embedding Templates

Go templates can be embedded and rendered at runtime.

=== "The Code"

    ```go
    package main

    import (
        "embed"
        "fmt"
        "html/template"
        "log"
        "net/http"
    )

    //go:embed templates/*.html
    var templateFS embed.FS

    type PageData struct {
        Title   string
        Content string
        Items   []string
    }

    func main() {
        // Parse embedded templates
        tmpl, err := template.ParseFS(templateFS, "templates/*.html")
        if err != nil {
            log.Fatal(err)
        }

        http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            data := PageData{
                Title:   "Embedded Templates",
                Content: "This page uses embedded templates!",
                Items:   []string{"Item 1", "Item 2", "Item 3"},
            }

            err := tmpl.ExecuteTemplate(w, "layout.html", data)
            if err != nil {
                http.Error(w, err.Error(), http.StatusInternalServerError)
                return
            }
        })

        fmt.Println("Server starting on :8080")
        log.Fatal(http.ListenAndServe(":8080", nil))
    }
    ```

=== "The Explanation"

    - **template.ParseFS**: Parses templates from embedded filesystem
    - **ExecuteTemplate**: Renders template with data
    - **Template caching**: Templates parsed once at startup
    - **Type-safe data**: Use structs for template data

=== "The Terminal Output"

    ```
    Server starting on :8080
    # When accessing http://localhost:8080/
    # Renders layout.html with PageData
    ```

## Embedding Configuration

Configuration files can be embedded with sensible defaults.

=== "The Code"

    ```go
    package main

    import (
        "embed"
        "encoding/json"
        "fmt"
        "os"
    )

    //go:embed config/default.json
    var defaultConfig embed.FS

    type Config struct {
        Server   ServerConfig   `json:"server"`
        Database DatabaseConfig `json:"database"`
        Log      LogConfig      `json:"log"`
    }

    type ServerConfig struct {
        Host string `json:"host"`
        Port int    `json:"port"`
    }

    type DatabaseConfig struct {
        Driver string `json:"driver"`
        DSN    string `json:"dsn"`
    }

    type LogConfig struct {
        Level string `json:"level"`
        File  string `json:"file"`
    }

    // LoadConfig loads configuration from file or embedded defaults
    func LoadConfig(path string) (*Config, error) {
        var data []byte
        var err error

        // Try to load from file first
        data, err = os.ReadFile(path)
        if err != nil {
            fmt.Printf("Config file not found, using defaults\n")

            // Fall back to embedded default
            data, err = defaultConfig.ReadFile("config/default.json")
            if err != nil {
                return nil, fmt.Errorf("failed to read default config: %w", err)
            }
        }

        var config Config
        if err := json.Unmarshal(data, &config); err != nil {
            return nil, fmt.Errorf("failed to parse config: %w", err)
        }

        return &config, nil
    }

    func main() {
        config, err := LoadConfig("config.json")
        if err != nil {
            fmt.Println("Error:", err)
            return
        }

        fmt.Printf("Server: %s:%d\n", config.Server.Host, config.Server.Port)
        fmt.Printf("Database: %s\n", config.Database.Driver)
        fmt.Printf("Log level: %s\n", config.Log.Level)
    }
    ```

=== "The Explanation"

    - **Default configuration**: Embedded fallback
    - **File override**: External file takes precedence
    - **Graceful degradation**: Works without external files
    - **Type-safe parsing**: JSON unmarshaling to structs

=== "The Terminal Output"

    ```
    Config file not found, using defaults
    Server: localhost:8080
    Database: sqlite3
    Log level: info
    ```

## Testing with Embedded Files

Embedded files simplify testing by providing test fixtures.

=== "The Code"

    ```go
    package main

    import (
        "embed"
        "testing"
    )

    //go:embed testdata/*
    var testFiles embed.FS

    func TestEmbeddedFile(t *testing.T) {
        // Read test fixture
        data, err := testFiles.ReadFile("testdata/input.txt")
        if err != nil {
            t.Fatalf("Failed to read test file: %v", err)
        }

        // Verify content
        expected := "test input data"
        if string(data) != expected {
            t.Errorf("Expected %q, got %q", expected, string(data))
        }
    }

    func TestMultipleFiles(t *testing.T) {
        // List test files
        entries, err := testFiles.ReadDir("testdata")
        if err != nil {
            t.Fatalf("Failed to read dir: %v", err)
        }

        // Process each test file
        for _, entry := range entries {
            if entry.IsDir() {
                continue
            }

            t.Run(entry.Name(), func(t *testing.T) {
                data, err := testFiles.ReadFile("testdata/" + entry.Name())
                if err != nil {
                    t.Fatalf("Failed to read %s: %v", entry.Name(), err)
                }

                if len(data) == 0 {
                    t.Errorf("File %s is empty", entry.Name())
                }
            })
        }
    }

    func main() {
        // This file is for demonstration only
        // Run tests with: go test -v
    }
    ```

=== "The Explanation"

    - **testdata directory**: Special directory for test fixtures
    - **Embedded test data**: No external file dependencies
    - **Table-driven tests**: Use embedded files for test cases
    - **CI/CD friendly**: Tests work without external files

=== "The Terminal Output"

    ```
    === RUN   TestEmbeddedFile
    --- PASS: TestEmbeddedFile (0.00s)
    === RUN   TestMultipleFiles
    === RUN   TestMultipleFiles/input.txt
    --- PASS: TestMultipleFiles/input.txt (0.00s)
    === RUN   TestMultipleFiles/expected.txt
    --- PASS: TestMultipleFiles/expected.txt (0.00s)
    --- PASS: TestMultipleFiles (0.00s)
    PASS
    ok  	example	0.001s
    ```

## Migration from bindata

Migrating from older tools like go-bindata to embed is straightforward.

=== "The Code"

    ```go
    package main

    import (
        "embed"
        "fmt"
        "io/fs"
        "log"
        "net/http"
    )

    // Old way (deprecated):
    // import _ "your/package/bindata"
    // data, _ := Asset("static/file.js")

    // New way with embed:
    //go:embed static
    var staticFiles embed.FS

    func main() {
        // Create sub-filesystem
        staticFS, err := fs.Sub(staticFiles, "static")
        if err != nil {
            log.Fatal(err)
        }

        // Serve files
        http.Handle("/", http.FileServer(http.FS(staticFS)))

        fmt.Println("Server starting on :8080")
        log.Fatal(http.ListenAndServe(":8080", nil))
    }

    // Migration checklist:
    // 1. Replace //go:generate bindata with //go:embed
    // 2. Replace Asset() with ReadFile()
    // 3. Replace AssetDir() with ReadDir()
    // 4. Replace AssetNames() with Walk() or ReadDir()
    // 5. Remove bindata.go generated file
    // 6. Update import statements
    ```

=== "The Explanation"

    - **No code generation**: embed works at compile time
    - **Standard library**: No external dependencies
    - **Better performance**: No reflection
    - **Simpler workflow**: No build steps

=== "The Terminal Output"

    ```
    Server starting on :8080
    # Static files served from embedded filesystem
    ```

## Best Practices

| Practice | Recommendation |
|----------|----------------|
| File size | Keep embedded files small |
| Directory structure | Organize files logically |
| Patterns | Use specific patterns to avoid embedding unnecessary files |
| Testing | Embed test fixtures in testdata |
| Configuration | Provide embedded defaults |
| Templates | Parse templates once at startup |

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| File not found | Wrong path in directive | Check file path relative to source |
| Build error | Pattern matches no files | Ensure pattern matches at least one file |
| Memory usage | Embedding large files | Only embed necessary files |
| Permission error | File not readable | Check file permissions |

## Summary

- `//go:embed` embeds files at compile time
- `embed.FS` provides filesystem interface
- `embed.String` and `embed.Byte` for simple content
- Patterns support wildcards and exclusions
- Use `fs.Sub` for sub-filesystems
- Embedded files simplify deployment
- No external tools needed (replaces bindata)

## Next Steps

- Learn about [Hashing & Crypto](hashing-crypto.md)
- Explore [String Processing](string-processing.md)
- Understand [Time & Dates](time-dates.md)
- Discover [Regular Expressions](regular-expressions.md)
