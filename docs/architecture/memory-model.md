# Memory Model

Go's memory model defines the conditions under which writes to memory by one goroutine are guaranteed to be visible to reads by another goroutine. Understanding the memory model is critical for writing correct concurrent programs and avoiding subtle data races that may only manifest under specific scheduling conditions.

## What You Will Learn

- The happens-before relationship and why it matters
- What data races are and how they occur
- Using `sync.Mutex` and `sync.RWMutex` for mutual exclusion
- `sync.Once` for one-time initialization
- Atomic operations for lock-free synchronization
- Memory visibility across goroutines
- Using the race detector (`-race` flag) to catch bugs

## Prerequisites

- Understanding of [goroutines](concurrency-model.md) and [channels](channels-select.md)
- Familiarity with Go function syntax
- Go 1.19 or later (for updated memory model specification)

---

## The Happens-Before Relationship

The Go memory model is defined in terms of *happens-before* ordering. If event A happens before event B, then A's effects are guaranteed to be visible to B.

| Happens-Before Guarantee | Description |
|---|---|
| Goroutine launch | `go f()` happens before `f()` starts executing |
| Channel send | Send happens before corresponding receive completes |
| Channel close | `close(ch)` happens before receive of zero value from closed `ch` |
| Mutex unlock | `mu.Unlock()` happens before next `mu.Lock()` |
| `sync.Once` | `Once.Do(f)` — `f()` returns happens before any `Once.Do` call returns |
| `sync.WaitGroup` | `wg.Wait()` returns after all `wg.Done()` calls |
| `sync.Cond` | `Broadcast`/`Signal` happens before corresponding `Wait` returns |

=== "Happens-Before Visualization"

    ```go
    package main

    import (
        "fmt"
        "sync"
    )

    func main() {
        var data int
        var wg sync.WaitGroup
        var mu sync.Mutex

        // Goroutine 1 writes
        wg.Add(1)
        go func() {
            defer wg.Done()
            mu.Lock()
            data = 42 // Write happens
            mu.Unlock()
        }()

        // Goroutine 2 reads
        wg.Add(1)
        go func() {
            defer wg.Done()
            mu.Lock()
            value := data // Read happens after write (guaranteed)
            mu.Unlock()
            fmt.Printf("Read value: %d\n", value)
        }()

        wg.Wait()
    }
    ```

=== "The Explanation"

    - **`mu.Lock()` / `mu.Unlock()`**: Establishes happens-before ordering between goroutines
    - **Without mutex**: The read might see 0 (stale) or 42 — a data race
    - **With mutex**: The unlock by goroutine 1 happens-before the lock by goroutine 2, so the write is visible

=== "The Terminal Output"

    ```
    Read value: 42
    ```

!!! go "Why Happens-Before Matters"
    Without happens-before guarantees, the compiler and CPU may reorder instructions, cache values in registers, or optimize away reads. The memory model specifies exactly when these transformations are safe.

---

## Data Races

A data race occurs when two goroutines access the same memory location concurrently, at least one access is a write, and there is no synchronization between them.

=== "Data Race Example"

    ```go
    package main

    import (
        "fmt"
        "sync"
    )

    func main() {
        counter := 0
        var wg sync.WaitGroup

        // This code has a DATA RACE — do NOT do this
        for i := 0; i < 1000; i++ {
            wg.Add(1)
            go func() {
                defer wg.Done()
                counter++ // Race: read-modify-write is not atomic
            }()
        }

        wg.Wait()
        fmt.Printf("Counter: %d (expected 1000, but likely less)\n", counter)
    }
    ```

=== "The Explanation"

    - **`counter++`**: This is three operations: read, increment, write — not atomic
    - **Race condition**: Two goroutines may read the same value before either writes
    - **Unpredictable result**: The final value depends on goroutine scheduling
    - **Run with `-race`**: `go run -race main.go` detects this race

=== "The Terminal Output"

    ```
    Counter: 847 (expected 1000, but likely less)
    ```

!!! danger "Data Races Are Undefined Behavior"
    Data races in Go are undefined behavior. They can cause crashes, corrupted data, incorrect results, and silent failures. Always use the race detector during development.

---

## sync.Mutex

`sync.Mutex` provides mutual exclusion. Only one goroutine can hold the mutex at a time, ensuring critical sections execute atomically.

=== "Mutex for Shared State"

    ```go
    package main

    import (
        "fmt"
        "sync"
    )

    type SafeCounter struct {
        mu    sync.Mutex
        value int
    }

    func (c *SafeCounter) Inc() {
        c.mu.Lock()
        defer c.mu.Unlock()
        c.value++
    }

    func (c *SafeCounter) Get() int {
        c.mu.Lock()
        defer c.mu.Unlock()
        return c.value
    }

    func main() {
        counter := &SafeCounter{}
        var wg sync.WaitGroup

        for i := 0; i < 1000; i++ {
            wg.Add(1)
            go func() {
                defer wg.Done()
                counter.Inc()
            }()
        }

        wg.Wait()
        fmt.Printf("Safe counter: %d\n", counter.Get())
    }
    ```

=== "The Explanation"

    - **`sync.Mutex`**: Protects the `value` field from concurrent access
    - **`Lock()` / `Unlock()`**: Only one goroutine can hold the lock at a time
    - **`defer c.mu.Unlock()`**: Ensures unlock even if a panic occurs
    - **Happens-before**: Unlock in one goroutine happens-before lock in another

=== "The Terminal Output"

    ```
    Safe counter: 1000
    ```

| Mutex Operation | Effect |
|---|---|
| `mu.Lock()` | Acquires the lock; blocks if already held |
| `mu.Unlock()` | Releases the lock; wakes one waiting goroutine |
| `mu.TryLock()` | Attempts to acquire without blocking (Go 1.18+) |

---

## sync.RWMutex

`sync.RWMutex` allows multiple concurrent readers or one exclusive writer. Use it when reads significantly outnumber writes.

=== "RWMutex for Read-Heavy Workloads"

    ```go
    package main

    import (
        "fmt"
        "sync"
        "time"
    )

    type Cache struct {
        mu   sync.RWMutex
        data map[string]string
    }

    func NewCache() *Cache {
        return &Cache{data: make(map[string]string)}
    }

    func (c *Cache) Get(key string) (string, bool) {
        c.mu.RLock()
        defer c.mu.RUnlock()
        val, ok := c.data[key]
        return val, ok
    }

    func (c *Cache) Set(key, value string) {
        c.mu.Lock()
        defer c.mu.Unlock()
        c.data[key] = value
    }

    func main() {
        cache := NewCache()
        var wg sync.WaitGroup

        // Writer
        go func() {
            for i := 0; i < 5; i++ {
                cache.Set(fmt.Sprintf("key%d", i), fmt.Sprintf("value%d", i))
                time.Sleep(10 * time.Millisecond)
            }
        }()

        // Multiple concurrent readers
        for r := 0; r < 3; r++ {
            wg.Add(1)
            go func(reader int) {
                defer wg.Done()
                for i := 0; i < 10; i++ {
                    val, ok := cache.Get(fmt.Sprintf("key%d", i%5))
                    if ok {
                        fmt.Printf("Reader %d: key → %s\n", reader, val)
                    }
                    time.Sleep(5 * time.Millisecond)
                }
            }(r)
        }

        wg.Wait()
        fmt.Println("All readers and writer completed")
    }
    ```

=== "The Explanation"

    - **`RLock()` / `RUnlock()`**: Shared read lock — multiple goroutines can hold simultaneously
    - **`Lock()` / `Unlock()`**: Exclusive write lock — blocks all other readers and writers
    - **Performance**: Readers don't block each other; only writers cause exclusion

=== "The Terminal Output"

    ```
    Reader 0: key → value0
    Reader 1: key → value0
    Reader 2: key → value0
    Reader 0: key → value1
    Reader 1: key → value1
    ...
    All readers and writer completed
    ```

| Lock Type | Multiple Readers | Multiple Writers | Use Case |
|---|---|---|---|
| `sync.Mutex` | No | No | General mutual exclusion |
| `sync.RWMutex` | Yes | No | Read-heavy workloads |

---

## sync.Once

`sync.Once` ensures a function is executed exactly once, even when called from multiple goroutines. It is thread-safe and efficient.

=== "One-Time Initialization"

    ```go
    package main

    import (
        "fmt"
        "sync"
    )

    type Database struct {
        conn string
    }

    var (
        dbInstance *Database
        dbOnce     sync.Once
    )

    func getDatabase() *Database {
        dbOnce.Do(func() {
            fmt.Println("Initializing database connection (only once!)")
            dbInstance = &Database{conn: "postgres://localhost/mydb"}
        })
        return dbInstance
    }

    func main() {
        var wg sync.WaitGroup

        // 10 goroutines try to initialize — only one actually does
        for i := 0; i < 10; i++ {
            wg.Add(1)
            go func(id int) {
                defer wg.Done()
                db := getDatabase()
                fmt.Printf("Goroutine %d: db=%v\n", id, db.conn)
            }(i)
        }

        wg.Wait()
    }
    ```

=== "The Explanation"

    - **`sync.Once.Do(f)`**: Ensures `f` is executed exactly once across all goroutines
    - **Thread-safe**: No race conditions even with concurrent calls
    - **Efficient**: After first call, subsequent `Do` calls return immediately without locking
    - **Common use**: Singleton initialization, lazy loading

=== "The Terminal Output"

    ```
    Initializing database connection (only once!)
    Goroutine 0: db=postgres://localhost/mydb
    Goroutine 1: db=postgres://localhost/mydb
    Goroutine 2: db=postgres://localhost/mydb
    Goroutine 3: db=postgres://localhost/mydb
    Goroutine 4: db=postgres://localhost/mydb
    Goroutine 5: db=postgres://localhost/mydb
    Goroutine 6: db=postgres://localhost/mydb
    Goroutine 7: db=postgres://localhost/mydb
    Goroutine 8: db=postgres://localhost/mydb
    Goroutine 9: db=postgres://localhost/mydb
    ```

!!! go "sync.Once Guarantee"
    The function passed to `Once.Do` is guaranteed to complete before any other `Once.Do` call returns. This establishes a happens-before relationship for initialization.

---

## Atomic Operations

The `sync/atomic` package provides low-level atomic operations that avoid the overhead of mutexes. They are ideal for simple counters, flags, and status values.

=== "Atomic Operations for Counters"

    ```go
    package main

    import (
        "fmt"
        "sync"
        "sync/atomic"
    )

    type AtomicCounter struct {
        value int64
    }

    func (c *AtomicCounter) Inc() {
        atomic.AddInt64(&c.value, 1)
    }

    func (c *AtomicCounter) Get() int64 {
        return atomic.LoadInt64(&c.value)
    }

    func (c *AtomicCounter) CompareAndSwap(old, new int64) bool {
        return atomic.CompareAndSwapInt64(&c.value, old, new)
    }

    func main() {
        counter := &AtomicCounter{}
        var wg sync.WaitGroup

        for i := 0; i < 1000; i++ {
            wg.Add(1)
            go func() {
                defer wg.Done()
                counter.Inc()
            }()
        }

        wg.Wait()
        fmt.Printf("Atomic counter: %d\n", counter.Get())

        // CAS example
        old := counter.Get()
        swapped := counter.CompareAndSwap(old, old+100)
        fmt.Printf("CAS: old=%d, swapped=%v, new=%d\n", old, swapped, counter.Get())
    }
    ```

=== "The Explanation"

    - **`atomic.AddInt64`**: Atomically adds a value — no mutex needed
    - **`atomic.LoadInt64`**: Atomically reads the current value
    - **`atomic.CompareAndSwapInt64`**: CAS operation — swaps only if current matches expected
    - **Performance**: Atomic operations are faster than mutexes for simple operations

=== "The Terminal Output"

    ```
    Atomic counter: 1000
    CAS: old=1000, swapped=true, new=1100
    ```

| Atomic Operation | Description |
|---|---|
| `AddInt64(&v, n)` | Atomically adds n to v |
| `LoadInt64(&v)` | Atomically reads v |
| `StoreInt64(&v, n)` | Atomically stores n to v |
| `SwapInt64(&v, n)` | Atomically sets v to n, returns old value |
| `CompareAndSwapInt64(&v, old, new)` | CAS: sets new if v == old |

---

## Memory Visibility

Without synchronization, changes made by one goroutine may not be visible to another. The Go memory model only guarantees visibility when proper synchronization is used.

=== "Memory Visibility Demonstration"

    ```go
    package main

    import (
        "fmt"
        "sync"
        "sync/atomic"
    )

    func main() {
        // Without synchronization — UNSAFE
        var unsafeVal int
        var wg sync.WaitGroup

        wg.Add(1)
        go func() {
            defer wg.Done()
            unsafeVal = 42 // Write in goroutine
        }()

        wg.Wait()
        // unsafeVal might be 0 or 42 — no guarantee
        fmt.Println("Unsafe value:", unsafeVal)

        // With atomic — SAFE
        var atomicVal int64
        var wg2 sync.WaitGroup

        wg2.Add(1)
        go func() {
            defer wg2.Done()
            atomic.StoreInt64(&atomicVal, 42) // Atomic write
        }()

        wg2.Wait()
        fmt.Printf("Atomic value: %d (guaranteed visible)\n",
            atomic.LoadInt64(&atomicVal))
    }
    ```

=== "The Explanation"

    - **Unsafe variable**: Without synchronization, the write may never be seen by other goroutines
    - **Atomic variable**: `atomic.Store` and `atomic.Load` ensure visibility
    - **Hardware barrier**: Atomic operations include memory barriers that force cache coherence

=== "The Terminal Output"

    ```
    Atomic value: 42 (guaranteed visible)
    ```

!!! note "Visibility Without Synchronization"
    Go does not guarantee that writes by one goroutine are visible to another without explicit synchronization (mutex, atomic, channel, etc.). Always use synchronization primitives when sharing data.

---

## The Race Detector

Go includes a built-in race detector that finds data races at runtime. It instruments all memory accesses and checks for unsynchronized concurrent access.

=== "Using the Race Detector"

    ```go
    package main

    import (
        "fmt"
        "sync"
    )

    func main() {
        // Race detector example — run with: go run -race main.go
        counter := 0
        var wg sync.WaitGroup

        for i := 0; i < 100; i++ {
            wg.Add(1)
            go func() {
                defer wg.Done()
                counter++ // DATA RACE
            }()
        }

        wg.Wait()
        fmt.Println("Run this with: go run -race main.go")
        fmt.Println("The race detector will report the data race")
    }
    ```

=== "The Explanation"

    - **`-race` flag**: Enables the race detector at compile time
    - **Runtime overhead**: ~2-10x slowdown, ~5-10x memory increase
    - **Production use**: Disable in production due to overhead; use in testing/CI

=== "Example Race Detector Output"

    ```
    ==================
    WARNING: DATA RACE
    Read at 0x00c0000b4010 by goroutine 8:
      main.main.func1()
          /path/to/main.go:14 +0x38

    Previous write at 0x00c0000b4010 by goroutine 7:
      main.main.func1()
          /path/to/main.go:14 +0x4c

    Goroutine 8 (running) created at:
      main.main()
          /path/to/main.go:12 +0x88

    Goroutine 7 (running) created at:
      main.main()
          /path/to/main.go:12 +0x88
    ==================
    ```

!!! danger "Always Use -race in Development"
    Run `go test -race ./...` as part of your CI pipeline. The race detector catches bugs that are otherwise nearly impossible to reproduce deterministically.

| Race Detector Flag | Effect |
|---|---|
| `go run -race` | Run with race detection enabled |
| `go test -race` | Test with race detection enabled |
| `go build -race` | Build with race instrumentation |
| `GORACE="history_size=5"` | Configure race detector options |

---

## Best Practices

| Practice | Description |
|---|---|
| Always use `-race` in CI | Detect data races before they reach production |
| Use channels for communication | Follow Go's "share by communicating" philosophy |
| Use mutexes for shared state | When channels are impractical (caches, counters) |
| Use atomics for simple values | Lock-free counters, flags, and status values |
| Prefer `sync.Once` | For lazy one-time initialization |
| Document synchronization | Comment which fields require synchronization |
| Minimize shared state | Reduce the scope of data that needs synchronization |

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Race detector finds a race | Unsynchronized concurrent access | Add mutex, atomic, or channel synchronization |
| Deadlock with mutex | Same goroutine locks twice (non-reentrant) | Refactor to avoid re-locking; mutexes are not reentrant |
| High contention | Many goroutines fighting for one lock | Reduce lock scope; use RWMutex for read-heavy workloads |
| False sharing | Cache line contention between atomic variables | Pad variables to cache line boundaries |
| Data race not detected | Race only occurs under specific timing | Run with `-count=100` to increase detection probability |
| Performance regression after adding mutex | Excessive locking | Use atomic operations or reduce critical section size |

## Summary

- The memory model defines happens-before relationships between goroutine operations
- Data races occur with unsynchronized concurrent reads and writes — always use `-race`
- `sync.Mutex` provides mutual exclusion; `sync.RWMutex` allows concurrent readers
- `sync.Once` ensures thread-safe one-time initialization
- `sync/atomic` provides lock-free operations for simple values
- Without synchronization, memory writes may not be visible to other goroutines
- The race detector catches data races at runtime with ~2-10x overhead

## Next Steps

- [Runtime & GC](runtime-gc.md) — Understand garbage collection and memory management
- [Error Design Philosophy](error-design.md) — Learn Go's approach to error handling
- [Concurrency Model](concurrency-model.md) — Review CSP principles and goroutine fundamentals
