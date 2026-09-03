# Sync Primitives

Go's `sync` package provides synchronization primitives for concurrent programming. Understanding these primitives is essential for building efficient, thread-safe applications.

## What You Will Learn

- Protect shared state with `sync.Mutex` and `sync.RWMutex`
- Coordinate goroutines with `sync.WaitGroup`
- Initialize once with `sync.Once`
- Use concurrent maps with `sync.Map`
- Pool objects with `sync.Pool`
- Signal conditions with `sync.Cond`
- Use atomic operations with the `atomic` package
- Choose the right primitive for your use case

## Prerequisites

- Basic Go syntax and concurrency concepts
- Understanding of goroutines and channels
- Familiarity with race conditions

---

## Mutex for Mutual Exclusion

The `sync.Mutex` provides mutual exclusion locking to protect shared state from concurrent access.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sync"
    )

    // Counter with mutex protection
    type Counter struct {
        mu    sync.Mutex
        value int
    }

    // Increment safely increments the counter
    func (c *Counter) Increment() {
        c.mu.Lock()
        defer c.mu.Unlock()
        c.value++
    }

    // Decrement safely decrements the counter
    func (c *Counter) Decrement() {
        c.mu.Lock()
        defer c.mu.Unlock()
        c.value--
    }

    // Value safely returns the counter value
    func (c *Counter) Value() int {
        c.mu.Lock()
        defer c.mu.Unlock()
        return c.value
    }

    func main() {
        counter := &Counter{}
        var wg sync.WaitGroup

        // Start multiple goroutines
        for i := 0; i < 1000; i++ {
            wg.Add(1)
            go func() {
                defer wg.Done()
                counter.Increment()
            }()
        }

        for i := 0; i < 500; i++ {
            wg.Add(1)
            go func() {
                defer wg.Done()
                counter.Decrement()
            }()
        }

        wg.Wait()
        fmt.Println("Final counter value:", counter.Value())
    }
    ```

=== "The Explanation"

    - **sync.Mutex**: Provides exclusive locking
    - **Lock**: Acquires the lock (blocks if locked)
    - **Unlock**: Releases the lock
    - **defer**: Ensures unlock even on panic
    - **Critical section**: Code between Lock and Unlock

=== "The Terminal Output"

    ```
    Final counter value: 500
    ```

!!! go "Mutex vs Channels"
Use mutexes when protecting shared state that needs to be accessed by multiple goroutines. Use channels for communicating between goroutines.

## Read-Write Mutex

The `sync.RWMutex` allows multiple concurrent readers or exclusive writers.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sync"
        "time"
    )

    // Cache with read-write mutex
    type Cache struct {
        mu   sync.RWMutex
        data map[string]string
    }

    // NewCache creates a new cache
    func NewCache() *Cache {
        return &Cache{
            data: make(map[string]string),
        }
    }

    // Set adds or updates a value (write lock)
    func (c *Cache) Set(key, value string) {
        c.mu.Lock()
        defer c.mu.Unlock()
        c.data[key] = value
        fmt.Printf("Set: %s = %s\n", key, value)
    }

    // Get retrieves a value (read lock)
    func (c *Cache) Get(key string) (string, bool) {
        c.mu.RLock()
        defer c.mu.RUnlock()
        value, ok := c.data[key]
        return value, ok
    }

    // GetAll returns all values (read lock)
    func (c *Cache) GetAll() map[string]string {
        c.mu.RLock()
        defer c.mu.RUnlock()
        result := make(map[string]string)
        for k, v := range c.data {
            result[k] = v
        }
        return result
    }

    func main() {
        cache := NewCache()
        var wg sync.WaitGroup

        // Writers
        for i := 0; i < 10; i++ {
            wg.Add(1)
            go func(i int) {
                defer wg.Done()
                key := fmt.Sprintf("key%d", i)
                value := fmt.Sprintf("value%d", i)
                cache.Set(key, value)
                time.Sleep(10 * time.Millisecond)
            }(i)
        }

        // Readers
        for i := 0; i < 10; i++ {
            wg.Add(1)
            go func(i int) {
                defer wg.Done()
                key := fmt.Sprintf("key%d", i)
                time.Sleep(5 * time.Millisecond)
                value, ok := cache.Get(key)
                if ok {
                    fmt.Printf("Get: %s = %s\n", key, value)
                }
            }(i)
        }

        wg.Wait()
        fmt.Println("Final cache size:", len(cache.GetAll()))
    }
    ```

=== "The Explanation"

    - **sync.RWMutex**: Allows concurrent reads or exclusive writes
    - **RLock/RUnlock**: Read locks (multiple readers allowed)
    - **Lock/Unlock**: Write locks (exclusive access)
    - **Use case**: Read-heavy workloads

=== "The Terminal Output"

    ```
    Set: key0 = value0
    Set: key1 = value1
    Set: key2 = value2
    Set: key3 = value3
    Set: key4 = value4
    Set: key5 = value5
    Set: key6 = value6
    Set: key7 = value7
    Set: key8 = value8
    Set: key9 = value9
    Get: key0 = value0
    Get: key1 = value1
    Get: key2 = value2
    Get: key3 = value3
    Get: key4 = value4
    Get: key5 = value5
    Get: key6 = value6
    Get: key7 = value7
    Get: key8 = value8
    Get: key9 = value9
    Final cache size: 10
    ```

## WaitGroup for Goroutine Coordination

The `sync.WaitGroup` waits for a collection of goroutines to finish.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sync"
        "time"
    )

    func main() {
        var wg sync.WaitGroup

        // Start multiple workers
        for i := 1; i <= 5; i++ {
            wg.Add(1)
            go func(id int) {
                defer wg.Done()

                fmt.Printf("Worker %d starting\n", id)
                time.Sleep(time.Duration(id) * 100 * time.Millisecond)
                fmt.Printf("Worker %d finished\n", id)
            }(i)
        }

        // Wait for all workers
        fmt.Println("Waiting for workers...")
        wg.Wait()
        fmt.Println("All workers finished")
    }
    ```

=== "The Explanation"

    - **sync.WaitGroup**: Coordinates multiple goroutines
    - **Add**: Increments the counter
    - **Done**: Decrements the counter
    - **Wait**: Blocks until counter reaches zero
    - **Order**: Always Add before starting goroutine

=== "The Terminal Output"

    ```
    Waiting for workers...
    Worker 1 starting
    Worker 2 starting
    Worker 3 starting
    Worker 4 starting
    Worker 5 starting
    Worker 1 finished
    Worker 2 finished
    Worker 3 finished
    Worker 4 finished
    Worker 5 finished
    All workers finished
    ```

## Once for Single Initialization

The `sync.Once` ensures a function is executed only once, even with multiple goroutines.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sync"
    )

    // Database connection with once initialization
    type Database struct {
        once sync.Once
        conn string
    }

    // NewDatabase creates a new database
    func NewDatabase(conn string) *Database {
        return &Database{conn: conn}
    }

    // Connect connects to the database (only once)
    func (db *Database) Connect() string {
        db.once.Do(func() {
            fmt.Println("Connecting to database...")
            // Simulate expensive initialization
            fmt.Println("Database connected!")
        })
        return db.conn
    }

    func main() {
        db := NewDatabase("postgres://localhost:5432/mydb")
        var wg sync.WaitGroup

        // Multiple goroutines try to connect
        for i := 0; i < 5; i++ {
            wg.Add(1)
            go func(i int) {
                defer wg.Done()
                conn := db.Connect()
                fmt.Printf("Goroutine %d got connection: %s\n", i, conn)
            }(i)
        }

        wg.Wait()
    }
    ```

=== "The Explanation"

    - **sync.Once**: Executes function exactly once
    - **Do**: Takes a function to execute once
    - **Thread-safe**: Safe to call from multiple goroutines
    - **Use case**: Singletons, lazy initialization

=== "The Terminal Output"

    ```
    Connecting to database...
    Database connected!
    Goroutine 0 got connection: postgres://localhost:5432/mydb
    Goroutine 1 got connection: postgres://localhost:5432/mydb
    Goroutine 2 got connection: postgres://localhost:5432/mydb
    Goroutine 3 got connection: postgres://localhost:5432/mydb
    Goroutine 4 got connection: postgres://localhost:5432/mydb
    ```

## Sync.Map for Concurrent Maps

The `sync.Map` provides a concurrent-safe map optimized for specific use cases.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sync"
    )

    func main() {
        var m sync.Map
        var wg sync.WaitGroup

        // Store values
        for i := 0; i < 10; i++ {
            wg.Add(1)
            go func(i int) {
                defer wg.Done()
                key := fmt.Sprintf("key%d", i)
                value := i * 10
                m.Store(key, value)
                fmt.Printf("Stored: %s = %d\n", key, value)
            }(i)
        }

        wg.Wait()

        // Load values
        fmt.Println("\nLoading values:")
        m.Range(func(key, value interface{}) bool {
            fmt.Printf("Loaded: %s = %d\n", key, value)
            return true
        })

        // Load or store
        value, loaded := m.LoadOrStore("key0", 999)
        fmt.Printf("\nLoadOrStore key0: loaded=%v, value=%d\n", loaded, value)

        // Delete
        m.Delete("key0")
        _, exists := m.Load("key0")
        fmt.Printf("After delete key0: exists=%v\n", exists)

        // Count
        count := 0
        m.Range(func(_, _ interface{}) bool {
            count++
            return true
        })
        fmt.Printf("Final count: %d\n", count)
    }
    ```

=== "The Explanation"

    - **sync.Map**: Concurrent-safe map
    - **Store**: Adds key-value pair
    - **Load**: Retrieves value by key
    - **LoadOrStore**: Load or store if not exists
    - **Delete**: Removes key-value pair
    - **Range**: Iterates over all pairs

=== "The Terminal Output"

    ```
    Stored: key0 = 0
    Stored: key1 = 10
    Stored: key2 = 20
    Stored: key3 = 30
    Stored: key4 = 40
    Stored: key5 = 50
    Stored: key6 = 60
    Stored: key7 = 70
    Stored: key8 = 80
    Stored: key9 = 90

    Loading values:
    Loaded: key0 = 0
    Loaded: key1 = 10
    Loaded: key2 = 20
    Loaded: key3 = 30
    Loaded: key4 = 40
    Loaded: key5 = 50
    Loaded: key6 = 60
    Loaded: key7 = 70
    Loaded: key8 = 80
    Loaded: key9 = 90

    LoadOrStore key0: loaded=true, value=0
    After delete key0: exists=false
    Final count: 9
    ```

!!! note "When to Use sync.Map"
Use `sync.Map` when:
- Entries are written once but read many times
- Multiple goroutines read, write, and overwrite entries
- You need a concurrent map without type safety

## Pool for Object Reuse

The `sync.Pool` provides a pool of reusable objects to reduce memory allocation.

=== "The Code"

    ```go
    package main

    import (
        "bytes"
        "fmt"
        "sync"
    )

    // Buffer pool for bytes.Buffer
    var bufferPool = sync.Pool{
        New: func() interface{} {
            return new(bytes.Buffer)
        },
    }

    // GetBuffer gets a buffer from the pool
    func GetBuffer() *bytes.Buffer {
        return bufferPool.Get().(*bytes.Buffer)
    }

    // PutBuffer returns a buffer to the pool
    func PutBuffer(buf *bytes.Buffer) {
        buf.Reset()
        bufferPool.Put(buf)
    }

    func main() {
        var wg sync.WaitGroup

        // Use buffers from pool
        for i := 0; i < 10; i++ {
            wg.Add(1)
            go func(i int) {
                defer wg.Done()

                buf := GetBuffer()
                defer PutBuffer(buf)

                fmt.Fprintf(buf, "Message %d", i)
                result := buf.String()
                fmt.Printf("Goroutine %d: %s\n", i, result)
            }(i)
        }

        wg.Wait()

        // Pool stats
        fmt.Println("\nPool stats available via runtime.ReadMemStats")
    }
    ```

=== "The Explanation"

    - **sync.Pool**: Object pool for reuse
    - **New**: Creates new object when pool is empty
    - **Get**: Retrieves object from pool
    - **Put**: Returns object to pool
    - **Reset**: Reset object before returning to pool

=== "The Terminal Output"

    ```
    Goroutine 0: Message 0
    Goroutine 1: Message 1
    Goroutine 2: Message 2
    Goroutine 3: Message 3
    Goroutine 4: Message 4
    Goroutine 5: Message 5
    Goroutine 6: Message 6
    Goroutine 7: Message 7
    Goroutine 8: Message 8
    Goroutine 9: Message 9
    ```

## Cond for Condition Signals

The `sync.Cond` provides a condition variable for signaling between goroutines.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sync"
        "time"
    )

    // Queue with condition variable
    type Queue struct {
        mu       sync.Mutex
        cond     *sync.Cond
        items    []int
        finished bool
    }

    // NewQueue creates a new queue
    func NewQueue() *Queue {
        q := &Queue{
            items: make([]int, 0),
        }
        q.cond = sync.NewCond(&q.mu)
        return q
    }

    // Producer adds items to queue
    func (q *Queue) Producer(count int) {
        for i := 0; i < count; i++ {
            q.mu.Lock()
            q.items = append(q.items, i)
            fmt.Printf("Produced: %d\n", i)
            q.cond.Signal()
            q.mu.Unlock()
            time.Sleep(100 * time.Millisecond)
        }

        q.mu.Lock()
        q.finished = true
        q.cond.Broadcast()
        q.mu.Unlock()
    }

    // Consumer removes items from queue
    func (q *Queue) Consumer(id int) {
        for {
            q.mu.Lock()
            for len(q.items) == 0 && !q.finished {
                q.cond.Wait()
            }

            if len(q.items) == 0 && q.finished {
                q.mu.Unlock()
                fmt.Printf("Consumer %d: exiting\n", id)
                return
            }

            item := q.items[0]
            q.items = q.items[1:]
            fmt.Printf("Consumer %d consumed: %d\n", id, item)
            q.mu.Unlock()

            time.Sleep(150 * time.Millisecond)
        }
    }

    func main() {
        queue := NewQueue()
        var wg sync.WaitGroup

        // Start consumers
        for i := 0; i < 3; i++ {
            wg.Add(1)
            go func(id int) {
                defer wg.Done()
                queue.Consumer(id)
            }(i)
        }

        // Start producer
        go queue.Producer(10)

        wg.Wait()
        fmt.Println("All done")
    }
    ```

=== "The Explanation"

    - **sync.Cond**: Condition variable
    - **Wait**: Blocks until signaled
    - **Signal**: Wakes one waiting goroutine
    - **Broadcast**: Wakes all waiting goroutines
    - **Use case**: Producer-consumer patterns

=== "The Terminal Output"

    ```
    Produced: 0
    Consumer 0 consumed: 0
    Produced: 1
    Consumer 1 consumed: 1
    Produced: 2
    Consumer 2 consumed: 2
    Produced: 3
    Consumer 0 consumed: 3
    Produced: 4
    Consumer 1 consumed: 4
    Produced: 5
    Consumer 2 consumed: 5
    Produced: 6
    Consumer 0 consumed: 6
    Produced: 7
    Consumer 1 consumed: 7
    Produced: 8
    Consumer 2 consumed: 8
    Produced: 9
    Consumer 0 consumed: 9
    Consumer 1: exiting
    Consumer 2: exiting
    Consumer 0: exiting
    All done
    ```

## Atomic Operations

The `atomic` package provides low-level atomic operations for synchronization.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sync"
        "sync/atomic"
    )

    func main() {
        var (
            counter int64
            wg       sync.WaitGroup
        )

        // Atomic increment
        for i := 0; i < 1000; i++ {
            wg.Add(1)
            go func() {
                defer wg.Done()
                atomic.AddInt64(&counter, 1)
            }()
        }

        wg.Wait()
        fmt.Println("Atomic counter:", atomic.LoadInt64(&counter))

        // Compare and swap
        var value int64 = 10
        atomic.StoreInt64(&value, 20)
        fmt.Println("Stored value:", atomic.LoadInt64(&value))

        // Compare and swap
        swapped := atomic.CompareAndSwapInt64(&value, 20, 30)
        fmt.Printf("CAS (20->30): swapped=%v, value=%d\n", swapped, atomic.LoadInt64(&value))

        swapped = atomic.CompareAndSwapInt64(&value, 20, 40)
        fmt.Printf("CAS (20->40): swapped=%v, value=%d\n", swapped, atomic.LoadInt64(&value))

        // Atomic operations on structs
        type Stats struct {
            requests int64
            errors   int64
        }

        var stats Stats
        for i := 0; i < 100; i++ {
            wg.Add(1)
            go func() {
                defer wg.Done()
                atomic.AddInt64(&stats.requests, 1)
                if i%10 == 0 {
                    atomic.AddInt64(&stats.errors, 1)
                }
            }()
        }

        wg.Wait()
        fmt.Printf("Stats: requests=%d, errors=%d\n",
            atomic.LoadInt64(&stats.requests),
            atomic.LoadInt64(&stats.errors))
    }
    ```

=== "The Explanation"

    - **atomic.AddInt64**: Atomically adds value
    - **atomic.LoadInt64**: Atomically loads value
    - **atomic.StoreInt64**: Atomically stores value
    - **atomic.CompareAndSwapInt64**: Atomic compare-and-swap
    - **Use case**: Simple counters, flags

=== "The Terminal Output"

    ```
    Atomic counter: 1000
    Stored value: 20
    CAS (20->30): swapped=true, value=30
    CAS (20->40): swapped=false, value=30
    Stats: requests=100, errors=10
    ```

## Choosing the Right Primitive

| Primitive | Use Case | Performance |
|-----------|----------|-------------|
| Mutex | Protecting shared state | Good for short critical sections |
| RWMutex | Read-heavy workloads | Better than Mutex for reads |
| WaitGroup | Coordinating goroutines | Low overhead |
| Once | Single initialization | Zero overhead after first call |
| Map | Concurrent maps | Good for read-heavy patterns |
| Pool | Object reuse | Reduces allocations |
| Cond | Condition signaling | Useful for producer-consumer |
| Atomic | Simple counters/flags | Lowest overhead |

## Best Practices

| Practice | Recommendation |
|----------|----------------|
| Lock scope | Keep critical sections minimal |
| Use defer | Always defer unlock after lock |
| RWMutex | Use for read-heavy workloads |
| WaitGroup | Add before starting goroutine |
| Once | Use for singletons |
| Atomic | Use for simple counters |
| Avoid nesting | Don't hold multiple locks simultaneously |

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Deadlock | Circular lock dependency | Use consistent lock ordering |
| Race condition | Missing synchronization | Add mutex or use atomic |
| Performance | Holding lock too long | Minimize critical section |
| Memory leak | Not unlocking | Use defer for unlock |

## Summary

- `sync.Mutex` provides exclusive locking
- `sync.RWMutex` allows concurrent reads or exclusive writes
- `sync.WaitGroup` coordinates multiple goroutines
- `sync.Once` ensures single initialization
- `sync.Map` provides concurrent-safe maps
- `sync.Pool` reduces memory allocations
- `sync.Cond` enables condition signaling
- `atomic` package provides low-level atomic operations

## Next Steps

- Learn about [Sort & Collections](sort-collections.md)
- Explore [Embed & FS](embed-fs.md)
- Understand [Hashing & Crypto](hashing-crypto.md)
- Discover [String Processing](string-processing.md)
