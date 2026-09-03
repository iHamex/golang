# Concurrency Model

Go's concurrency model is one of its most distinguishing features. Built around goroutines and channels, it provides a lightweight, efficient approach to concurrent programming rooted in Communicating Sequential Processes (CSP). Unlike traditional thread-based models, Go encourages you to communicate between goroutines rather than share memory.

## What You Will Learn

- How goroutines differ from OS threads
- The CSP (Communicating Sequential Processes) model
- The philosophy: "Do not communicate by sharing memory; share memory by communicating"
- M:N scheduling and how Go maps goroutines to OS threads
- The goroutine lifecycle from creation to termination
- When to use concurrency and when to avoid it
- The difference between concurrency and parallelism

## Prerequisites

- Basic understanding of Go syntax and functions
- Familiarity with the concept of threads (helpful but not required)
- Go 1.14 or later installed

---

## Goroutines vs OS Threads

Goroutines are lightweight managed threads that run within the Go runtime. They are fundamentally different from OS threads in cost, flexibility, and management.

| Feature | OS Thread | Goroutine |
|---|---|---|
| Stack Size | Fixed (typically 1-8 MB) | Dynamic (starts at 2 KB, grows/shrinks) |
| Creation Cost | Expensive (syscalls) | Cheap (few hundred bytes) |
| Context Switching | Kernel-managed, expensive | User-space, cheap |
| Scheduling | OS scheduler | Go runtime scheduler |
| Count Practical Limit | Thousands | Millions |
| Communication | Shared memory, mutexes | Channels, shared memory |

=== "Goroutine vs Thread Example"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "sync"
        "time"
    )

    func main() {
        fmt.Println("OS Threads used by Go runtime:", runtime.GOMAXPROCS(0))

        var wg sync.WaitGroup
        start := time.Now()

        // Launch 10,000 goroutines
        for i := 0; i < 10_000; i++ {
            wg.Add(1)
            go func(id int) {
                defer wg.Done()
                // Simulate lightweight work
                time.Sleep(10 * time.Millisecond)
            }(i)
        }

        wg.Wait()
        fmt.Printf("Launched 10,000 goroutines in %v\n", time.Since(start))
        fmt.Println("Goroutines remaining:", runtime.NumGoroutine())
    }
    ```

=== "The Explanation"

    - **`runtime.GOMAXPROCS(0)`**: Returns the current number of OS threads used by the runtime
    - **`go func()`**: Launches a new goroutine; the function runs concurrently
    - **`sync.WaitGroup`**: Coordinates goroutine completion
    - **`runtime.NumGoroutine()`**: Reports the number of active goroutines

=== "The Terminal Output"

    ```
    OS Threads used by Go runtime: 8
    Launched 10,000 goroutines in 10.12ms
    Goroutines remaining: 1
    ```

---

## The CSP Model

CSP (Communicating Sequential Processes) is a formal language for describing patterns of interaction in concurrent systems. Go's implementation is inspired by Tony Hoare's 1978 paper.

The core principle: independent processes (goroutines) communicate through synchronized message passing (channels) rather than through shared state.

=== "CSP in Practice"

    ```go
    package main

    import "fmt"

    func producer(ch chan<- int) {
        for i := 0; i < 5; i++ {
            fmt.Printf("Producing: %d\n", i)
            ch <- i
        }
        close(ch)
    }

    func consumer(ch <-chan int, done chan<- struct{}) {
        for val := range ch {
            fmt.Printf("Consumed: %d\n", val)
        }
        done <- struct{}{}
    }

    func main() {
        ch := make(chan int)
        done := make(chan struct{})

        go producer(ch)
        go consumer(ch, done)

        <-done
        fmt.Println("All items processed")
    }
    ```

=== "The Explanation"

    - **`chan<- int`**: Send-only channel — the producer can only send values
    - **`<-chan int`**: Receive-only channel — the producer can only receive values
    - **`struct{}{}`**: Zero-size struct used as a signal; no data transmitted
    - **CSP Principle**: Producer and consumer never share memory; they communicate exclusively through the channel

=== "The Terminal Output"

    ```
    Producing: 0
    Consumed: 0
    Producing: 1
    Consumed: 1
    Producing: 2
    Consumed: 2
    Producing: 3
    Consumed: 3
    Producing: 4
    Consumed: 4
    All items processed
    ```

!!! go "The CSP Mantra"
    "Do not communicate by sharing memory; instead, share memory by communicating." — This is Go's official concurrency guideline. Channels are the primary mechanism for coordination between goroutines.

---

## M:N Scheduling

Go uses an M:N scheduler, meaning it maps M goroutines onto N OS threads. The Go runtime handles this mapping transparently.

- **M** = number of goroutines (can be millions)
- **N** = number of OS threads (typically equal to `GOMAXPROCS`, default = number of CPUs)

This is managed by three key components:

| Component | Symbol | Description |
|---|---|---|
| Goroutine | G | Lightweight concurrent task |
| Machine (Thread) | M | OS thread that executes goroutines |
| Processor | P | Logical processor holding a local run queue |

=== "GOMAXPROCS Demonstration"

    ```go
    package main

    import (
        "fmt"
        "runtime"
    )

    func main() {
        // Default GOMAXPROCS
        fmt.Println("Default GOMAXPROCS:", runtime.GOMAXPROCS(0))

        // Set to 1 — all goroutines on one OS thread
        runtime.GOMAXPROCS(1)
        fmt.Println("After set to 1:", runtime.GOMAXPROCS(0))

        // Set to number of CPUs
        numCPU := runtime.NumCPU()
        runtime.GOMAXPROCS(numCPU)
        fmt.Println("Set to NumCPU:", runtime.GOMAXPROCS(0))
        fmt.Println("Number of CPUs:", numCPU)
    }
    ```

=== "The Explanation"

    - **`runtime.GOMAXPROCS(n)`**: Sets the maximum number of OS threads that can execute user-level Go code simultaneously
    - **`runtime.NumCPU()`**: Returns the number of logical CPUs available
    - **Default value**: Equal to the number of available CPUs since Go 1.5

=== "The Terminal Output"

    ```
    Default GOMAXPROCS: 8
    After set to 1: 1
    Set to NumCPU: 8
    Number of CPUs: 8
    ```

---

## Goroutine Lifecycle

A goroutine goes through several states during its lifetime. Understanding these states is critical for debugging concurrency issues.

| State | Description | Transition |
|---|---|---|
| `_Gidle` | Just allocated, not yet initialized | → `_Grunnable` |
| `_Grunnable` | Ready to run, waiting for scheduling | → `_Grunning` |
| `_Grunning` | Actively executing on an M | → `_Gsyscall`, `_Gwaiting`, `_Grunnable` |
| `_Gsyscall` | Making a system call | → `_Grunnable` |
| `_Gwaiting` | Blocked (channel, mutex, sleep, I/O) | → `_Grunnable` |
| `_Gdead` | Finished execution | Terminal state |

=== "Goroutine Lifecycle Tracking"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "sync"
        "time"
    )

    func trackedGoroutine(id int, wg *sync.WaitGroup) {
        defer wg.Done()
        defer fmt.Printf("Goroutine %d: finished\n", id)

        fmt.Printf("Goroutine %d: started (goroutines: %d)\n",
            id, runtime.NumGoroutine())

        time.Sleep(50 * time.Millisecond)

        fmt.Printf("Goroutine %d: about to finish (goroutines: %d)\n",
            id, runtime.NumGoroutine())
    }

    func main() {
        var wg sync.WaitGroup

        for i := 0; i < 3; i++ {
            wg.Add(1)
            go trackedGoroutine(i, &wg)
        }

        fmt.Printf("Main: waiting (goroutines: %d)\n", runtime.NumGoroutine())
        wg.Wait()
        fmt.Printf("Main: done (goroutines: %d)\n", runtime.NumGoroutine())
    }
    ```

=== "The Explanation"

    - **`defer wg.Done()`**: Ensures the WaitGroup counter decrements when the goroutine finishes
    - **`runtime.NumGoroutine()`**: Tracks how many goroutines are alive at each point
    - **State transitions**: Each goroutine transitions through idle → runnable → running → waiting → dead

=== "The Terminal Output"

    ```
    Main: waiting (goroutines: 4)
    Goroutine 0: started (goroutines: 4)
    Goroutine 1: started (goroutines: 4)
    Goroutine 2: started (goroutines: 4)
    Goroutine 0: about to finish (goroutines: 4)
    Goroutine 0: finished
    Goroutine 1: about to finish (goroutines: 4)
    Goroutine 1: finished
    Goroutine 2: about to finish (goroutines: 4)
    Goroutine 2: finished
    Main: done (goroutines: 1)
    ```

---

## When to Use Concurrency

Not every problem benefits from concurrency. Use it when tasks are independent and can overlap in time.

| Use Concurrency | Avoid Concurrency |
|---|---|
| Independent I/O operations (HTTP calls, file reads) | Simple sequential calculations |
| Worker pools processing jobs | Operations with tight data dependencies |
| Periodic background tasks (health checks) | Short-lived tasks where overhead exceeds benefit |
| Real-time event handling | Single-core environments with no I/O wait |
| Fan-out/fan-in data processing | When correctness is hard to prove with races |

=== "Practical Concurrency: HTTP Fetcher"

    ```go
    package main

    import (
        "fmt"
        "io"
        "net/http"
        "sync"
        "time"
    )

    func fetchURL(url string, wg *sync.WaitGroup, results chan<- string) {
        defer wg.Done()

        start := time.Now()
        resp, err := http.Get(url)
        if err != nil {
            results <- fmt.Sprintf("ERROR %s: %v", url, err)
            return
        }
        defer resp.Body.Close()

        body, _ := io.ReadAll(resp.Body)
        elapsed := time.Since(start)
        results <- fmt.Sprintf("OK %s: %d bytes in %v", url, len(body), elapsed)
    }

    func main() {
        urls := []string{
            "https://httpbin.org/delay/1",
            "https://httpbin.org/delay/2",
            "https://httpbin.org/delay/1",
            "https://httpbin.org/get",
        }

        var wg sync.WaitGroup
        results := make(chan string, len(urls))

        start := time.Now()
        for _, url := range urls {
            wg.Add(1)
            go fetchURL(url, &wg, results)
        }

        go func() {
            wg.Wait()
            close(results)
        }()

        for result := range results {
            fmt.Println(result)
        }
        fmt.Printf("Total time: %v\n", time.Since(start))
    }
    ```

=== "The Explanation"

    - **Buffered channel**: `make(chan string, len(urls))` prevents blocking since we know the exact count
    - **Fan-out**: Multiple goroutines fetch URLs concurrently
    - **Fan-in**: Results channel collects all responses
    - **Sequential would take**: ~5 seconds (1+2+1+1); **concurrent takes**: ~2 seconds (max delay)

=== "The Terminal Output"

    ```
    OK https://httpbin.org/get: 280 bytes in 245.12ms
    OK https://httpbin.org/delay/1: 280 bytes in 1.021s
    OK https://httpbin.org/delay/1: 280 bytes in 1.023s
    OK https://httpbin.org/delay/2: 280 bytes in 2.045s
    Total time: 2.046s
    ```

---

## Concurrency vs Parallelism

These terms are often confused. Rob Pike defined them clearly:

- **Concurrency**: Dealing with multiple things at once (composition)
- **Parallelism**: Doing multiple things at once (execution)

=== "Visual Difference"

    ```go
    package main

    import (
        "fmt"
        "runtime"
        "sync"
        "time"
    )

    func work(id int) {
        fmt.Printf("Worker %d started on OS thread %d\n", id, getThreadID())
        time.Sleep(100 * time.Millisecond)
        fmt.Printf("Worker %d finished\n", id)
    }

    func getThreadID() int {
        // Simple approximation using goroutine ID
        var buf [64]byte
        n := runtime.Stack(buf[:], false)
        var id int
        fmt.Sscanf(string(buf[:n]), "goroutine %d", &id)
        return id
    }

    func concurrentButNotParallel() {
        runtime.GOMAXPROCS(1)
        fmt.Println("=== Sequential (no concurrency) ===")
        start := time.Now()
        for i := 0; i < 4; i++ {
            work(i)
        }
        fmt.Printf("Time: %v\n\n", time.Since(start))
    }

    func concurrentAndParallel() {
        runtime.GOMAXPROCS(4)
        fmt.Println("=== Concurrent and Parallel ===")
        var wg sync.WaitGroup
        start := time.Now()
        for i := 0; i < 4; i++ {
            wg.Add(1)
            go func(id int) {
                defer wg.Done()
                work(id)
            }(i)
        }
        wg.Wait()
        fmt.Printf("Time: %v\n", time.Since(start))
    }

    func main() {
        concurrentButNotParallel()
        concurrentAndParallel()
    }
    ```

=== "The Explanation"

    - **`GOMAXPROCS(1)`**: Forces serial execution — concurrency still works (goroutines take turns) but no parallelism
    - **`GOMAXPROCS(4)`**: Allows true parallelism — goroutines execute on separate OS threads simultaneously
    - **Key insight**: You can have concurrency without parallelism, but parallelism requires concurrency

=== "The Terminal Output"

    ```
    === Sequential (no concurrency) ===
    Worker 0 started on OS thread 1
    Worker 0 finished
    Worker 1 started on OS thread 1
    Worker 1 finished
    Worker 2 started on OS thread 1
    Worker 2 finished
    Worker 3 started on OS thread 1
    Worker 3 finished
    Time: 400.5ms

    === Concurrent and Parallel ===
    Worker 0 started on OS thread 1
    Worker 1 started on OS thread 1
    Worker 2 started on OS thread 1
    Worker 3 started on OS thread 1
    Worker 2 finished
    Worker 0 finished
    Worker 1 finished
    Worker 3 finished
    Time: 101.2ms
    ```

!!! note "Key Distinction"
    Concurrency is about structure and composition. Parallelism is about execution. Go provides both through its runtime scheduler.

---

## Best Practices

| Practice | Description |
|---|---|
| Use `sync.WaitGroup` | Always wait for goroutines to finish in main or parent goroutines |
| Prefer channels over mutex | Follow Go's CSP philosophy when possible |
| Avoid goroutine leaks | Ensure every goroutine has a clear exit path |
| Use buffered channels | When you know the exact count to prevent blocking |
| Don't spawn unbounded goroutines | Use worker pools for controlled concurrency |
| Use context for cancellation | Propagate timeouts and cancellation through `context.Context` |
| Run with `-race` flag | Detect data races during development |

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Goroutine leak | Blocked on channel with no sender/receiver | Ensure channel communication pairs are complete |
| Deadlock error | All goroutines blocked, nothing can proceed | Check channel direction and synchronization |
| Race condition | Unsynchronized shared memory access | Use channels, mutexes, or atomic operations |
| High memory usage | Too many goroutines with large stacks | Use worker pools; limit concurrent goroutines |
| Unexpected ordering | Assuming deterministic goroutine scheduling | Don't rely on goroutine execution order |
| Panic in goroutine | Unrecovered panic crashes the program | Use `defer recover()` in every goroutine |

## Summary

- Goroutines are lightweight (2 KB initial stack), created with the `go` keyword
- Go's concurrency model is based on CSP: communicate through channels, don't share memory
- M:N scheduling maps many goroutines onto fewer OS threads automatically
- Goroutines transition through idle → runnable → running → waiting → dead states
- Concurrency is about structure; parallelism is about simultaneous execution
- Always use `sync.WaitGroup` or channels to coordinate goroutine completion
- Use the `-race` detector to catch data races during development

## Next Steps

- [Goroutines & Scheduler](goroutines-scheduler.md) — Deep dive into the GMP scheduling model
- [Channels & Select](channels-select.md) — Master channel patterns and the select statement
- [Memory Model](memory-model.md) — Understand happens-before guarantees and synchronization primitives
