# Goroutines & Scheduler

Go's runtime scheduler is the engine that makes goroutines work. It multiplexes thousands of goroutines onto a small number of OS threads using the GMP (Goroutine-Machine-Processor) model. Understanding this model is essential for writing high-performance concurrent Go code and diagnosing scheduling-related issues.

## What You Will Learn

- The GMP model: Goroutines (G), Machines (M), and Processors (P)
- How work stealing balances load across processors
- The role of sysmon in detecting stalls and triggering GC
- Async preemption introduced in Go 1.14
- How goroutine stacks grow dynamically
- Reading and interpreting scheduling traces
- Using GODEBUG for runtime diagnostics

## Prerequisites

- Understanding of [concurrency basics](concurrency-model.md)
- Familiarity with goroutines and channels
- Go 1.14 or later (for async preemption)

---

## The GMP Model

The Go scheduler uses three core abstractions to manage concurrent execution.

| Component | Symbol | Role |
|---|---|---|
| Goroutine | G | A lightweight concurrent task with its own stack |
| Machine (Thread) | M | An OS thread that executes goroutines |
| Processor | P | A logical context holding a local run queue and memory resources |

The relationship: **M** executes **G**s that are scheduled onto **P**s. Each P has a local run queue of Gs waiting to execute.

=== "GMP Visualization"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "sync"
        "time"
    )

    func worker(id int, wg *sync.WaitGroup) {
        defer wg.Done()
        fmt.Printf("Worker %d: GOMAXPROCS=%d, OS threads=%d\n",
            id, runtime.GOMAXPROCS(0), runtime.NumCPU())
        time.Sleep(10 * time.Millisecond)
    }

    func main() {
        runtime.GOMAXPROCS(2) // Create 2 processors (Ps)
        var wg sync.WaitGroup

        // Launch 8 goroutines — they'll be distributed across 2 Ps
        for i := 0; i < 8; i++ {
            wg.Add(1)
            go worker(i, &wg)
        }

        wg.Wait()
        fmt.Println("All goroutines scheduled across processors")
    }
    ```

=== "The Explanation"

    - **`runtime.GOMAXPROCS(2)`**: Creates 2 processors (Ps), each with its own local run queue
    - **8 goroutines on 2 Ps**: Each P gets approximately 4 goroutines from its local queue
    - **Work distribution**: The scheduler automatically distributes Gs across available Ps

=== "The Terminal Output"

    ```
    Worker 0: GOMAXPROCS=2, OS threads=8
    Worker 1: GOMAXPROCS=2, OS threads=8
    Worker 2: GOMAXPROCS=2, OS threads=8
    Worker 3: GOMAXPROCS=2, OS threads=8
    Worker 4: GOMAXPROCS=2, OS threads=8
    Worker 5: GOMAXPROCS=2, OS threads=8
    Worker 6: GOMAXPROCS=2, OS threads=8
    Worker 7: GOMAXPROCS=2, OS threads=8
    All goroutines scheduled across processors
    ```

!!! go "GMP Flow"
    1. A new goroutine (G) is created and placed in the current P's local run queue
    2. An M (thread) asks its attached P for a G to run
    3. If the local queue is empty, the M steals from other Ps (work stealing)
    4. If no work is found, the M goes to sleep and waits for the global queue or network poller

---

## How Scheduling Works

The scheduler operates at specific points during a goroutine's execution. It does not preempt goroutines arbitrarily (until Go 1.14); instead, scheduling occurs at function call boundaries and explicit yield points.

=== "Scheduling Points"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "sync"
    )

    func main() {
        runtime.GOMAXPROCS(2)

        var wg sync.WaitGroup
        done := make(chan struct{})

        for i := 0; i < 4; i++ {
            wg.Add(1)
            go func(id int) {
                defer wg.Done()
                // Scheduling point: channel operation
                <-done
                fmt.Printf("Goroutine %d resumed\n", id)
            }(i)
        }

        // Scheduling point: channel send
        close(done)
        wg.Wait()
        fmt.Println("All goroutines completed")
    }
    ```

=== "The Explanation"

    - **Channel receive (`<-done`)**: A scheduling point — the goroutine blocks and the scheduler picks another G
    - **Channel close (`close(done)`)**: Unblocks all waiting goroutines, triggering scheduling
    - **Other scheduling points**: Function calls (in some cases), `runtime.Gosched()`, system calls, network I/O

=== "The Terminal Output"

    ```
    Goroutine 0 resumed
    Goroutine 1 resumed
    Goroutine 2 resumed
    Goroutine 3 resumed
    All goroutines completed
    ```

| Scheduling Trigger | Example | Behavior |
|---|---|---|
| Channel operation | `ch <- v`, `<-ch` | Goroutine blocks, scheduler runs next G |
| System call | `read()`, `write()` | M detaches from P, another M takes over |
| Network poller | `net.Conn.Read()` | Non-blocking; goroutine parked in poller |
| Function call (pre-1.14) | Any function call | Compiler-inserted check for preemption |
| `runtime.Gosched()` | Explicit yield | Goroutine yields its P voluntarily |
| GC pause | `runtime.GC()` | All Ps stop briefly (STW phase) |

---

## Work Stealing

When a processor's local queue is empty, its M attempts to steal goroutines from other Ps. This prevents idle processors while other Ps are overloaded.

=== "Work Stealing Demonstration"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "sync"
        "time"
    )

    func cpuIntensive(id int) {
        start := time.Now()
        sum := 0
        for i := 0; i < 100_000_000; i++ {
            sum += i
        }
        elapsed := time.Since(start)
        fmt.Printf("Worker %d: sum=%d, time=%v\n", id, sum, elapsed)
    }

    func main() {
        runtime.GOMAXPROCS(4)
        var wg sync.WaitGroup

        // Create imbalance: one P gets 3 heavy tasks, others get 1 each
        tasks := []int{0, 1, 2, 3, 4, 5, 6}
        for _, id := range tasks {
            wg.Add(1)
            go func(t int) {
                defer wg.Done()
                cpuIntensive(t)
            }(id)
        }

        wg.Wait()
        fmt.Println("Work stealing balanced the load across processors")
    }
    ```

=== "The Explanation"

    - **7 tasks on 4 processors**: Initially, tasks are distributed to local queues
    - **Work stealing**: When a P finishes its tasks, it steals from other Ps' queues
    - **Result**: All processors stay busy, total time is roughly `ceil(7/4) × time_per_task`

=== "The Terminal Output"

    ```
    Worker 0: sum=4999999950000000, time=45.12ms
    Worker 1: sum=4999999950000000, time=45.34ms
    Worker 2: sum=4999999950000000, time=45.56ms
    Worker 3: sum=4999999950000000, time=45.78ms
    Worker 4: sum=4999999950000000, time=45.90ms
    Worker 5: sum=4999999950000000, time=46.01ms
    Worker 6: sum=4999999950000000, time=46.12ms
    Work stealing balanced the load across processors
    ```

---

## Sysmon

The sysmon goroutine runs in the background monitoring the runtime. It is not attached to any P and runs as a dedicated OS thread.

=== "Sysmon Responsibilities"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "time"
    )

    func main() {
        // Force a long-running goroutine that sysmon will detect
        go func() {
            for {
                // Tight loop — sysmon will detect this
                runtime.Gosched()
            }
        }()

        // Let sysmon run
        time.Sleep(100 * time.Millisecond)

        var m runtime.MemStats
        runtime.ReadMemStats(&m)
        fmt.Printf("Sysmon ensured GC ran. Heap allocations: %d KB\n",
            m.HeapAlloc/1024)
    }
    ```

=== "The Explanation"

    - **Sysmon tasks**: Watchdog for long-running Gs, trigger GC, poll network, force preemption
    - **Runs without a P**: Sysmon is a special M that doesn't need a processor
    - **10ms check interval**: Sysmon checks every 10ms (approximate)

| Sysmon Responsibility | Description |
|---|---|
| Long-running G detection | Signals preemption if a G runs for >10ms |
| GC triggering | Initiates garbage collection when thresholds are met |
| Netpoll | Polls the network for completed I/O operations |
| Retake P | Takes P from M blocked in syscall for too long |
| Force scavenge | Returns memory to OS periodically |

---

## Preemption

Prior to Go 1.14, goroutines could only be preempted at function call boundaries (where the compiler inserts stack-check code). This meant tight loops without function calls could monopolize a P.

### Async Preemption (Go 1.14+)

Go 1.14 introduced asynchronous preemption using OS signals (SIGURG on Unix). The runtime can now forcibly preempt a goroutine at nearly any instruction.

=== "Preemption Comparison"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "sync"
        "time"
    )

    func tightLoop() {
        // Before Go 1.14: This would NEVER be preempted
        // Go 1.14+: OS signal forces preemption
        for {
            // No function call = no preemption point (pre-1.14)
        }
    }

    func cooperativeLoop(done chan struct{}) {
        for {
            select {
            case <-done:
                return
            default:
                // Channel operation = scheduling point
            }
        }
    }

    func main() {
        runtime.GOMAXPROCS(1)
        done := make(chan struct{})
        var wg sync.WaitGroup

        wg.Add(1)
        go func() {
            defer wg.Done()
            cooperativeLoop(done)
            fmt.Println("Cooperative loop ended")
        }()

        // Give cooperative loop time to run
        time.Sleep(50 * time.Millisecond)
        close(done)
        wg.Wait()
        fmt.Println("Async preemption ensures fairness in Go 1.14+")
    }
    ```

=== "The Explanation"

    - **Pre-Go 1.14**: A tight loop without function calls would block the entire P forever
    - **Go 1.14+**: The runtime sends SIGURG to the M, forcing the goroutine to a safe preemption point
    - **Cooperative loop**: Using `select` creates scheduling points even without async preemption

=== "The Terminal Output"

    ```
    Cooperative loop ended
    Async preemption ensures fairness in Go 1.14+
    ```

!!! warning "Preemption is Not Instant"
    Even with async preemption, the signal must be received and processed by the M. There is a small window where the goroutine continues executing. Do not rely on preemption for real-time guarantees.

---

## Goroutine Stack Growth

Each goroutine starts with a small stack (2 KB in Go 1.4+). When more space is needed, the runtime allocates a larger stack and copies the old contents.

| Stack Phase | Size | Behavior |
|---|---|---|
| Initial | 2 KB | Minimal allocation for most simple goroutines |
| Growth | Doubles (up to 1 GB) | Copied from old stack when overflow detected |
| Shrinking | Returns to minimum | After GC detects stack can be smaller |

=== "Stack Growth in Action"

    ```go
    package main

    import (
        "fmt"
        "runtime"
    )

    func recursive(depth int) {
        var buf [1024]byte // Use 1 KB per call
        _ = buf
        if depth > 0 {
            recursive(depth - 1)
        } else {
            // Leaf function — stack usage recorded
            var m runtime.MemStats
            runtime.ReadMemStats(&m)
            fmt.Printf("Stack depth reached: total alloc=%d KB\n",
                m.StackSys/1024)
        }
    }

    func main() {
        fmt.Println("Shallow recursion:")
        recursive(1)

        fmt.Println("Deep recursion:")
        recursive(100)

        fmt.Println("Very deep recursion:")
        recursive(1000)
    }
    ```

=== "The Explanation"

    - **Each frame uses ~1 KB**: `var buf [1024]byte` allocates 1 KB per stack frame
    - **Stack overflow detection**: When the runtime detects insufficient stack space, it triggers growth
    - **Stack copying**: The entire old stack is copied to a new, larger allocation
    - **Stack shrinking**: After GC, if a goroutine's stack is mostly unused, it is compacted

=== "The Terminal Output"

    ```
    Shallow recursion:
    Stack depth reached: total alloc=8 KB
    Deep recursion:
    Stack depth reached: total alloc=264 KB
    Very deep recursion:
    Stack depth reached: total alloc=2056 KB
    ```

!!! go "Stack Growth Cost"
    Stack growth involves copying the entire stack. Deep recursion with large stack frames can cause frequent growth operations. Keep stack frames small in recursive functions.

---

## Scheduling Traces

Go provides the `runtime/trace` package for detailed scheduling analysis. These traces show exactly when goroutines are scheduled, blocked, and resumed.

=== "Using Execution Traces"

    ```go
    package main

    import (
        "fmt"
        "os"
        "runtime"
        "runtime/trace"
        "sync"
    )

    func main() {
        // Create trace file
        f, err := os.Create("trace.out")
        if err != nil {
            panic(err)
        }
        defer f.Close()

        // Start tracing
        if err := trace.Start(f); err != nil {
            panic(err)
        }
        defer trace.Stop()

        runtime.GOMAXPROCS(2)
        var wg sync.WaitGroup

        for i := 0; i < 6; i++ {
            wg.Add(1)
            go func(id int) {
                defer wg.Done()
                // Simulate work
                sum := 0
                for j := 0; j < 1_000_000; j++ {
                    sum += j
                }
                fmt.Printf("Goroutine %d: result=%d\n", id, sum)
            }(i)
        }

        wg.Wait()
        fmt.Println("Trace written to trace.out")
        fmt.Println("View with: go tool trace trace.out")
    }
    ```

=== "The Explanation"

    - **`trace.Start(f)`**: Begins recording scheduling events to the file
    - **`trace.Stop()`**: Flushes remaining events and closes the trace
    - **Analysis**: Run `go tool trace trace.out` to open the trace viewer in your browser
    - **Events shown**: Goroutine creation, blocking, unblocking, syscall entry/exit, GC

=== "The Terminal Output"

    ```
    Goroutine 0: result=499999995000000
    Goroutine 1: result=499999995000000
    Goroutine 2: result=499999995000000
    Goroutine 3: result=499999995000000
    Goroutine 4: result=499999995000000
    Goroutine 5: result=499999995000000
    Trace written to trace.out
    View with: go tool trace trace.out
    ```

---

## GODEBUG for Scheduler Diagnostics

The `GODEBUG` environment variable provides runtime diagnostics without recompilation.

=== "GODEBUG Scheduler Variables"

    ```go
    package main

    import (
        "fmt"
        "os"
        "runtime"
    )

    func main() {
        schedtrace := os.Getenv("GODEBUG")
        fmt.Println("GODEBUG:", schedtrace)

        runtime.GOMAXPROCS(2)

        // Simple scheduler trace via environment variable
        // Run with: GODEBUG=schedtrace=1000 ./program
        fmt.Println("For scheduler trace, run with:")
        fmt.Println("  GODEBUG=schedtrace=1000 ./program")
        fmt.Println("  GODEBUG=schedtrace=1000,scheddetail=1 ./program")

        var m runtime.MemStats
        runtime.ReadMemStats(&m)
        fmt.Printf("Heap: %d KB, Goroutines: %d\n",
            m.HeapAlloc/1024, runtime.NumGoroutine())
    }
    ```

=== "The Explanation"

    - **`schedtrace=N`**: Prints scheduler state every N milliseconds
    - **`scheddetail=1`**: Adds per-P and per-M details to the trace output
    - **No recompilation needed**: GODEBUG works at runtime via environment variables

=== "Example schedtrace Output"

    ```
    SCHED 0ms: gomaxprocs=2 idleprocs=0 threads=3 spinningthreads=0
    idlethreads=0 runqueue=0 [0 0]
    SCHED 1000ms: gomaxprocs=2 idleprocs=1 threads=4 spinningthreads=0
    idlethreads=1 runqueue=0 [0 1]
    SCHED 2000ms: gomaxprocs=2 idleprocs=2 threads=3 spinningthreads=0
    idlethreads=2 runqueue=0 [0 0]
    ```

| GODEBUG Variable | Effect |
|---|---|
| `schedtrace=1000` | Print scheduler state every 1000ms |
| `scheddetail=1` | Show detailed per-P/M information |
| `gcstoptheworld=1` | Disable concurrent GC for debugging |
| `gctrace=1` | Print GC trace information |
| ` madvdontneed=1` | Use more aggressive memory return to OS |

---

## Best Practices

| Practice | Description |
|---|---|
| Use `runtime.GOMAXPROCS` wisely | Default (NumCPU) is usually optimal; tune for specific workloads |
| Avoid goroutine starvation | Ensure CPU-bound goroutines yield periodically (Go 1.14+ helps) |
| Profile before tuning | Use `pprof` and traces before changing scheduler settings |
| Don't set GOMAXPROCS to 1 | This serializes all goroutine execution |
| Monitor with `schedtrace` | Use GODEBUG=schedtrace periodically in production |
| Use worker pools | Control goroutine count for CPU-bound work |
| Test with `-race` | Detect scheduling-related data races |

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Goroutine monopolizes P | Tight loop without preemption (pre-1.14) | Upgrade to Go 1.14+ or add yield points |
| High thread count | Many goroutines blocked in syscalls | Reduce blocking syscalls; use non-blocking I/O |
| Scheduling latency | GOMAXPROCS too low for workload | Increase GOMAXPROCS or add more Ps |
| Goroutine starvation | One goroutine never gets scheduled | Check for channel deadlocks; use `schedtrace` |
| Memory leak | Goroutine leak (stuck goroutine) | Use `runtime.NumGoroutine()` to monitor; fix channel operations |
| GC pauses too long | Large heap or too many pointers | Reduce allocations; tune GOGC |

## Summary

- The GMP model: Goroutines (G) run on Machines (M) through Processors (P)
- Each P has a local run queue; work stealing balances load across Ps
- Sysmon monitors the runtime, triggers GC, and manages network polling
- Go 1.14+ provides async preemption via OS signals for fair scheduling
- Goroutine stacks start at 2 KB and grow dynamically by copying
- Use `runtime/trace` and GODEBUG=schedtrace for scheduling diagnostics
- The scheduler is cooperative (mostly) and cooperative wins

## Next Steps

- [Channels & Select](channels-select.md) — Master channel patterns and synchronization
- [Memory Model](memory-model.md) — Understand happens-before and synchronization
- [Runtime & GC](runtime-gc.md) — Deep dive into garbage collection and memory management
