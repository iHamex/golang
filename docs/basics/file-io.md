# File & IO

File operations are fundamental to most applications, whether reading configuration files, processing data, or writing logs. Go provides a rich set of tools through the `os`, `io`, `bufio`, and `filepath` packages for efficient file handling and I/O operations.

---

## What You Will Learn

- Opening, creating, and removing files with the `os` package
- Using `io.Reader` and `io.Writer` interfaces for flexible I/O
- Copying data efficiently with `io.Copy`
- Improving performance with buffered I/O using the `bufio` package
- Working with file paths using the `filepath` package
- Managing temporary files and directories
- Understanding file permissions
- Embedding files at compile time with `go:embed`
- Creating custom I/O pipelines with `io.Pipe`

---

## Prerequisites

- Basic understanding of Go functions and error handling
- Familiarity with interfaces
- Knowledge of basic file system concepts

---

## Opening and Reading Files

The `os` package provides low-level file operations.

### Basic File Reading

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
    )

    func main() {
        file, err := os.Open("data.txt")
        if err != nil {
            fmt.Println("Error opening file:", err)
            return
        }
        defer file.Close()

        // Read all content
        content := make([]byte, 1024)
        n, err := file.Read(content)
        if err != nil {
            fmt.Println("Error reading:", err)
            return
        }

        fmt.Printf("Read %d bytes:\n%s\n", n, string(content[:n]))
    }
    ```

=== "The Explanation"

    - **os.Open**: Opens a file for reading (read-only)
    - **file.Close**: Closes the file to release resources
    - **file.Read**: Reads bytes into a buffer
    - **n**: Number of bytes actually read

=== "The Terminal Output"

    ```
    Read 27 bytes:
    Hello, World!
    This is a test file.
    ```

### Reading Entire File

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
    )

    func main() {
        // os.ReadFile reads entire file at once
        content, err := os.ReadFile("config.json")
        if err != nil {
            fmt.Println("Error reading file:", err)
            return
        }

        fmt.Printf("File size: %d bytes\n", len(content))
        fmt.Printf("Content:\n%s\n", string(content))
    }
    ```

=== "The Explanation"

    - **os.ReadFile**: Convenience function that opens, reads, and closes a file
    - **Returns byte slice**: Contains the entire file content
    - **Simple API**: No need to manage file closing manually
    - **Memory consideration**: Loads entire file into memory

=== "The Terminal Output"

    ```
    File size: 52 bytes
    Content:
    {
      "host": "localhost",
      "port": 8080
    }
    ```

!!! go "Tip"
Use `os.ReadFile` for small to medium files. For large files, use streaming with `bufio.Scanner` or `io.Reader`.

---

## Creating and Writing Files

Create new files or overwrite existing ones.

### Basic File Writing

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
    )

    func main() {
        // Create or truncate file
        file, err := os.Create("output.txt")
        if err != nil {
            fmt.Println("Error creating file:", err)
            return
        }
        defer file.Close()

        // Write data
        data := []byte("Hello, File I/O!\nThis line was written by Go.\n")
        n, err := file.Write(data)
        if err != nil {
            fmt.Println("Error writing:", err)
            return
        }

        fmt.Printf("Wrote %d bytes to file\n", n)
    }
    ```

=== "The Explanation"

    - **os.Create**: Creates a new file or truncates existing
    - **file.Write**: Writes byte slice to file
    - **0644 permissions**: Default permission (owner read/write, others read)
    - **defer close**: Ensures file is properly closed

=== "The Terminal Output"

    ```
    Wrote 47 bytes to file
    ```

### Appending to Files

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
    )

    func main() {
        // Open file for appending
        file, err := os.OpenFile("log.txt", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
        if err != nil {
            fmt.Println("Error opening file:", err)
            return
        }
        defer file.Close()

        // Write multiple lines
        lines := []string{
            "2024-01-01 10:00:00 - Server started",
            "2024-01-01 10:05:00 - Connection from 192.168.1.1",
            "2024-01-01 10:10:00 - Request processed",
        }

        for _, line := range lines {
            _, err := file.WriteString(line + "\n")
            if err != nil {
                fmt.Println("Error writing:", err)
                return
            }
        }

        fmt.Println("Lines appended to log.txt")
    }
    ```

=== "The Explanation"

    - **os.O_APPEND**: Appends to end of file
    - **os.O_CREATE**: Creates file if it doesn't exist
    - **os.O_WRONLY**: Opens file for writing only
    - **file.WriteString**: Convenience method for writing strings

=== "The Terminal Output"

    ```
    Lines appended to log.txt
    ```

!!! note "File Flags"
Combine flags with bitwise OR (`|`) to set multiple modes. Common flags: `O_RDONLY`, `O_WRONLY`, `O_RDWR`, `O_APPEND`, `O_CREATE`, `O_TRUNC`.

---

## Working with io.Reader and io.Writer

Go's I/O operations are built on two core interfaces.

### Copying Data with io.Copy

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "io"
        "os"
    )

    func main() {
        // Copy file content
        srcFile, err := os.Open("source.txt")
        if err != nil {
            fmt.Println("Error opening source:", err)
            return
        }
        defer srcFile.Close()

        dstFile, err := os.Create("destination.txt")
        if err != nil {
            fmt.Println("Error creating destination:", err)
            return
        }
        defer dstFile.Close()

        bytesCopied, err := io.Copy(dstFile, srcFile)
        if err != nil {
            fmt.Println("Error copying:", err)
            return
        }

        fmt.Printf("Copied %d bytes\n", bytesCopied)
    }
    ```

=== "The Explanation"

    - **io.Copy**: Efficiently copies from reader to writer
    - **Buffer management**: Uses internal buffer for optimal performance
    - **Interface-based**: Works with any `io.Reader` and `io.Writer`
    - **Returns bytes copied**: Total bytes transferred

=== "The Terminal Output"

    ```
    Copied 1024 bytes
    ```

### io.CopyN for Partial Copies

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "io"
        "os"
    )

    func main() {
        srcFile, err := os.Open("largefile.bin")
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        defer srcFile.Close()

        dstFile, err := os.Create("chunk.bin")
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        defer dstFile.Close()

        // Copy only first 100 bytes
        bytesCopied, err := io.CopyN(dstFile, srcFile, 100)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }

        fmt.Printf("Copied first %d bytes\n", bytesCopied)
    }
    ```

=== "The Explanation"

    - **io.CopyN**: Copies exactly N bytes from reader to writer
    - **Partial transfer**: Useful for extracting file headers or chunks
    - **io.EOF**: Returned when fewer bytes available than requested
    - **Use cases**: File splitting, header extraction, streaming

=== "The Terminal Output"

    ```
    Copied first 100 bytes
    ```

---

## Buffered I/O

The `bufio` package improves performance for frequent small reads/writes.

### Buffered Reading

=== "The Code"

    ```go
    package main

    import (
        "bufio"
        "fmt"
        "os"
    )

    func main() {
        file, err := os.Open("data.txt")
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        defer file.Close()

        scanner := bufio.NewScanner(file)

        lineNum := 1
        for scanner.Scan() {
            line := scanner.Text()
            fmt.Printf("%3d: %s\n", lineNum, line)
            lineNum++
        }

        if err := scanner.Err(); err != nil {
            fmt.Println("Error scanning:", err)
        }
    }
    ```

=== "The Explanation"

    - **bufio.NewScanner**: Creates a buffered scanner for reading lines
    - **scanner.Scan**: Advances to next line
    - **scanner.Text**: Returns the current line as a string
    - **scanner.Err**: Checks for errors during scanning

=== "The Terminal Output"

    ```
      1: First line of the file
      2: Second line here
      3: Third and final line
    ```

### Buffered Writing

=== "The Code"

    ```go
    package main

    import (
        "bufio"
        "fmt"
        "os"
    )

    func main() {
        file, err := os.Create("buffered.txt")
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        defer file.Close()

        writer := bufio.NewWriter(file)
        defer writer.Flush()

        // Write multiple items without flushing each time
        for i := 1; i <= 5; i++ {
            _, err := fmt.Fprintf(writer, "Line %d: Some data here\n", i)
            if err != nil {
                fmt.Println("Error writing:", err)
                return
            }
        }

        fmt.Println("Data written to buffer")
        fmt.Println("Flushing buffer to disk...")
    }
    ```

=== "The Explanation"

    - **bufio.NewWriter**: Creates a buffered writer
    - **writer.Flush**: Writes buffer contents to underlying writer
    - **defer flush**: Ensures all buffered data is written
    - **Performance**: Reduces system calls for small writes

=== "The Terminal Output"

    ```
    Data written to buffer
    Flushing buffer to disk...
    ```

!!! go "Performance Tip"
Buffered I/O is especially beneficial for network operations and many small file writes. The default buffer size is 4096 bytes.

### Custom Buffer Size

=== "The Code"

    ```go
    package main

    import (
        "bufio"
        "fmt"
        "os"
    )

    func main() {
        file, err := os.Open("largefile.txt")
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        defer file.Close()

        // Custom buffer size: 8KB
        scanner := bufio.NewScanner(file)
        scanner.Buffer(make([]byte, 0, 8*1024), 8*1024)

        lineCount := 0
        for scanner.Scan() {
            line := scanner.Text()
            lineCount++

            if lineCount <= 3 {
                fmt.Printf("Line %d: %s\n", lineCount, line[:min(50, len(line))])
            }
        }

        fmt.Printf("\nTotal lines: %d\n", lineCount)
    }

    func min(a, b int) int {
        if a < b {
            return a
        }
        return b
    }
    ```

=== "The Explanation"

    - **scanner.Buffer**: Sets custom buffer size for scanner
    - **Max token size**: Second parameter is maximum line length
    - **Default**: 64KB max token size
    - **Large files**: Increase buffer for long lines

=== "The Terminal Output"

    ```
    Line 1: This is the first very long line of the file
    Line 2: Second line with different content here
    Line 3: Another line with more data to process

    Total lines: 1500
    ```

---

## Working with File Paths

The `filepath` package provides cross-platform file path operations.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "path/filepath"
    )

    func main() {
        path := "/home/user/documents/report.pdf"

        // Base name
        fmt.Println("Base:", filepath.Base(path))

        // Directory
        fmt.Println("Dir:", filepath.Dir(path))

        // Extension
        fmt.Println("Ext:", filepath.Ext(path))

        // Join paths
        joined := filepath.Join("/home", "user", "documents", "file.txt")
        fmt.Println("Joined:", joined)

        // Clean path
        messy := "/home/user/../user/./documents/file.txt"
        fmt.Println("Cleaned:", filepath.Clean(messy))

        // Split into directory and file
        dir, file := filepath.Split(path)
        fmt.Printf("Split: dir=%s, file=%s\n", dir, file)

        // Absolute path
        abs, _ := filepath.Abs("relative/path.txt")
        fmt.Println("Absolute:", abs)

        // Rel path
        rel, _ := filepath.Rel("/home/user", "/home/user/documents/file.txt")
        fmt.Println("Relative:", rel)
    }
    ```

=== "The Explanation"

    - **filepath.Base**: Returns the last element of the path
    - **filepath.Dir**: Returns all but the last element
    - **filepath.Ext**: Returns the file extension
    - **filepath.Join**: Joins path elements with OS separator
    - **filepath.Clean**: Cleans and normalizes paths

=== "The Terminal Output"

    ```
    Base: report.pdf
    Dir: /home/user/documents
    Ext: .pdf
    Joined: /home/user/documents/file.txt
    Cleaned: /home/user/documents/file.txt
    Split: dir=/home/user/documents/, file=report.pdf
    Absolute: /Users/hamed/relative/path.txt
    Relative: documents/file.txt
    ```

### Walking Directory Trees

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
        "path/filepath"
    )

    func main() {
        root := "."

        fmt.Printf("Walking directory tree from: %s\n\n", root)

        err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
            if err != nil {
                return err
            }

            indent := ""
            for i := 0; i < len(path)-len(root); i++ {
                if path[i] == '/' {
                    indent += "  "
                }
            }

            if info.IsDir() {
                fmt.Printf("%s[DIR]  %s/\n", indent, info.Name())
            } else {
                fmt.Printf("%s[FILE] %s (%d bytes)\n", indent, info.Name(), info.Size())
            }

            return nil
        })

        if err != nil {
            fmt.Println("Error walking:", err)
        }
    }
    ```

=== "The Explanation"

    - **filepath.Walk**: Recursively traverses directory tree
    - **WalkFunc**: Called for each file/directory
    - **info.IsDir**: Distinguishes files from directories
    - **Error handling**: Return error to stop walking

=== "The Terminal Output"

    ```
    Walking directory tree from: .

    [DIR]  ./
      [FILE] main.go (1234 bytes)
      [DIR]  docs/
        [FILE] readme.md (567 bytes)
        [DIR]  images/
          [FILE] logo.png (8901 bytes)
    ```

---

## Temporary Files and Directories

Work with temporary files using `os.CreateTemp` and `os.MkdirTemp`.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
    )

    func main() {
        // Create temporary file
        tmpFile, err := os.CreateTemp("", "myapp-*.log")
        if err != nil {
            fmt.Println("Error creating temp file:", err)
            return
        }
        defer os.Remove(tmpFile.Name())
        defer tmpFile.Close()

        fmt.Printf("Temp file: %s\n", tmpFile.Name())

        // Write to temp file
        tmpFile.WriteString("Temporary data here\n")
        tmpFile.WriteString("More temporary data\n")

        // Create temporary directory
        tmpDir, err := os.MkdirTemp("", "myapp-*")
        if err != nil {
            fmt.Println("Error creating temp dir:", err)
            return
        }
        defer os.RemoveAll(tmpDir)

        fmt.Printf("Temp dir: %s\n", tmpDir)

        // Create files in temp directory
        for i := 0; i < 3; i++ {
            filePath := tmpDir + fmt.Sprintf("/file%d.txt", i)
            os.WriteFile(filePath, []byte(fmt.Sprintf("Content %d", i)), 0644)
        }

        // List temp directory contents
        entries, _ := os.ReadDir(tmpDir)
        fmt.Printf("Files in temp dir: %d\n", len(entries))
    }
    ```

=== "The Explanation"

    - **os.CreateTemp**: Creates a temporary file with unique name
    - **os.MkdirTemp**: Creates a temporary directory
    - **Pattern `*`**: Asterisk is replaced with unique identifier
    - **Cleanup**: Always remove temp files when done
    - **os.RemoveAll**: Recursively removes directory and contents

=== "The Terminal Output"

    ```
    Temp file: /tmp/myapp-12345678.log
    Temp dir: /tmp/myapp-87654321
    Files in temp dir: 3
    ```

!!! warning "Cleanup"
Always clean up temporary files and directories. Use `defer os.Remove()` or `defer os.RemoveAll()` to ensure cleanup even if errors occur.

---

## File Permissions

Understand and set file permissions in Go.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
    )

    func main() {
        // Create file with specific permissions
        file, err := os.OpenFile("secure.txt", os.O_CREATE|os.O_WRONLY, 0600)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        file.Close()

        // Check file info
        info, err := os.Stat("secure.txt")
        if err != nil {
            fmt.Println("Error:", err)
            return
        }

        fmt.Printf("File permissions: %v\n", info.Mode().Perm())

        // Change permissions
        err = os.Chmod("secure.txt", 0644)
        if err != nil {
            fmt.Println("Error changing permissions:", err)
            return
        }

        // Verify change
        info, _ = os.Stat("secure.txt")
        fmt.Printf("New permissions: %v\n", info.Mode().Perm())

        // Clean up
        os.Remove("secure.txt")
    }
    ```

=== "The Explanation"

    - **0600**: Owner read/write only (secure for sensitive data)
    - **0644**: Owner read/write, others read (standard for files)
    - **0755**: Owner full access, others read/execute (standard for directories)
    - **info.Mode().Perm()**: Returns permission bits

=== "The Terminal Output"

    ```
    File permissions: -rw-------
    New permissions: -rw-r--r--
    ```

!!! go "Security Tip"
Use restrictive permissions (0600) for sensitive files like private keys and credentials. Never use 0777 unless absolutely necessary.

---

## Embedding Files at Compile Time

Go 1.16+ supports embedding files directly into binaries.

=== "The Code"

    ```go
    package main

    import (
        "embed"
        "fmt"
    )

    //go:embed templates/*.html
    var templateFS embed.FS

    //go:embed static/style.css
    var styleCSS []byte

    func main() {
        // Read embedded CSS
        fmt.Printf("CSS size: %d bytes\n", len(styleCSS))
        fmt.Printf("CSS preview: %s\n\n", string(styleCSS[:100]))

        // List embedded templates
        entries, _ := templateFS.ReadDir("templates")
        fmt.Println("Embedded templates:")
        for _, entry := range entries {
            fmt.Printf("  - %s\n", entry.Name())
        }

        // Read a template
        content, _ := templateFS.ReadFile("templates/index.html")
        fmt.Printf("\nTemplate content: %s\n", string(content[:50]))
    }
    ```

=== "The Explanation"

    - **//go:embed**: Compiler directive to embed files
    - **embed.FS**: Filesystem containing embedded files
    - **[]byte**: Embed as raw bytes for single files
    - **Glob patterns**: `*` matches all files in directory
    - **Compile-time**: Files are included in the binary

=== "The Terminal Output"

    ```
    CSS size: 2048 bytes
    CSS preview: body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }

    Embedded templates:
      - index.html
      - about.html
      - contact.html

    Template content: <!DOCTYPE html>
    <html lang="en">
    ```

!!! abstract "Use Cases for go:embed"
- Embed HTML templates in web servers
- Include static assets in CLI tools
- Bundle default configuration files
- Package documentation or help text

---

## io.Pipe for Custom Pipelines

Create custom I/O pipelines with `io.Pipe`.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "io"
    )

    func main() {
        // Create a pipe
        pr, pw := io.Pipe()

        // Writer goroutine
        go func() {
            defer pw.Close()

            data := []string{
                "First chunk of data",
                "Second chunk here",
                "Final chunk",
            }

            for _, chunk := range data {
                _, err := fmt.Fprintf(pw, "%s\n", chunk)
                if err != nil {
                    fmt.Println("Write error:", err)
                    return
                }
                fmt.Printf("Wrote: %s\n", chunk)
            }

            fmt.Println("Writer finished")
        }()

        // Reader reads from pipe
        buf := make([]byte, 1024)
        for {
            n, err := pr.Read(buf)
            if n > 0 {
                fmt.Printf("Read: %s", string(buf[:n]))
            }
            if err == io.EOF {
                fmt.Println("\nReader finished")
                break
            }
            if err != nil {
                fmt.Println("Read error:", err)
                break
            }
        }
    }
    ```

=== "The Explanation"

    - **io.Pipe**: Creates synchronous pipe (reader/writer pair)
    - **Synchronous**: Writer blocks until reader consumes data
    - **Thread-safe**: Safe for concurrent goroutines
    - **Use cases**: Streaming transformations, connecting components

=== "The Terminal Output"

    ```
    Wrote: First chunk of data
    Read: First chunk of data
    Wrote: Second chunk here
    Read: Second chunk here
    Wrote: Final chunk
    Read: Final chunk
    Writer finished
    Reader finished
    ```

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Always close files | Use `defer file.Close()` immediately after opening |
| Check errors | Handle all I/O errors, especially EOF |
| Use buffered I/O | For frequent small reads/writes |
| Clean up temp files | Always remove temporary files and directories |
| Set permissions | Use restrictive permissions for sensitive files |
| Validate paths | Use `filepath.Clean` before operations |
| Use embed | Embed static assets for single-binary deployment |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| File not found | Check path and use `os.IsNotExist` for error handling |
| Permission denied | Check file permissions and running user |
| Too many open files | Ensure files are closed; increase ulimit if needed |
| Broken pipe | Reader closed before writer finished |
| Path not absolute | Use `filepath.Abs` to convert relative paths |

## Summary

- `os` package provides low-level file operations
- `io.Reader` and `io.Writer` enable flexible I/O composition
- `bufio` improves performance with buffered operations
- `filepath` handles cross-platform path manipulation
- `go:embed` includes files at compile time
- `io.Pipe` creates custom I/O pipelines
- Always handle errors and clean up resources

## Next Steps

- [JSON & Encoding](json-encoding.md) - Read and write JSON files
- [HTTP Clients](http-clients.md) - Use `io.Reader` with HTTP
- [Testing](testing.md) - Test file operations with temporary files
- [CLI Applications](cli-applications.md) - Process files in CLI tools