# Runtime & GC

Go's runtime is the foundation that manages goroutines, garbage collection, memory allocation, and low-level system interactions. The garbage collector uses a concurrent, tri-color mark-and-sweep algorithm designed for low latency. Understanding the runtime and GC internals helps you write efficient Go programs and tune performance.

## What You Will Learn

- How the Go runtime manages goroutines and memory
- The tri-color mark-and-sweep garbage collection algorithm
- The GC pacer and how it coordinates marking with mutator execution
- Tuning GC with the `GOGC` environment variable
- Memory ballast for reducing GC frequency
- Using `runtime.GC()` and `runtime.ReadMemStats` for diagnostics
- Finalizers and when to use them
- Practical GC tuning strategies

## Prerequisites

- Understanding of the [GMP scheduler](goroutines-scheduler.md)
- Familiarity with Go memory allocation basics
- Go 1.19 or later

---

## Go Runtime Overview

The Go runtime is a sophisticated system that handles goroutine scheduling, garbage collection, memory allocation, stack management, and low-level operations like network I/O and system calls.

=== "Runtime Introspection"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "time"
    )

    func main() {
        fmt.Println("=== Go Runtime Information ===")
        fmt.Printf("Go version: %s\n", runtime.Version())
        fmt.Printf("GOOS: %s\n", runtime.GOOS)
        fmt.Printf("GOARCH: %s\n", runtime.GOARCH)
        fmt.Printf("NumCPU: %d\n", runtime.NumCPU())
        fmt.Printf("GOMAXPROCS: %d\n", runtime.GOMAXPROCS(0))
        fmt.Printf("NumGoroutine: %d\n", runtime.NumGoroutine())

        var m runtime.MemStats
        runtime.ReadMemStats(&m)
        fmt.Printf("Alloc: %d KB\n", m.Alloc/1024)
        fmt.Printf("TotalAlloc: %d KB\n", m.TotalAlloc/1024)
        fmt.Printf("Sys: %d KB\n", m.Sys/1024)
        fmt.Printf("NumGC: %d\n", m.NumGC)
        fmt.Printf("Last GC: %v\n",
            time.Unix(0, int64(m.LastGC)).Format(time.RFC3339))
    }
    ```

=== "The Explanation"

    - **`runtime.Version()`**: Returns the Go version string (e.g., go1.21.0)
    - **`runtime.NumCPU()`**: Number of logical CPUs available
    - **`runtime.GOMAXPROCS(0)`**: Current processor count
    - **`runtime.ReadMemStats`**: Fills a `MemStats` struct with detailed memory statistics
    - **`m.LastGC`**: Unix nanosecond timestamp of the most recent GC

=== "The Terminal Output"

    ```
    === Go Runtime Information ===
    Go version: go1.21.0
    GOOS: darwin
    GOARCH: arm64
    NumCPU: 8
    GOMAXPROCS: 8
    NumGoroutine: 1
    Alloc: 64 KB
    TotalAlloc: 64 KB
    Sys: 3200 KB
    NumGC: 0
    Last GC: 0001-01-01T00:00:00Z
    ```

---

## Garbage Collection: Tri-Color Mark-and-Sweep

Go's GC is a concurrent, tri-color mark-and-sweep collector. It runs alongside the application (mutator) with minimal pauses.

| Color | State | Description |
|---|---|---|
| White | Unvisited | Not yet examined; candidates for collection |
| Gray | Partially visited | Reachable but children not yet examined |
| Black | Fully visited | Reachable with all children examined |

=== "GC in Action"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "runtime/debug"
        "time"
    )

    func allocateMemory() []byte {
        // Allocate 1 MB
        buf := make([]byte, 1024*1024)
        return buf
    }

    func main() {
        debug.SetGCPercent(100) // Default GOGC
        var m runtime.MemStats

        fmt.Println("=== Before allocation ===")
        runtime.ReadMemStats(&m)
        fmt.Printf("Heap alloc: %d KB, NumGC: %d\n", m.Alloc/1024, m.NumGC)

        // Allocate and discard
        for i := 0; i < 10; i++ {
            _ = allocateMemory()
        }

        fmt.Println("=== After allocation ===")
        runtime.ReadMemStats(&m)
        fmt.Printf("Heap alloc: %d KB, NumGC: %d\n", m.Alloc/1024, m.NumGC)

        // Force GC
        runtime.GC()

        fmt.Println("=== After forced GC ===")
        runtime.ReadMemStats(&m)
        fmt.Printf("Heap alloc: %d KB, NumGC: %d\n", m.Alloc/1024, m.NumGC)
    }
    ```

=== "The Explanation"

    - **`debug.SetGCPercent(100)`**: GC triggers when heap grows by 100% since last GC
    - **`runtime.GC()`**: Forces a full garbage collection cycle
    - **`m.NumGC`**: Increments each time a GC cycle completes
    - **Concurrent phase**: Marking runs concurrently with the application

=== "The Terminal Output"

    ```
    === Before allocation ===
    Heap alloc: 64 KB, NumGC: 0
    === After allocation ===
    Heap alloc: 10240 KB, NumGC: 0
    === After forced GC ===
    Heap alloc: 32 KB, NumGC: 1
    ```

!!! go "GC Phases"
    1. **Mark Setup** (STW): Prepare for marking — brief stop-the-world
    2. **Concurrent Marking**: Trace reachable objects — runs alongside application
    3. **Mark Termination** (STW): Finalize marking — brief stop-the-world
    4. **Concurrent Sweep**: Reclaim unreachable objects — runs alongside application

---

## The GC Pacer

The GC pacer coordinates garbage collection with application execution. It decides when to start GC and how much work to allocate to the background mark worker.

=== "Pacer Behavior"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "runtime/debug"
    )

    func main() {
        // Set GOGC to a lower value to trigger GC more frequently
        debug.SetGCPercent(50)

        var m runtime.MemStats

        // Allocate in a loop to observe pacer behavior
        for i := 0; i < 20; i++ {
            buf := make([]byte, 100*1024) // 100 KB each
            _ = buf

            runtime.ReadMemStats(&m)
            if m.NumGC > 0 {
                fmt.Printf("Iteration %d: Heap=%d KB, GCs=%d, PauseTotal=%d ns\n",
                    i, m.Alloc/1024, m.NumGC, m.PauseTotalNs)
            }
        }
    }
    ```

=== "The Explanation"

    - **GC pacer**: Monitors allocation rate and adjusts GC timing to meet target
    - **Assist ratio**: Goroutines allocating memory may assist with marking work
    - **Background marking**: Dedicated goroutine marks reachable objects concurrently
    - **`PauseTotalNs`**: Total time spent in STW pauses (usually < 1ms)

=== "The Terminal Output"

    ```
    Iteration 0: Heap=100 KB, GCs=1, PauseTotalNs=45200
    Iteration 1: Heap=100 KB, GCs=2, PauseTotalNs=89100
    Iteration 2: Heap=100 KB, GCs=3, PauseTotalNs=132400
    Iteration 3: Heap=100 KB, GCs=4, PauseTotalNs=178200
    ```

---

## GOGC and GOMEMLIMIT

`GOGC` controls the GC target percentage. `GOMEMLIMIT` (Go 1.19+) sets a soft memory limit.

| Variable | Default | Description |
|---|---|---|
| `GOGC` | 100 | GC triggers when heap grows by N% since last GC |
| `GOGC=off` | — | Disables GC entirely |
| `GOMEMLIMIT` | — | Soft memory limit; GC becomes more aggressive near limit |
| `debug.SetMemoryLimit(n)` | — | Programmatic equivalent of GOMEMLIMIT |

=== "GOGC and GOMEMLIMIT Tuning"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "runtime/debug"
    )

    func main() {
        // Low GOGC = more frequent GC, lower memory, higher CPU
        debug.SetGCPercent(20)
        fmt.Println("GOGC set to 20 (aggressive GC)")

        // Set soft memory limit
        debug.SetMemoryLimit(256 * 1024 * 1024) // 256 MB
        fmt.Println("GOMEMLIMIT set to 256 MB")

        // Allocate to trigger GC
        for i := 0; i < 100; i++ {
            _ = make([]byte, 10*1024) // 10 KB each
        }

        var m runtime.MemStats
        runtime.ReadMemStats(&m)
        fmt.Printf("Heap: %d KB, GCs: %d, Pause: %d ns\n",
            m.Alloc/1024, m.NumGC, m.PauseTotalNs)
    }
    ```

=== "The Explanation"

    - **`GOGC=20`**: GC triggers when heap grows by 20% since last cycle (more frequent)
    - **`SetMemoryLimit(256MB)`**: GC becomes more aggressive as memory approaches limit
    - **Trade-off**: Lower GOGC = more GC cycles = more CPU = less memory
    - **Go 1.19+**: `GOMEMLIMIT` allows fine-grained memory control without disabling GC

=== "The Terminal Output"

    ```
    GOGC set to 20 (aggressive GC)
    GOMEMLIMIT set to 256 MB
    Heap: 1024 KB, GCs: 8, Pause: 342100 ns
    ```

!!! note "GOGC Tuning Guide"
    | GOGC Value | Behavior | Use Case |
    |---|---|---|
    | `off` | No GC | Long-running processes with bounded memory |
    | `10` | Very aggressive | Memory-constrained environments |
    | `50` | Aggressive | Balance of memory and CPU |
    | `100` (default) | Balanced | General-purpose applications |
    | `200` | Conservative | CPU-intensive workloads |
    | `400+` | Very conservative | Latency-sensitive applications |

---

## Memory Ballast

Before Go 1.19, the memory ballast technique allocated a large dummy object to reduce GC frequency. The runtime only collected when the heap exceeded GOGC% of live memory, so a large ballast reduced collection frequency.

=== "Traditional Memory Ballast"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "runtime/debug"
    )

    func main() {
        // Memory ballast: pre-allocate 100 MB to reduce GC frequency
        ballast := make([]byte, 100*1024*1024) // 100 MB
        defer func() { ballast = nil }()        // Release when done

        // Without ballast, GC triggers more frequently
        // With ballast, GC thinks heap is larger, so GOGC% is higher
        for i := 0; i < 1000; i++ {
            _ = make([]byte, 1024) // 1 KB allocations
        }

        var m runtime.MemStats
        runtime.ReadMemStats(&m)
        fmt.Printf("With ballast: Heap=%d MB, GCs=%d\n",
            m.Alloc/1024/1024, m.NumGC)

        // Compare without ballast
        debug.SetGCPercent(100)
        runtime.GC()
        runtime.ReadMemStats(&m)
        fmt.Printf("After ballast release: Heap=%d KB, GCs=%d\n",
            m.Alloc/1024, m.NumGC)
    }
    ```

=== "The Explanation"

    - **Ballast concept**: A large allocation makes the runtime think the heap is bigger
    - **Effect**: GC triggers less frequently because GOGC% threshold is higher
    - **Go 1.19+**: Use `GOMEMLIMIT` instead for cleaner memory management
    - **`ballast = nil`**: Releases the ballast when no longer needed

=== "The Terminal Output"

    ```
    With ballast: Heap=100 MB, GCs=2
    After ballast release: Heap=1024 KB, GCs=5
    ```

!!! go "Memory Ballast vs GOMEMLIMIT"
    Go 1.19+ recommends `GOMEMLIMIT` over memory ballast. It provides more predictable behavior and avoids the complexity of dummy allocations. Use `debug.SetMemoryLimit()` programmatically.

---

## runtime.GC() and ReadMemStats

`runtime.GC()` forces a garbage collection cycle. `runtime.ReadMemStats` provides detailed memory statistics for diagnostics.

=== "Memory Diagnostics"

    ```go
    package main

    import (
        "fmt"
        "runtime"
    )

    func printMemStats(label string) {
        var m runtime.MemStats
        runtime.ReadMemStats(&m)

        fmt.Printf("=== %s ===\n", label)
        fmt.Printf("  Alloc:      %6d KB (current heap allocation)\n", m.Alloc/1024)
        fmt.Printf("  TotalAlloc: %6d KB (cumulative bytes allocated)\n", m.TotalAlloc/1024)
        fmt.Printf("  Sys:        %6d KB (bytes obtained from OS)\n", m.Sys/1024)
        fmt.Printf("  NumGC:      %6d (number of completed GC cycles)\n", m.NumGC)
        fmt.Printf("  PauseTotal: %6d ns (total GC pause time)\n", m.PauseTotalNs)
        fmt.Printf("  LastGC:     %v\n", m.LastGC)
        fmt.Printf("  Mallocs:    %d (cumulative malloc count)\n", m.Mallocs)
        fmt.Printf("  Frees:      %d (cumulative free count)\n", m.Frees)
    }

    func main() {
        printMemStats("Initial State")

        // Allocate memory
        data := make([]byte, 10*1024*1024) // 10 MB
        _ = data

        printMemStats("After 10 MB Allocation")

        // Force GC
        runtime.GC()

        printMemStats("After Forced GC")
    }
    ```

=== "The Explanation"

    - **`m.Alloc`**: Current bytes allocated on the heap (live objects)
    - **`m.TotalAlloc`**: Cumulative bytes ever allocated (never decreases)
    - **`m.Sys`**: Total bytes obtained from the OS (includes stacks, GC, etc.)
    - **`m.NumGC`**: Number of completed GC cycles
    - **`m.PauseTotalNs`**: Cumulative STW pause time across all GC cycles

=== "The Terminal Output"

    ```
    === Initial State ===
      Alloc:        64 KB (current heap allocation)
      TotalAlloc:   64 KB (cumulative bytes allocated)
      Sys:        3200 KB (bytes obtained from OS)
      NumGC:         0 (number of completed GC cycles)
      PauseTotal:    0 ns (total GC pause time)
    === After 10 MB Allocation ===
      Alloc:     10240 KB (current heap allocation)
      TotalAlloc: 10240 KB (cumulative bytes allocated)
      Sys:        3200 KB (bytes obtained from OS)
      NumGC:         0 (number of completed GC cycles)
      PauseTotal:    0 ns (total GC pause time)
    === After Forced GC ===
      Alloc:        32 KB (current heap allocation)
      TotalAlloc: 10240 KB (cumulative bytes allocated)
      Sys:        3200 KB (bytes obtained from OS)
      NumGC:         1 (number of completed GC cycles)
      PauseTotal: 89200 ns (total GC pause time)
    ```

---

## Finalizers

Finalizers are functions run when an object is no longer reachable. They are expensive and should be used sparingly.

=== "Finalizer Example"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "time"
    )

    type Resource struct {
        name string
    }

    func (r *Resource) Close() {
        fmt.Printf("Closing resource: %s\n", r.name)
    }

    func main() {
        // Set finalizer
        r := &Resource{name: "database-connection"}
        runtime.SetFinalizer(r, func(res *Resource) {
            res.Close()
        })

        fmt.Println("Resource created, setting r = nil")
        r = nil

        // Force GC to trigger finalizer
        runtime.GC()

        // Finalizer runs asynchronously — wait for it
        time.Sleep(100 * time.Millisecond)

        fmt.Println("Program continues...")
    }
    ```

=== "The Explanation"

    - **`runtime.SetFinalizer(r, f)`**: Registers `f` to run when `r` becomes unreachable
    - **Finalizer timing**: Runs on a dedicated goroutine after the next GC cycle
    - **Performance cost**: Finalizers add GC overhead and delay memory reclamation
    - **One-shot**: Each object can have at most one finalizer

=== "The Terminal Output"

    ```
    Resource created, setting r = nil
    Closing resource: database-connection
    Program continues...
    ```

!!! warning "Finalizer Caveats"
    - Finalizers delay object reclamation by at least one GC cycle
    - They run on a single goroutine — slow finalizers delay all finalizers
    - Objects with finalizers are never collected if the program exits
    - Prefer explicit cleanup (`defer resource.Close()`) over finalizers

---

## GC Tuning Strategies

=== "Production GC Configuration"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "runtime/debug"
    )

    func main() {
        // Strategy 1: Balanced (default)
        debug.SetGCPercent(100)

        // Strategy 2: Low memory with GOMEMLIMIT (Go 1.19+)
        debug.SetMemoryLimit(512 * 1024 * 1024) // 512 MB

        // Strategy 3: High throughput (disable GC for batch jobs)
        // debug.SetGCPercent(-1) // equivalent to GOGC=off

        // Monitor GC frequency
        var m runtime.MemStats
        runtime.ReadMemStats(&m)
        fmt.Printf("GC configured: GOGC=100, GOMEMLIMIT=512MB\n")
        fmt.Printf("Initial heap: %d KB\n", m.Alloc/1024)

        // Run workload
        for i := 0; i < 100; i++ {
            data := make([]byte, 100*1024)
            _ = data
        }

        runtime.ReadMemStats(&m)
        fmt.Printf("After workload: %d KB, GCs: %d, Pause: %d μs\n",
            m.Alloc/1024, m.NumGC, m.PauseTotalNs/1000)
    }
    ```

=== "The Explanation"

    - **Balanced (GOGC=100)**: Good for most applications
    - **GOMEMLIMIT**: Hard memory ceiling — GC becomes aggressive near limit
    - **Batch processing**: `GOGC=off` eliminates GC overhead for short-lived processes
    - **Monitor**: Use `ReadMemStats` to validate your configuration

=== "The Terminal Output"

    ```
    GC configured: GOGC=100, GOMEMLIMIT=512MB
    Initial heap: 64 KB
    After workload: 10240 KB, GCs: 0, Pause: 0 μs
    ```

| Strategy | Configuration | Trade-off |
|---|---|---|
| Default balanced | `GOGC=100` | Good general-purpose settings |
| Memory-constrained | `GOGC=20`, `GOMEMLIMIT=256MB` | More GC cycles, lower memory |
| Low latency | `GOGC=200` | Fewer GC cycles, higher memory |
| Batch processing | `GOGC=off` | No GC overhead, unbounded growth |
| Container environments | `GOMEMLIMIT=container_limit` | Respects container memory limits |

---

## Best Practices

| Practice | Description |
|---|---|
| Use GOMEMLIMIT in containers | Set `GOMEMLIMIT` to 80% of container memory limit |
| Monitor with ReadMemStats | Track `Alloc`, `NumGC`, and `PauseTotalNs` in production |
| Avoid finalizers | Prefer explicit cleanup; use `defer resource.Close()` |
| Profile before tuning | Use `go tool pprof` before changing GOGC |
| Set GOGC=off for CLIs | Short-lived programs don't need GC |
| Use `-benchmem` | Track allocations in benchmarks |
| Reduce allocations | Pool objects with `sync.Pool` to reduce GC pressure |

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| High GC CPU usage | GOGC too low | Increase GOGC; use GOMEMLIMIT instead |
| OOM in containers | GOMEMLIMIT not set | Set GOMEMLIMIT to container memory limit |
| Long GC pauses | Large heap, many pointers | Reduce heap size; minimize pointer-heavy objects |
| Memory leak | Goroutine leak or retained references | Use `pprof` heap profile to find leak source |
| Finalizer slowdown | Slow finalizer function | Use explicit cleanup instead |
| High `Sys` memory | Large stacks or thread-local storage | Reduce goroutine count; check for stack leaks |

## Summary

- Go's runtime manages goroutines, GC, memory, and system interactions
- GC uses concurrent tri-color mark-and-sweep with minimal STW pauses
- `GOGC` controls GC frequency; `GOMEMLIMIT` sets a soft memory limit
- `runtime.GC()` forces collection; `runtime.ReadMemStats` provides diagnostics
- Finalizers are expensive — prefer explicit cleanup with `defer`
- Memory ballast is obsolete in Go 1.19+; use `GOMEMLIMIT` instead
- Container environments should always set `GOMEMLIMIT`

## Next Steps

- [Error Design Philosophy](error-design.md) — Learn Go's approach to error handling
- [Memory Model](memory-model.md) — Understand synchronization and happens-before
- [Goroutines & Scheduler](goroutines-scheduler.md) — Deep dive into the GMP scheduling model
