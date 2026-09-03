# Performance

Go provides built-in profiling, benchmarking, and tracing tools to identify bottlenecks and optimize application performance. Understanding escape analysis, memory allocation patterns, and compiler optimizations helps you write efficient code before it reaches production.

## What You Will Learn

- Profiling CPU, memory, goroutines, and blocking operations with pprof
- Writing and running benchmarks with `go test -bench`
- Using the trace tool for execution visualization
- Understanding escape analysis and its impact on allocations
- Optimizing memory usage, string operations, and object creation
- Leveraging compiler optimizations for performance

## Prerequisites

- Familiarity with [Go modules](/docs/fundamentals/modules.md)
- Understanding of [goroutines and channels](/docs/fundamentals/concurrency.md)
- Basic knowledge of [testing in Go](/docs/fundamentals/testing.md)

---

## Profiling with pprof

Go's `runtime/pprof` and `net/http/pprof` packages provide runtime profiling for CPU usage, memory allocation, goroutine activity, blocking operations, and mutex contention.

### Enabling HTTP Profiling

=== "The Code"

    ```go
    package main

    import (
        "log"
        "net/http"
        _ "net/http/pprof"
    )

    func main() {
        go func() {
            log.Println("Profiler listening on :6060")
            log.Fatal(http.ListenAndServe(":6060", nil))
        }()

        http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            w.Write([]byte("Hello, World!"))
        })

        log.Println("Application listening on :8080")
        log.Fatal(http.ListenAndServe(":8080", nil))
    }
    ```

=== "The Explanation"

    - **`_ "net/http/pprof"`**: Blank import registers profiling handlers on the default mux
    - **Separate port**: Run the profiler on `:6060` to avoid exposing it in production
    - **Available endpoints**: `/debug/pprof/`, `/debug/pprof/heap`, `/debug/pprof/goroutine`

=== "The Terminal Output"

    ```bash
    # List available profiles
    $ go tool pprof http://localhost:6060/debug/pprof/

    # Capture a 30-second CPU profile
    $ go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30

    # View heap allocations
    $ go tool pprof http://localhost:6060/debug/pprof/heap

    # View goroutine dump
    $ go tool pprof http://localhost:6060/debug/pprof/goroutine
    ```

### Profile Types

| Profile | What It Measures | Command |
|---|---|---|
| `cpu` | CPU time spent in functions | `/debug/pprof/profile?seconds=30` |
| `heap` | Memory allocations on the heap | `/debug/pprof/heap` |
| `goroutine` | Active goroutine stack traces | `/debug/pprof/goroutine` |
| `block` | Time spent blocked on synchronization | `/debug/pprof/block` |
| `mutex` | Time spent waiting for mutexes | `/debug/pprof/mutex` |
| `allocs` | All allocations (including freed) | `/debug/pprof/allocs` |

### CPU Profiling

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
        "runtime/pprof"
    )

    func main() {
        f, err := os.Create("cpu.prof")
        if err != nil {
            fmt.Fprintf(os.Stderr, "Failed to create profile: %v\n", err)
            os.Exit(1)
        }
        defer f.Close()

        if err := pprof.StartCPUProfile(f); err != nil {
            fmt.Fprintf(os.Stderr, "Failed to start CPU profile: %v\n", err)
            os.Exit(1)
        }
        defer pprof.StopCPUProfile()

        // Simulate work
        sum := 0
        for i := 0; i < 10_000_000; i++ {
            sum += i
        }
        fmt.Println("Done:", sum)
    }
    ```

=== "The Explanation"

    - **`pprof.StartCPUProfile`**: Begins recording CPU usage to the provided file
    - **`defer pprof.StopCPUProfile`**: Ensures the profile is flushed when the function exits
    - **Profile file**: Binary format readable by `go tool pprof`

=== "The Terminal Output"

    ```bash
    $ go run main.go
    Done: 49999995000000

    $ go tool pprof cpu.prof
    Type: cpu
    Time: Sep 3, 2026 at 10:00am (UTC)
    Duration: 30ms, Total samples = 28ms (93.33%)
      flat  flat%   sum%        cum   cum%
      28ms 100.0% 100.0%       28ms 100.0%  main.main
    ```

!!! danger "Never Enable CPU Profiling in Production on Live Traffic"

    CPU profiling adds significant overhead. Use short durations or enable it only during controlled testing. For production, prefer in-process profiling endpoints that can be accessed on demand.

### Memory Profiling

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
        "runtime"
        "runtime/pprof"
    )

    func allocateMemory() []byte {
        data := make([]byte, 1024*1024)
        for i := range data {
            data[i] = byte(i % 256)
        }
        return data
    }

    func main() {
        var m1, m2 runtime.MemStats
        runtime.ReadMemStats(&m1)
        fmt.Printf("Alloc: %d MB\n", m1.Alloc/1024/1024)

        // Allocate some memory
        for i := 0; i < 10; i++ {
            _ = allocateMemory()
        }

        runtime.ReadMemStats(&m2)
        fmt.Printf("Alloc after: %d MB\n", m2.Alloc/1024/1024)
        fmt.Printf("TotalAlloc: %d MB\n", m2.TotalAlloc/1024/1024)
        fmt.Printf("NumGC: %d\n", m2.NumGC)

        // Write heap profile
        f, _ := os.Create("heap.prof")
        defer f.Close()
        pprof.WriteHeapProfile(f)
    }
    ```

=== "The Explanation"

    - **`runtime.MemStats`**: Provides detailed memory allocation statistics
    - **`Alloc`**: Currently allocated memory on the heap
    - **`TotalAlloc`**: Cumulative bytes allocated since program start
    - **`NumGC`**: Number of completed garbage collection cycles
    - **`pprof.WriteHeapProfile`**: Dumps current heap profile to a file

=== "The Terminal Output"

    ```
    Alloc: 1 MB
    Alloc after: 10 MB
    TotalAlloc: 10 MB
    NumGC: 2
    ```

    ```bash
    $ go tool pprof heap.prof
    Showing nodes accounting for 10.00MB, 100% of 10.00MB total
      flat  flat%   sum%        cum   cum%
      10MB  100%   100%       10MB  100%  main.allocateMemory
    ```

### Goroutine Profiling

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "net/http"
        _ "net/http/pprof"
        "sync"
        "time"
    )

    func main() {
        var wg sync.WaitGroup

        // Launch many goroutines
        for i := 0; i < 100; i++ {
            wg.Add(1)
            go func(id int) {
                defer wg.Done()
                time.Sleep(5 * time.Second)
            }(i)
        }

        fmt.Println("Launched 100 goroutines, visit /debug/pprof/goroutine")

        go http.ListenAndServe(":6060", nil)
        wg.Wait()
    }
    ```

=== "The Explanation"

    - **Goroutine profile**: Shows stack traces for all active goroutines
    - **Detect leaks**: Goroutines blocked on channels or locks appear in the profile
    - **Count goroutines**: The profile header shows total goroutine count

=== "The Terminal Output"

    ```bash
    $ go tool pprof http://localhost:6060/debug/pprof/goroutine
    goroutine profile: total 101
    1 @ 0x4037401 0x40374f0 0x4037508 0x40b8a5f
    #   0x40b8a5e  main.main.func1+0x3e
    ```

---

## Benchmarking

Benchmarks use the `testing.B` type and the `-bench` flag to measure function performance with statistical rigor.

### Writing Benchmarks

=== "The Code"

    ```go
    package concat

    import (
        "strings"
        "testing"
    )

    func ConcatPlus(a, b string) string {
        return a + b
    }

    func ConcatBuilder(a, b string) string {
        var sb strings.Builder
        sb.WriteString(a)
        sb.WriteString(b)
        return sb.String()
    }

    func ConcatSprintf(a, b string) string {
        return strings.Join([]string{a, b}, "")
    }

    func BenchmarkConcatPlus(b *testing.B) {
        a := "hello"
        bStr := "world"
        for i := 0; i < b.N; i++ {
            _ = ConcatPlus(a, bStr)
        }
    }

    func BenchmarkConcatBuilder(b *testing.B) {
        a := "hello"
        bStr := "world"
        for i := 0; i < b.N; i++ {
            _ = ConcatBuilder(a, bStr)
        }
    }

    func BenchmarkConcatSprintf(b *testing.B) {
        a := "hello"
        bStr := "world"
        for i := 0; i < b.N; i++ {
            _ = ConcatSprintf(a, bStr)
        }
    }
    ```

=== "The Explanation"

    - **`testing.B`**: Benchmark type that manages iteration count (`b.N`)
    - **`b.N`**: Adjusted automatically by the testing framework for stable results
    - **`b.ResetTimer`**: Resets the timer after setup to exclude initialization
    - **Naming convention**: `BenchmarkFunctionName` with no underscores

=== "The Terminal Output"

    ```bash
    $ go test -bench=. -benchmem -count=5
    BenchmarkConcatPlus-8        100000000    10.2 ns/op    16 B/op    1 allocs/op
    BenchmarkConcatBuilder-8     50000000     24.5 ns/op    32 B/op    3 allocs/op
    BenchmarkConcatSprintf-8     30000000     48.7 ns/op    48 B/op    4 allocs/op

    $ go test -bench=. -benchmem -benchtime=3s
    $ go test -bench=. -run='^$' -benchmem
    ```

### Benchmark Flags

| Flag | Description | Example |
|---|---|---|
| `-bench` | Run benchmarks matching pattern | `-bench=BenchmarkFoo` |
| `-benchmem` | Report memory allocations | `-benchmem` |
| `-benchtime` | Duration per benchmark | `-benchtime=3s` |
| `-count` | Run benchmarks N times | `-count=5` |
| `-cpu` | GOMAXPROCS values to test | `-cpu=1,2,4` |
| `-run` | Skip unit tests | `-run='^$'` |

### Benchmark Table-Driven

=== "The Code"

    ```go
    package sort

    import (
        "math/rand"
        "sort"
        "testing"
    )

    func BenchmarkSort(b *testing.B) {
        sizes := []int{100, 1000, 10000, 100000}

        for _, size := range sizes {
            b.Run(fmt.Sprintf("size_%d", size), func(b *testing.B) {
                data := make([]int, size)
                for i := range data {
                    data[i] = rand.Intn(size)
                }

                b.ResetTimer()
                for i := 0; i < b.N; i++ {
                    copy := make([]int, len(data))
                    copy(copy, data)
                    sort.Ints(copy)
                }
            })
        }
    }
    ```

=== "The Explanation"

    - **`b.Run`**: Creates sub-benchmarks for different input sizes
    - **`b.ResetTimer`**: Excludes data setup from the benchmark measurement
    - **`copy`**: Ensures each iteration sorts a fresh slice

=== "The Terminal Output"

    ```
    BenchmarkSort/size_100-8          500000     2456 ns/op     896 B/op    1 allocs/op
    BenchmarkSort/size_1000-8          50000    28901 ns/op    8192 B/op    1 allocs/op
    BenchmarkSort/size_10000-8          5000   312456 ns/op   81920 B/op    1 allocs/op
    BenchmarkSort/size_100000-8          300  3987654 ns/op  819200 B/op    1 allocs/op
    ```

---

## Trace Tool

The execution tracer visualizes goroutine scheduling, syscalls, GC pauses, and network I/O.

=== "The Code"

    ```go
    package main

    import (
        "os"
        "runtime/trace"
        "sync"
    )

    func main() {
        f, _ := os.Create("trace.out")
        defer f.Close()
        trace.Start(f)
        defer trace.Stop()

        var wg sync.WaitGroup
        for i := 0; i < 10; i++ {
            wg.Add(1)
            go func(id int) {
                defer wg.Done()
                doWork(id)
            }(i)
        }
        wg.Wait()
    }

    func doWork(id int) {
        data := make([]byte, 1024)
        for i := range data {
            data[i] = byte(id)
        }
    }
    ```

=== "The Explanation"

    - **`trace.Start(f)`**: Begins writing execution trace data to the file
    - **`trace.Stop()`**: Flushes and closes the trace
    - **`go tool trace trace.out`**: Opens an interactive visualization in a browser

=== "The Terminal Output"

    ```bash
    $ go run main.go
    $ go tool trace trace.out
    Viewing trace in http://localhost:6061
    ```

!!! go "Trace vs pprof"

    Use pprof to identify *what* is slow. Use the trace tool to understand *when* and *why* — it shows goroutine scheduling, GC pauses, and blocking events over time.

---

## Escape Analysis

Escape analysis determines whether variables are allocated on the stack or heap at compile time.

=== "The Code"

    ```go
    package escape

    // Stays on stack — returned value does not escape
    func stackAlloc() int {
        x := 42
        return x
    }

    // Escapes to heap — returned pointer outlives function
    func heapAlloc() *int {
        x := 42
        return &x
    }

    // Escapes to heap — interface conversion causes escape
    func interfaceEscape() interface{} {
        x := 42
        return x
    }

    // Escapes to heap — channel send extends lifetime
    func channelEscape() <-chan int {
        ch := make(chan int, 1)
        go func() {
            ch <- 42
        }()
        return ch
    }
    ```

=== "The Explanation"

    - **Stack allocation**: Fast, automatic cleanup, no GC pressure
    - **Heap allocation**: Slower, requires garbage collection
    - **Escape triggers**: Returning pointers, interface boxing, channel operations, closures capturing variables
    - **Check with**: `go build -gcflags="-m -m"` for verbose escape analysis output

=== "The Terminal Output"

    ```bash
    $ go build -gcflags="-m" ./...
    ./escape.go:10:2: moved to heap: x
    ./escape.go:15:2: moved to heap: x
    ./escape.go:22:2: moved to heap: x
    ./escape.go:28:9: moved to heap: ch
    ```

### Escape Analysis Tips

| Pattern | Escapes? | Reason |
|---|---|---|
| `return localVar` | No | Value copied, stays on stack |
| `return &localVar` | Yes | Pointer escapes function scope |
| `fmt.Println(x)` | Yes | Interface boxing allocates on heap |
| `s := string([]byte{x})` | Yes | New string allocation |
| `append(slice, x)` | Depends | May reallocate underlying array |

---

## Memory Optimization

### Reducing Allocations

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "runtime"
    )

    func allocHeavy() []int {
        result := make([]int, 0)
        for i := 0; i < 1000; i++ {
            result = append(result, i)
        }
        return result
    }

    func allocOptimized() []int {
        result := make([]int, 0, 1000)
        for i := 0; i < 1000; i++ {
            result = append(result, i)
        }
        return result
    }

    func main() {
        var m1, m2 runtime.MemStats

        runtime.GC()
        runtime.ReadMemStats(&m1)
        _ = allocHeavy()
        runtime.ReadMemStats(&m2)
        fmt.Printf("Heavy: %d allocs\n", m2.Mallocs-m1.Mallocs)

        runtime.GC()
        runtime.ReadMemStats(&m1)
        _ = allocOptimized()
        runtime.ReadMemStats(&m2)
        fmt.Printf("Optimized: %d allocs\n", m2.Mallocs-m1.Mallocs)
    }
    ```

=== "The Explanation"

    - **`make([]int, 0, 1000)`**: Pre-allocates capacity to avoid repeated reallocations
    - **`runtime.MemStats.Mallocs`**: Total number of heap allocations
    - **Pre-allocation**: Single allocation instead of multiple growth allocations

=== "The Terminal Output"

    ```
    Heavy: 12 allocs
    Optimized: 1 allocs
    ```

---

## String Concatenation Performance

=== "The Code"

    ```go
    package main

    import (
        "bytes"
        "fmt"
        "strings"
        "testing"
    )

    func concatPlus(parts []string) string {
        result := ""
        for _, s := range parts {
            result += s
        }
        return result
    }

    func concatBuilder(parts []string) string {
        var sb strings.Builder
        sb.Grow(totalLen(parts))
        for _, s := range parts {
            sb.WriteString(s)
        }
        return sb.String()
    }

    func concatBuffer(parts []string) string {
        var buf bytes.Buffer
        buf.Grow(totalLen(parts))
        for _, s := range parts {
            buf.WriteString(s)
        }
        return buf.String()
    }

    func totalLen(parts []string) int {
        n := 0
        for _, s := range parts {
            n += len(s)
        }
        return n
    }

    func BenchmarkConcatPlus(b *testing.B) {
        parts := []string{"hello", " ", "world", " ", "foo"}
        for i := 0; i < b.N; i++ {
            _ = concatPlus(parts)
        }
    }

    func BenchmarkConcatBuilder(b *testing.B) {
        parts := []string{"hello", " ", "world", " ", "foo"}
        for i := 0; i < b.N; i++ {
            _ = concatBuilder(parts)
        }
    }

    func BenchmarkConcatBuffer(b *testing.B) {
        parts := []string{"hello", " ", "world", " ", "foo"}
        for i := 0; i < b.N; i++ {
            _ = concatBuffer(parts)
        }
    }
    ```

=== "The Explanation"

    - **`+=` operator**: Creates a new string each iteration, O(n²) for n parts
    - **`strings.Builder`**: Grows internally, amortized O(n) allocation
    - **`buf.Grow`**: Pre-allocates buffer to avoid incremental growth
    - **`bytes.Buffer`**: Similar to Builder but allocates on heap

=== "The Terminal Output"

    ```bash
    $ go test -bench=. -benchmem -run='^$'
    BenchmarkConcatPlus-8       50000000    28.3 ns/op    80 B/op    5 allocs/op
    BenchmarkConcatBuilder-8   100000000    12.1 ns/op    48 B/op    2 allocs/op
    BenchmarkConcatBuffer-8    100000000    14.5 ns/op    64 B/op    3 allocs/op
    ```

!!! go "Strings.Builder Is the Standard Choice"

    Use `strings.Builder` for string concatenation in production code. It provides the best balance of performance and readability, and is part of the standard library.

---

## Object Pooling

=== "The Code"

    ```go
    package main

    import (
        "bytes"
        "fmt"
        "sync"
    )

    var bufPool = sync.Pool{
        New: func() interface{} {
            return new(bytes.Buffer)
        },
    }

    func processRequest(data []byte) string {
        buf := bufPool.Get().(*bytes.Buffer)
        buf.Reset()
        defer bufPool.Put(buf)

        buf.Write(data)
        buf.WriteString(" processed")
        return buf.String()
    }

    func main() {
        data := []byte("request payload")
        result := processRequest(data)
        fmt.Println(result)

        // Verify pool reuse
        buf := bufPool.Get().(*bytes.Buffer)
        fmt.Printf("Pool buffer cap: %d\n", buf.Cap())
        bufPool.Put(buf)
    }
    ```

=== "The Explanation"

    - **`sync.Pool`**: Reusable object pool that reduces GC pressure
    - **`Get`/`Put`**: Retrieve and return objects to the pool
    - **`Reset`**: Clears the buffer before reuse
    - **Use case**: High-throughput servers handling many small objects

=== "The Terminal Output"

    ```
    request payload processed
    Pool buffer cap: 64
    ```

---

## Compiler Optimizations

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "testing"
    )

    // Inlined function — no function call overhead
    func square(x int) int {
        return x * x
    }

    // Function too complex to inline
    func complexOperation(x int) int {
        result := 0
        for i := 0; i < x; i++ {
            result += i * i
        }
        return result
    }

    func BenchmarkSquare(b *testing.B) {
        for i := 0; i < b.N; i++ {
            _ = square(42)
        }
    }

    func BenchmarkComplex(b *testing.B) {
        for i := 0; i < b.N; i++ {
            _ = complexOperation(1000)
        }
    }

    // Check inlining decisions
    func TestInlining(t *testing.T) {
        fmt.Println("Checking inlining decisions...")
    }
    ```

=== "The Explanation"

    - **Inlining**: Go compiler eliminates small function calls at compile time
    - **Check inlining**: `go build -gcflags="-m"` shows which functions are inlined
    - **`//go:noinline`**: Pragma to prevent inlining a specific function
    - **`-l` flag**: `go build -gcflags="-l"` disables inlining entirely

=== "The Terminal Output"

    ```bash
    $ go build -gcflags="-m" main.go
    ./main.go:10:6: can inline square
    ./main.go:14:6: cannot inline complexOperation: unhandled op FORRANGE

    $ go test -bench=. -benchmem -gcflags="-m"
    ```

### Compiler Optimization Flags

| Flag | Effect | Use Case |
|---|---|---|
| `-gcflags="-m"` | Show escape analysis and inlining | Understanding allocations |
| `-gcflags="-m -m"` | Verbose optimization decisions | Deep analysis |
| `-gcflags="-l"` | Disable inlining | Benchmarking raw performance |
| `-ldflags="-s -w"` | Strip debug symbols | Reducing binary size |
| `-trimpath` | Remove file paths | Reproducible builds |

---

## Best Practices

| Practice | Description | Impact |
|---|---|---|
| Pre-allocate slices | Use `make([]T, 0, cap)` to avoid reallocations | High |
| Use strings.Builder | For string concatenation loops | Medium |
| Profile before optimizing | Use pprof to find actual bottlenecks | Critical |
| Benchmark changes | Use `go test -bench` to measure improvements | High |
| Check escape analysis | Use `-gcflags="-m"` to understand allocations | Medium |
| Use sync.Pool | For frequently allocated short-lived objects | Medium |
| Avoid premature optimization | Profile first, optimize what matters | Critical |

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| High GC pauses | Excessive heap allocations | Reduce allocations, use sync.Pool |
| CPU profile shows no hot function | Sampling too coarse | Increase profiling duration |
| Benchmark results inconsistent | Background processes | Use `-count=5` and statistical analysis |
| Heap profile shows many small allocations | Slice/map growth | Pre-allocate with known capacity |
| Goroutine count growing indefinitely | Goroutine leak | Check goroutine profile for blocked goroutines |
| Inlining not happening | Function too complex | Simplify function or reduce branching |

## Summary

- pprof provides CPU, memory, goroutine, block, and mutex profiles for identifying bottlenecks
- Benchmarks with `go test -bench` measure performance with statistical rigor
- The trace tool visualizes goroutine scheduling and GC pauses over time
- Escape analysis determines stack vs heap allocation at compile time
- Pre-allocating slices and using `strings.Builder` reduce memory pressure
- `sync.Pool` reuses objects to minimize GC overhead
- Compiler optimizations like inlining happen automatically but can be inspected

## Next Steps

- [Resilience](/docs/production/resilience.md) — Building fault-tolerant production services
- [Observability](/docs/production/observability.md) — Monitoring performance in production
- [Containerization](/docs/production/containerization.md) — Deploying optimized containers
- [CI/CD](/docs/production/ci-cd.md) — Automating benchmarks in pipelines
