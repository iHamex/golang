# Channels & Select

Channels are the primary synchronization primitive in Go's concurrency model. Combined with the `select` statement, they enable powerful patterns for coordinating goroutines, multiplexing operations, and building concurrent pipelines. This chapter covers channel mechanics, select semantics, and practical concurrency patterns.

## What You Will Learn

- The difference between buffered and unbuffered channels
- Directional channels (send-only, receive-only)
- The `select` statement and its semantics
- Using `default` to avoid blocking
- Nil channels and their behavior
- Channel closing and range iteration
- Fan-in and fan-out concurrency patterns

## Prerequisites

- Understanding of [goroutines](concurrency-model.md) and the [GMP scheduler](goroutines-scheduler.md)
- Basic Go syntax and function definitions
- Go 1.18 or later

---

## Unbuffered Channels

Unbuffered channels synchronize the sender and receiver directly. A send blocks until a corresponding receive is ready, and vice versa. This creates a happens-before relationship between the sending and receiving goroutines.

=== "Unbuffered Channel Basics"

    ```go
    package main

    import (
        "fmt"
        "time"
    )

    func main() {
        ch := make(chan string) // Unbuffered channel

        go func() {
            fmt.Println("Sender: waiting 1s before sending...")
            time.Sleep(1 * time.Second)
            ch <- "hello from goroutine"
            fmt.Println("Sender: message sent")
        }()

        fmt.Println("Main: waiting to receive...")
        msg := <-ch
        fmt.Printf("Main: received '%s'\n", msg)
    }
    ```

=== "The Explanation"

    - **`make(chan string)`**: Creates an unbuffered channel — zero capacity
    - **`ch <- "hello"`**: Blocks until the main goroutine receives
    - **`msg := <-ch`**: Blocks until the sender provides a value
    - **Happens-before**: The send happens-before the receive completes

=== "The Terminal Output"

    ```
    Main: waiting to receive...
    Sender: waiting 1s before sending...
    Sender: message sent
    Main: received 'hello from goroutine'
    ```

!!! go "Unbuffered Channel Semantics"
    Both the sender and receiver must be ready at the same time. If either side is not ready, the other blocks. This is called a synchronous or rendezvous channel.

---

## Buffered Channels

Buffered channels have internal capacity. Sends only block when the buffer is full, and receives only block when the buffer is empty.

=== "Buffered Channel Behavior"

    ```go
    package main

    import "fmt"

    func main() {
        ch := make(chan int, 3) // Buffer size of 3

        // These three sends complete immediately (buffer not full)
        ch <- 1
        ch <- 2
        ch <- 3
        fmt.Println("Sent 3 values (buffer full)")

        // These receives drain the buffer
        fmt.Printf("Received: %d\n", <-ch)
        fmt.Printf("Received: %d\n", <-ch)
        fmt.Printf("Received: %d\n", <-ch)

        // Now buffer is empty; another receive would block
        // Uncommenting the next line would deadlock:
        // fmt.Printf("Received: %d\n", <-ch)
    }
    ```

=== "The Explanation"

    - **`make(chan int, 3)`**: Creates a buffered channel with capacity 3
    - **Non-blocking sends**: First 3 sends complete without blocking (buffer has space)
    - **Non-blocking receives**: While buffer has data, receives complete immediately
    - **Full buffer**: A 4th send would block until a receive drains one slot

=== "The Terminal Output"

    ```
    Sent 3 values (buffer full)
    Received: 1
    Received: 2
    Received: 3
    ```

| Channel Type | Buffer Size | Send Blocks When | Receive Blocks When |
|---|---|---|---|
| Unbuffered | 0 | No receiver ready | No sender ready |
| Buffered (N) | N | Buffer full (N items) | Buffer empty (0 items) |

---

## Directional Channels

Directional channels restrict how a channel can be used. This enforces communication patterns at the type level.

=== "Send-Only and Receive-Only Channels"

    ```go
    package main

    import "fmt"

    // producer can only send to the channel
    func producer(ch chan<- int) {
        for i := 0; i < 5; i++ {
            ch <- i * 10
        }
        close(ch)
    }

    // consumer can only receive from the channel
    func consumer(ch <-chan int) {
        for val := range ch {
            fmt.Printf("Consumed: %d\n", val)
        }
    }

    func main() {
        ch := make(chan int, 5)
        go producer(ch)
        consumer(ch)
    }
    ```

=== "The Explanation"

    - **`chan<- int`**: Send-only channel — can send values, cannot receive
    - **`<-chan int`**: Receive-only channel — can receive values, cannot send
    - **`close(ch)`**: Signals no more values will be sent; enables `range` iteration
    - **Type safety**: The compiler prevents accidental misuse of channel direction

=== "The Terminal Output"

    ```
    Consumed: 0
    Consumed: 10
    Consumed: 20
    Consumed: 30
    Consumed: 40
    ```

!!! go "Directional Channels as API Contracts"
    Use directional channels in function signatures to document and enforce the intended communication flow. This prevents bugs where a function accidentally sends on a receive-only channel.

---

## The Select Statement

`select` blocks until one of its cases can proceed, then executes that case. If multiple cases are ready, one is chosen randomly (fair scheduling).

=== "Basic Select"

    ```go
    package main

    import (
        "fmt"
        "time"
    )

    func main() {
        ch1 := make(chan string)
        ch2 := make(chan string)

        go func() {
            time.Sleep(1 * time.Second)
            ch1 <- "one"
        }()

        go func() {
            time.Sleep(2 * time.Second)
            ch2 <- "two"
        }()

        for i := 0; i < 2; i++ {
            select {
            case msg := <-ch1:
                fmt.Printf("Received from ch1: %s\n", msg)
            case msg := <-ch2:
                fmt.Printf("Received from ch2: %s\n", msg)
            }
        }
    }
    ```

=== "The Explanation"

    - **`select`**: Waits on multiple channel operations simultaneously
    - **First ready case**: After ~1s, ch1 is ready, so that case executes
    - **Second iteration**: After ~1s more, ch2 is ready
    - **Random fairness**: If both channels are ready simultaneously, one is chosen randomly

=== "The Terminal Output"

    ```
    Received from ch1: one
    Received from ch2: two
    ```

---

## Default Case

The `default` case in a `select` enables non-blocking channel operations. If no case is ready, `default` executes immediately.

=== "Non-Blocking Select"

    ```go
    package main

    import "fmt"

    func main() {
        ch := make(chan int, 1)
        msgCh := make(chan string)

        // Non-blocking send attempt
        select {
        case ch <- 42:
            fmt.Println("Sent 42 to channel")
        default:
            fmt.Println("Channel full, send failed")
        }

        // Non-blocking receive attempt
        select {
        case val := <-ch:
            fmt.Printf("Received: %d\n", val)
        default:
            fmt.Println("No value available")
        }

        // Non-blocking receive on empty channel
        select {
        case val := <-msgCh:
            fmt.Printf("Received: %s\n", val)
        default:
            fmt.Println("msgCh: no value available")
        }
    }
    ```

=== "The Explanation"

    - **`default` case**: Executes when no other case is ready immediately
    - **Non-blocking send**: Tries to send; falls back to `default` if buffer full
    - **Non-blocking receive**: Tries to receive; falls back to `default` if channel empty
    - **Use case**: Polling, timeouts, implementing try-send/try-receive patterns

=== "The Terminal Output"

    ```
    Sent 42 to channel
    Received: 42
    msgCh: no value available
    ```

| Select Variant | Behavior |
|---|---|
| No `default` | Blocks until a case is ready |
| With `default` | Executes `default` immediately if no case is ready |
| Multiple ready cases | One chosen randomly (fair scheduling) |
| Empty select | `select{}` blocks forever |

---

## Nil Channels

Sending to or receiving from a nil channel blocks forever. Closing a nil channel panics. This property is useful for dynamically enabling/disabling select cases.

=== "Nil Channel Behavior"

    ```go
    package main

    import (
        "fmt"
        "time"
    )

    func main() {
        var ch chan int // nil channel

        done := make(chan struct{})

        // This select will always choose done (nil channel is never ready)
        go func() {
            time.Sleep(100 * time.Millisecond)
            close(done)
        }()

        select {
        case <-ch:
            fmt.Println("This will never execute")
        case <-done:
            fmt.Println("Received done signal")
        }

        fmt.Println("Nil channels block forever — use them to disable select cases")
    }
    ```

=== "The Explanation"

    - **`var ch chan int`**: Declares a nil channel (never initialized)
    - **Nil channel in select**: Never becomes ready, so that case is effectively disabled
    - **Practical use**: Toggle channels on/off by setting them to nil vs initialized

=== "The Terminal Output"

    ```
    Received done signal
    Nil channels block forever — use them to disable select cases
    ```

!!! danger "Nil Channel Rules"
    Sending to a nil channel: **blocks forever**. Receiving from a nil channel: **blocks forever**. Closing a nil channel: **panics**. Use these properties intentionally.

---

## Channel Closing and Range

Closing a channel signals that no more values will be sent. The `range` loop iterates over a channel until it is closed.

=== "Range Over Channels"

    ```go
    package main

    import "fmt"

    func generateNumbers(start, count int, ch chan<- int) {
        for i := 0; i < count; i++ {
            ch <- start + i
        }
        close(ch)
    }

    func main() {
        ch := make(chan int, 5)
        go generateNumbers(1, 5, ch)

        // range iterates until channel is closed
        for num := range ch {
            fmt.Printf("Number: %d\n", num)
        }
        fmt.Println("Channel closed, range loop ended")
    }
    ```

=== "The Explanation"

    - **`close(ch)`**: Signals end of stream; `range` loop terminates
    - **`for num := range ch`**: Automatically receives until channel is closed
    - **Zero value**: After close, receiving returns the zero value (but `range` handles this gracefully)
    - **Never close from receiver**: Only the sender should close a channel

=== "The Terminal Output"

    ```
    Number: 1
    Number: 2
    Number: 3
    Number: 4
    Number: 5
    Channel closed, range loop ended
    ```

| Operation | On Closed Channel | On Nil Channel |
|---|---|---|
| Send | Panics | Blocks forever |
| Receive | Returns zero value | Blocks forever |
| Close | Panics | Panics |
| `range` | Ends iteration | Blocks forever |

---

## Fan-Out / Fan-In Patterns

Fan-out distributes work across multiple goroutines. Fan-in merges results from multiple goroutines into a single channel.

=== "Fan-Out / Fan-In Implementation"

    ```go
    package main

    import (
        "fmt"
        "math/rand"
        "sync"
    )

    func worker(id int, jobs <-chan int, results chan<- int, wg *sync.WaitGroup) {
        defer wg.Done()
        for job := range jobs {
            // Simulate variable work
            result := job * job + rand.Intn(10)
            results <- result
            fmt.Printf("Worker %d: processed job %d → %d\n", id, job, result)
        }
    }

    func fanIn(done <-chan struct{}, channels ...chan int) <-chan int {
        var wg sync.WaitGroup
        merged := make(chan int)

        for _, ch := range channels {
            wg.Add(1)
            go func(c <-chan int) {
                defer wg.Done()
                for val := range c {
                    select {
                    case merged <- val:
                    case <-done:
                        return
                    }
                }
            }(ch)
        }

        go func() {
            wg.Wait()
            close(merged)
        }()

        return merged
    }

    func main() {
        jobs := make(chan int, 10)
        done := make(chan struct{})

        // Fan-out: 3 workers
        workerResults := make([]chan int, 3)
        var wg sync.WaitGroup

        for i := 0; i < 3; i++ {
            results := make(chan int, 5)
            workerResults[i] = results
            wg.Add(1)
            go worker(i, jobs, results, &wg)
        }

        // Send jobs
        for j := 1; j <= 9; j++ {
            jobs <- j
        }
        close(jobs)

        // Close results channels when workers finish
        go func() {
            wg.Wait()
            for _, ch := range workerResults {
                close(ch)
            }
        }()

        // Fan-in: merge all results
        merged := fanIn(done, workerResults...)

        // Collect results
        var results []int
        for r := range merged {
            results = append(results, r)
        }

        fmt.Printf("Total results: %d\n", len(results))
    }
    ```

=== "The Explanation"

    - **Fan-out**: Multiple goroutines read from the same jobs channel
    - **Fan-in**: `fanIn()` merges multiple channels into one using a goroutine per source
    - **`done` channel**: Enables cancellation of the fan-in
    - **Buffered channels**: Prevent workers from blocking each other

=== "The Terminal Output"

    ```
    Worker 0: processed job 1 → 4
    Worker 1: processed job 2 → 12
    Worker 2: processed job 3 → 15
    Worker 0: processed job 4 → 24
    Worker 1: processed job 5 → 31
    Worker 2: processed job 6 → 44
    Worker 0: processed job 7 → 55
    Worker 1: processed job 8 → 68
    Worker 2: processed job 9 → 87
    Total results: 9
    ```

!!! go "Pattern: Pipeline"
    Chains of fan-out/fan-in stages form pipelines. Each stage is a goroutine that receives from one channel and sends to another. This composes well for data processing workflows.

---

## Advanced Select Patterns

=== "Timeout Pattern"

    ```go
    package main

    import (
        "fmt"
        "time"
    )

    func slowOperation(ch chan<- string) {
        time.Sleep(3 * time.Second)
        ch <- "result"
    }

    func main() {
        ch := make(chan string, 1)
        go slowOperation(ch)

        select {
        case result := <-ch:
            fmt.Println("Got result:", result)
        case <-time.After(2 * time.Second):
            fmt.Println("Timeout: operation took too long")
        }
    }
    ```

=== "The Explanation"

    - **`time.After(d)`**: Returns a channel that sends after duration `d`
    - **Race between operations**: First case to complete wins
    - **Timeout pattern**: Common for wrapping slow operations with deadlines

=== "The Terminal Output"

    ```
    Timeout: operation took too long
    ```

=== "Done Channel Cancellation"

    ```go
    package main

    import (
        "fmt"
        "time"
    )

    func worker(done <-chan struct{}) {
        for {
            select {
            case <-done:
                fmt.Println("Worker: shutting down gracefully")
                return
            default:
                fmt.Println("Worker: doing work...")
                time.Sleep(500 * time.Millisecond)
            }
        }
    }

    func main() {
        done := make(chan struct{})

        go worker(done)

        // Let worker run for 2 seconds
        time.Sleep(2 * time.Second)
        close(done)

        time.Sleep(100 * time.Millisecond)
        fmt.Println("Main: worker stopped")
    }
    ```

=== "The Explanation"

    - **`close(done)`**: Broadcasts shutdown signal to all goroutines listening on `done`
    - **Non-blocking check**: `default` case keeps the worker doing useful work
    - **Graceful shutdown**: Worker finishes current iteration and exits cleanly

=== "The Terminal Output"

    ```
    Worker: doing work...
    Worker: doing work...
    Worker: doing work...
    Worker: doing work...
    Worker: shutting down gracefully
    Main: worker stopped
    ```

---

## Best Practices

| Practice | Description |
|---|---|
| Prefer unbuffered channels | Use buffered channels only when you have a specific reason |
| Close channels from sender | Never close a channel from the receiver side |
| Use directional channels | Enforce communication patterns in function signatures |
| Check `range` termination | Ensure channels are closed when iteration should end |
| Avoid busy-waiting | Use `select` with `default` or timeout instead of polling |
| Use `done` channels | Propagate cancellation through channel close |
| Don't over-buffer | Large buffers can mask scheduling issues |

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Deadlock error | All goroutines blocked with no progress | Check for missing sends/receives or unclosed channels |
| Panic: send on closed channel | Sending to an already-closed channel | Only send from one goroutine; close from sender only |
| Goroutine leak | Receiver/sender blocked with no counterpart | Ensure all sends have matching receives |
| Starvation | One channel always wins select | Use randomized backoff or priority queues |
| Slow pipeline | Unbuffered channels serialize throughput | Add small buffers between pipeline stages |
| Data race on channel | Multiple goroutines close same channel | Use sync.Once or dedicated closer goroutine |

## Summary

- Unbuffered channels synchronize sender and receiver directly
- Buffered channels decouple send/receive when capacity is available
- Directional channels (`chan<-`, `<-chan`) enforce communication patterns at compile time
- `select` multiplexes channel operations; `default` enables non-blocking behavior
- Nil channels block forever; use them to dynamically disable select cases
- `range` iterates a channel until it is closed; only the sender should close
- Fan-out distributes work; fan-in merges results into a single channel

## Next Steps

- [Memory Model](memory-model.md) — Understand happens-before guarantees and data race prevention
- [Runtime & GC](runtime-gc.md) — Learn about garbage collection and memory management
- [Concurrency Model](concurrency-model.md) — Review CSP principles and goroutine fundamentals
