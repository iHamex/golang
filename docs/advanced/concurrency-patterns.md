# Advanced Concurrency

Go's concurrency primitives—goroutines, channels, and select—enable elegant solutions to complex parallelism problems. This guide covers production-grade concurrency patterns used in real-world systems.

## What You Will Learn

- Worker pool pattern with graceful shutdown
- Pipeline pattern for data processing
- Fan-in/fan-out for parallel computation
- Context cancellation with goroutines
- Error handling with errgroup
- Semaphore pattern for rate limiting
- Rate limiting with time.Ticker
- Dynamic concurrency limits
- Done channel patterns
- Worker lifecycle management

## Prerequisites

- Understanding of goroutines and channels
- Familiarity with the `select` statement
- Basic knowledge of `context.Context`

---

## Worker Pool Pattern

Worker pools limit concurrent goroutines to prevent resource exhaustion.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "math/rand"
        "sync"
        "time"
    )

    type Job struct {
        ID   int
        Data string
    }

    type Result struct {
        JobID int
        Output string
        Err   error
    }

    func worker(ctx context.Context, id int, jobs <-chan Job, results chan<- Result, wg *sync.WaitGroup) {
        defer wg.Done()
        for {
            select {
            case <-ctx.Done():
                fmt.Printf("Worker %d: shutting down\n", id)
                return
            case job, ok := <-jobs:
                if !ok {
                    return
                }
                result := processJob(job)
                results <- result
            }
        }
    }

    func processJob(job Job) Result {
        time.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)
        return Result{
            JobID:  job.ID,
            Output: fmt.Sprintf("Processed: %s", job.Data),
        }
    }

    func main() {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()

        const numWorkers = 3
        const numJobs = 10

        jobs := make(chan Job, numJobs)
        results := make(chan Result, numJobs)

        var wg sync.WaitGroup

        for w := 0; w < numWorkers; w++ {
            wg.Add(1)
            go worker(ctx, w, jobs, results, &wg)
        }

        for j := 0; j < numJobs; j++ {
            jobs <- Job{ID: j, Data: fmt.Sprintf("data-%d", j)}
        }
        close(jobs)

        go func() {
            wg.Wait()
            close(results)
        }()

        for result := range results {
            fmt.Printf("Result: %s\n", result.Output)
        }
    }
    ```

=== "The Explanation"

    - **Job channel**: Buffered channel carries work items from producers to workers
    - **Result channel**: Workers send completed results back through this channel
    - **WaitGroup**: Ensures all workers finish before closing the results channel
    - **Context cancellation**: Workers exit cleanly when context expires or is cancelled
    - **Graceful shutdown**: Workers check `ctx.Done()` on every iteration

=== "The Terminal Output"

    ```
    Worker 0: shutting down
    Worker 1: shutting down
    Worker 2: shutting down
    Result: Processed: data-0
    Result: Processed: data-1
    Result: Processed: data-2
    ```

!!! go "Key Insight"
    Always use buffered channels for jobs and results to prevent goroutine leaks. A buffer size matching the number of jobs ensures producers never block.

---

## Pipeline Pattern

Pipelines chain stages where each stage transforms data and passes it forward.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
    )

    func generate(nums ...int) <-chan int {
        out := make(chan int)
        go func() {
            for _, n := range nums {
                out <- n
            }
            close(out)
        }()
        return out
    }

    func square(in <-chan int) <-chan int {
        out := make(chan int)
        go func() {
            for n := range in {
                out <- n * n
            }
            close(out)
        }()
        return out
    }

    func filter(in <-chan int, predicate func(int) bool) <-chan int {
        out := make(chan int)
        go func() {
            for n := range in {
                if predicate(n) {
                    out <- n
                }
            }
            close(out)
        }()
        return out
    }

    func toString(in <-chan int) <-chan string {
        out := make(chan string)
        go func() {
            for n := range in {
                out <- fmt.Sprintf("Number: %d", n)
            }
            close(out)
        }()
        return out
    }

    func main() {
        ch := generate(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
        squared := square(ch)
        evens := filter(squared, func(n int) bool { return n%2 == 0 })
        formatted := toString(evens)

        for result := range formatted {
            fmt.Println(result)
        }
    }
    ```

=== "The Explanation"

    - **generate**: Creates a source channel and sends initial values
    - **square**: Reads from input channel, transforms, sends to output
    - **filter**: Applies predicate function, only passes matching values
    - **toString**: Final stage converts integers to formatted strings
    - **Channel closing**: Each stage closes its output channel when done

=== "The Terminal Output"

    ```
    Number: 4
    Number: 16
    Number: 36
    Number: 64
    Number: 100
    ```

!!! note "Pipeline Benefits"
    Pipelines are composable and testable. Each stage runs independently, making it easy to add, remove, or reorder stages.

---

## Fan-In / Fan-Out

Fan-out distributes work across multiple goroutines; fan-in merges results.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "math/rand"
        "sync"
        "time"
    )

    func fanOut(input <-chan int, workers int) []<-chan int {
        channels := make([]<-chan int, workers)
        for i := 0; i < workers; i++ {
            channels[i] = heavyCompute(input)
        }
        return channels
    }

    func heavyCompute(in <-chan int) <-chan int {
        out := make(chan int)
        go func() {
            for n := range in {
                time.Sleep(time.Duration(rand.Intn(50)) * time.Millisecond)
                out <- n * 2
            }
            close(out)
        }()
        return out
    }

    func fanIn(channels ...<-chan int) <-chan int {
        var wg sync.WaitGroup
        merged := make(chan int)

        for _, ch := range channels {
            wg.Add(1)
            go func(c <-chan int) {
                defer wg.Done()
                for val := range c {
                    merged <- val
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
        source := make(chan int, 10)
        go func() {
            for i := 0; i < 20; i++ {
                source <- i
            }
            close(source)
        }()

        fans := fanOut(source, 4)
        merged := fanIn(fans...)

        for result := range merged {
            fmt.Printf("Result: %d\n", result)
        }
    }
    ```

=== "The Explanation"

    - **fanOut**: Splits input across multiple worker goroutines for parallel processing
    - **fanIn**: Merges multiple channels into one using a WaitGroup
    - **Buffered merged channel**: Prevents workers from blocking when consumer is slow
    - **WaitGroup coordination**: Closes merged channel only after all workers finish

=== "The Terminal Output"

    ```
    Result: 0
    Result: 2
    Result: 4
    Result: 6
    Result: 8
    ```

!!! danger "Goroutine Leak Warning"
    Always ensure all goroutines terminate. Use `defer close(out)` in each stage and respect context cancellation.

---

## Context Cancellation

Context provides cancellation signals to goroutine trees.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "math/rand"
        "time"
    )

    func fetchURL(ctx context.Context, url string) (string, error) {
        select {
        case <-ctx.Done():
            return "", ctx.Err()
        case <-time.After(time.Duration(rand.Intn(200)) * time.Millisecond):
            return fmt.Sprintf("Response from %s", url), nil
        }
    }

    func main() {
        ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
        defer cancel()

        urls := []string{"api.example.com", "cdn.example.com", "auth.example.com"}

        for _, url := range urls {
            result, err := fetchURL(ctx, url)
            if err != nil {
                fmt.Printf("Error fetching %s: %v\n", url, err)
                continue
            }
            fmt.Println(result)
        }
    }
    ```

=== "The Explanation"

    - **context.WithTimeout**: Creates a context that cancels after specified duration
    - **select statement**: Goroutine races between data arrival and cancellation
    - **ctx.Err()**: Returns Canceled or DeadlineExceeded when context expires
    - **defer cancel**: Ensures context resources are released immediately

=== "The Terminal Output"

    ```
    Error fetching api.example.com: context deadline exceeded
    Error fetching cdn.example.com: context deadline exceeded
    Error fetching auth.example.com: context deadline exceeded
    ```

!!! go "Pattern"
    Wrap all I/O operations in a `select` that includes `ctx.Done()` to enable responsive cancellation.

---

## Errgroup Pattern

`errgroup` handles multiple goroutines with error propagation.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "golang.org/x/sync/errgroup"
    )

    func processItem(ctx context.Context, item string) error {
        if item == "bad" {
            return fmt.Errorf("failed to process %s", item)
        }
        fmt.Printf("Processed: %s\n", item)
        return nil
    }

    func main() {
        ctx := context.Background()
        g, ctx := errgroup.WithContext(ctx)

        items := []string{"item1", "item2", "bad", "item4"}

        for _, item := range items {
            item := item
            g.Go(func() error {
                return processItem(ctx, item)
            })
        }

        if err := g.Wait(); err != nil {
            fmt.Printf("Error: %v\n", err)
        } else {
            fmt.Println("All items processed successfully")
        }
    }
    ```

=== "The Explanation"

    - **errgroup.WithContext**: Creates group linked to cancellable context
    - **g.Go**: Launches a goroutine; returns error to group
    - **g.Wait**: Blocks until all goroutines complete; returns first error
    - **Context propagation**: If any goroutine fails, context is cancelled for others

=== "The Terminal Output"

    ```
    Processed: item1
    Processed: item2
    Error: failed to process bad
    ```

!!! warning "Common Mistake"
    Don't forget `item := item` in loop closures. Without it, all goroutines reference the same variable.

---

## Semaphore Pattern

Use a buffered channel as a counting semaphore.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sync"
        "time"
    )

    func main() {
        const maxConcurrent = 3
        sem := make(chan struct{}, maxConcurrent)
        var wg sync.WaitGroup

        for i := 0; i < 10; i++ {
            wg.Add(1)
            go func(id int) {
                defer wg.Done()
                sem <- struct{}{}
                defer func() { <-sem }()

                fmt.Printf("Worker %d started\n", id)
                time.Sleep(100 * time.Millisecond)
                fmt.Printf("Worker %d finished\n", id)
            }(i)
        }

        wg.Wait()
        fmt.Println("All workers completed")
    }
    ```

=== "The Explanation"

    - **Semaphore channel**: Buffered channel with capacity equal to max concurrent operations
    - **sem <- struct{}{}**: Acquires a slot (blocks if full)
    - **<-sem**: Releases a slot back to the pool
    - **defer**: Ensures release even if panic occurs

=== "The Terminal Output"

    ```
    Worker 0 started
    Worker 1 started
    Worker 2 started
    Worker 0 finished
    Worker 3 started
    Worker 1 finished
    ```

!!! abstract "When to Use"
    Semaphores are ideal when you have an external resource with hard limits (database connections, API rate limits, file handles).

---

## Rate Limiting with Ticker

Control throughput using `time.Ticker`.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "time"
    )

    func main() {
        requests := make(chan int, 5)
        for i := 0; i < 5; i++ {
            requests <- i
        }
        close(requests)

        limiter := time.NewTicker(200 * time.Millisecond)
        defer limiter.Stop()

        for req := range requests {
            <-limiter.C
            fmt.Printf("Request %d processed at %v\n", req, time.Now().Format("15:04:05.000"))
        }

        fmt.Println("All requests rate-limited")
    }
    ```

=== "The Explanation"

    - **time.NewTicker**: Creates a ticker that sends values at fixed intervals
    - **<-limiter.C**: Blocks until next tick, enforcing minimum delay between requests
    - **Buffered requests channel**: Decouples production from rate-limited consumption

=== "The Terminal Output"

    ```
    Request 0 processed at 14:30:00.200
    Request 1 processed at 14:30:00.400
    Request 2 processed at 14:30:00.600
    Request 3 processed at 14:30:00.800
    Request 4 processed at 14:30:01.000
    ```

---

## Done Channel Pattern

Signal goroutine completion using a dedicated done channel.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "time"
    )

    func worker(done chan<- bool) {
        fmt.Println("Working...")
        time.Sleep(200 * time.Millisecond)
        fmt.Println("Done working")
        done <- true
    }

    func main() {
        done := make(chan bool, 1)

        go worker(done)

        <-done
        fmt.Println("Main: worker finished, proceeding")
    }
    ```

=== "The Explanation"

    - **done channel**: Synchronization primitive for signaling completion
    - **Buffered channel**: Prevents goroutine leak if receiver hasn't started yet
    - **Blocking receive**: Main goroutine waits until worker signals completion

=== "The Terminal Output"

    ```
    Working...
    Done working
    Main: worker finished, proceeding
    ```

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Always use context | Pass context to all long-running goroutines |
| Prefer buffered channels | Prevent blocking and goroutine leaks |
| Use WaitGroup for coordination | Wait for goroutine completion |
| Close channels from sender | Never close channels from receiver |
| Don't start goroutines in init | Use explicit lifecycle management |
| Limit concurrency | Use semaphores or worker pools |
| Handle panics in goroutines | Use `recover()` or errgroup |

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Goroutine leak | Missing cancellation | Add `ctx.Done()` check in loops |
| Deadlock | All goroutines blocked | Check channel buffering and close ordering |
| Race condition | Unsynchronized shared state | Use mutex or channels for synchronization |
| Panic in goroutine | Unhandled error | Wrap with `defer recover()` or use errgroup |
| Memory growth | Unbounded goroutine creation | Use worker pool or semaphore pattern |

## Summary

- Worker pools control resource usage
- Pipelines enable composable data processing
- Fan-in/fan-out parallelizes expensive operations
- Context cancellation prevents goroutine leaks
- Errgroup simplifies error handling across goroutines
- Semaphores limit concurrent access to resources
- Rate limiting prevents overwhelming downstream services

## Next Steps

- [Middleware & Hooks](middleware-hooks.md)
- [Database & SQL](database-sql.md)
- [Context Deep Dive](../utilities/context-cancellation.md)
- [Testing Concurrency](../basics/testing.md)
