# Time & Dates

Go's `time` package provides comprehensive time handling capabilities, including parsing, formatting, durations, timers, and time zones. Understanding time operations is crucial for building applications that work with schedules, deadlines, and time-based data.

## What You Will Learn

- Get the current time with `time.Now`
- Work with time durations using `time.Duration`
- Parse and format time strings with `time.Parse` and `time.Format`
- Use timers and tickers for scheduling
- Handle time zones and monotonic clocks
- Implement deadlines and timeouts
- Work with time in databases

## Prerequisites

- Basic Go syntax and data types
- Understanding of constants and iota
- Familiarity with channel operations

---

## Getting Current Time

The `time.Now` function returns the current local time with nanosecond precision.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "time"
    )

    func main() {
        now := time.Now()

        fmt.Println("Current time:", now)
        fmt.Println("Year:", now.Year())
        fmt.Println("Month:", now.Month())
        fmt.Println("Day:", now.Day())
        fmt.Println("Hour:", now.Hour())
        fmt.Println("Minute:", now.Minute())
        fmt.Println("Second:", now.Second())
        fmt.Println("Nanosecond:", now.Nanosecond())
        fmt.Println("Day of week:", now.Weekday())
    }
    ```

=== "The Explanation"

    - **time.Now**: Returns the current local time
    - **Year, Month, Day**: Components of the date
    - **Hour, Minute, Second, Nanosecond**: Components of the time
    - **Weekday**: Returns the day of the week

=== "The Terminal Output"

    ```
    Current time: 2026-09-03 10:30:45.123456789 +0200 CEST
    Year: 2026
    Month: September
    Day: 3
    Hour: 10
    Minute: 30
    Second: 45
    Nanosecond: 123456789
    Day of week: Thursday
    ```

!!! go "Monotonic Clock"
Go's time package automatically uses a monotonic clock when available. This means time measurements are not affected by system clock adjustments.

## Working with Time Durations

The `time.Duration` type represents elapsed time in nanoseconds, with convenient constants for seconds, minutes, and hours.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "time"
    )

    func main() {
        // Creating durations
        d1 := 5 * time.Second
        d2 := 30 * time.Minute
        d3 := 2 * time.Hour
        d4 := time.Duration(1000) * time.Millisecond

        fmt.Println("5 seconds:", d1)
        fmt.Println("30 minutes:", d2)
        fmt.Println("2 hours:", d3)
        fmt.Println("1000 milliseconds:", d4)

        // Converting durations
        fmt.Println("5 seconds in milliseconds:", d1.Milliseconds())
        fmt.Println("30 minutes in seconds:", d2.Seconds())
        fmt.Println("2 hours in minutes:", d3.Minutes())

        // Arithmetic with durations
        start := time.Now()
        time.Sleep(100 * time.Millisecond)
        elapsed := time.Since(start)
        fmt.Println("Elapsed:", elapsed)
    }
    ```

=== "The Explanation"

    - **time.Second, Minute, Hour**: Duration constants
    - **Milliseconds(), Seconds(), Minutes()**: Convert duration to float64
    - **time.Since**: Returns time elapsed since a past time
    - **time.Sleep**: Pauses execution for a duration

=== "The Terminal Output"

    ```
    5 seconds: 5s
    30 minutes: 30m0s
    2 hours: 2h0m0s
    1000 milliseconds: 1s
    5 seconds in milliseconds: 5000
    30 minutes in seconds: 1800
    2 hours in minutes: 120
    Elapsed: 100.123456ms
    ```

## Parsing and Formatting Time

Go uses reference times instead of format strings. The reference time is `Mon Jan 2 15:04:05 MST 2006`.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "time"
    )

    func main() {
        // Parse time string
        timeStr := "2026-09-03 14:30:00"
        parsed, err := time.Parse("2006-01-02 15:04:05", timeStr)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        fmt.Println("Parsed time:", parsed)

        // Format current time
        now := time.Now()
        fmt.Println("RFC3339:", now.Format(time.RFC3339))
        fmt.Println("RFC1123:", now.Format(time.RFC1123))
        fmt.Println("Kitchen:", now.Format(time.Kitchen))
        fmt.Println("Custom:", now.Format("02 Jan 2006 15:04"))

        // Parse with location
        loc, _ := time.LoadLocation("America/New_York")
        parsedWithLoc, _ := time.ParseInLocation("2006-01-02 15:04:05", timeStr, loc)
        fmt.Println("Parsed with location:", parsedWithLoc)
    }
    ```

=== "The Explanation"

    - **time.Parse**: Parses a time string using a layout
    - **time.Format**: Formats a time using a layout
    - **time.RFC3339**: Standard ISO 8601 format
    - **time.ParseInLocation**: Parses with a specific time zone

=== "The Terminal Output"

    ```
    Parsed time: 2026-09-03 14:30:00 +0000 UTC
    RFC3339: 2026-09-03T10:30:45+02:00
    RFC1123: Thu, 03 Sep 2026 10:30:45 CEST
    Kitchen: 10:30AM
    Custom: 03 Sep 2026 10:30
    Parsed with location: 2026-09-03 14:30:00 -0400 EDT
    ```

!!! warning "Reference Time"
The reference time `Mon Jan 2 15:04:05 MST 2006` is mnemonic: 1-2-3-4-5-6-7 (month-day-hour-minute-second-timezone-year).

## Timers and Tickers

Timers and tickers enable scheduling operations at specific intervals or after delays.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "time"
    )

    func main() {
        // Timer - fires once after duration
        fmt.Println("Starting timer...")
        timer := time.NewTimer(2 * time.Second)
        <-timer.C
        fmt.Println("Timer fired!")

        // Ticker - fires repeatedly
        fmt.Println("Starting ticker...")
        ticker := time.NewTicker(500 * time.Millisecond)
        done := make(chan bool)

        go func() {
            time.Sleep(3 * time.Second)
            done <- true
        }()

        for {
            select {
            case <-done:
                ticker.Stop()
                fmt.Println("Ticker stopped")
                return
            case t := <-ticker.C:
                fmt.Println("Tick at", t.Format("15:04:05.000"))
            }
        }
    }
    ```

=== "The Explanation"

    - **time.NewTimer**: Creates a timer that fires once
    - **timer.C**: Channel that receives the time when the timer fires
    - **time.NewTicker**: Creates a ticker that fires repeatedly
    - **ticker.Stop**: Stops the ticker to prevent resource leaks

=== "The Terminal Output"

    ```
    Starting timer...
    Timer fired!
    Starting ticker...
    Tick at 10:30:45.500
    Tick at 10:30:46.000
    Tick at 10:30:46.500
    Tick at 10:30:47.000
    Tick at 10:30:47.500
    Ticker stopped
    ```

!!! danger "Resource Leaks"
Always call `ticker.Stop()` when done with a ticker. Otherwise, the ticker will continue running in the background and leak resources.

## Time Zones

Go provides robust time zone handling through `time.Location` and `time.LoadLocation`.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "time"
    )

    func main() {
        // Get UTC time
        utc := time.Now().UTC()
        fmt.Println("UTC:", utc.Format("15:04:05 MST"))

        // Load specific time zone
        loc, err := time.LoadLocation("America/New_York")
        if err != nil {
            fmt.Println("Error loading location:", err)
            return
        }

        // Convert to different time zone
        nyTime := utc.In(loc)
        fmt.Println("New York:", nyTime.Format("15:04:05 MST"))

        // Fixed offset
        fixedLoc := time.FixedZone("UTC+2", 2*60*60)
        fixedTime := utc.In(fixedLoc)
        fmt.Println("Fixed +2:", fixedTime.Format("15:04:05 MST"))

        // Time zone abbreviation
        fmt.Println("Zone name:", nyTime.Location().String())
    }
    ```

=== "The Explanation"

    - **time.UTC**: The UTC location
    - **time.LoadLocation**: Loads a time zone by name
    - **time.In**: Converts time to a different location
    - **time.FixedZone**: Creates a fixed time zone offset

=== "The Terminal Output"

    ```
    UTC: 10:30:45 UTC
    New York: 06:30:45 EDT
    Fixed +2: 12:30:45 UTC+2
    Zone name: America/New_York
    ```

## Deadlines and Context

Time operations are essential for implementing deadlines and timeouts, often used with context.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "time"
    )

    func main() {
        // Create context with deadline
        deadline := time.Now().Add(2 * time.Second)
        ctx, cancel := context.WithDeadline(context.Background(), deadline)
        defer cancel()

        // Simulate work
        result := make(chan string, 1)
        go func() {
            time.Sleep(3 * time.Second)
            result <- "Work completed"
        }()

        select {
        case res := <-result:
            fmt.Println(res)
        case <-ctx.Done():
            fmt.Println("Context cancelled:", ctx.Err())
        }

        // Create context with timeout
        ctx2, cancel2 := context.WithTimeout(context.Background(), 1*time.Second)
        defer cancel2()

        time.Sleep(2 * time.Second)
        fmt.Println("Timeout context:", ctx2.Err())
    }
    ```

=== "The Explanation"

    - **context.WithDeadline**: Creates context that expires at a specific time
    - **context.WithTimeout**: Creates context that expires after a duration
    - **ctx.Done**: Channel that receives when context is cancelled
    - **ctx.Err**: Returns the error that caused cancellation

=== "The Terminal Output"

    ```
    Context cancelled: context deadline exceeded
    Timeout context: context deadline exceeded
    ```

## Working with Time in Databases

Handling time in databases requires careful consideration of time zones and precision.

=== "The Code"

    ```go
    package main

    import (
        "database/sql"
        "fmt"
        "time"

        _ "github.com/mattn/go-sqlite3"
    )

    func main() {
        // Open database
        db, err := sql.Open("sqlite3", ":memory:")
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        defer db.Close()

        // Create table with timestamp
        _, err = db.Exec(`CREATE TABLE events (
            id INTEGER PRIMARY KEY,
            name TEXT,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
        )`)
        if err != nil {
            fmt.Println("Error creating table:", err)
            return
        }

        // Insert with current time
        now := time.Now().UTC()
        _, err = db.Exec("INSERT INTO events (name, created_at, updated_at) VALUES (?, ?, ?)",
            "Event 1", now, now)
        if err != nil {
            fmt.Println("Error inserting:", err)
            return
        }

        // Query and parse time
        var name string
        var createdAt, updatedAt time.Time
        err = db.QueryRow("SELECT name, created_at, updated_at FROM events WHERE id = 1").
            Scan(&name, &createdAt, &updatedAt)
        if err != nil {
            fmt.Println("Error querying:", err)
            return
        }

        fmt.Println("Name:", name)
        fmt.Println("Created:", createdAt.Format(time.RFC3339))
        fmt.Println("Updated:", updatedAt.Format(time.RFC3339))
    }
    ```

=== "The Explanation"

    - **sql.Open**: Opens a database connection
    - **time.Time**: Go's time type for database operations
    - **Scan**: Automatically parses time from database rows
    - **RFC3339**: Standard format for storing times in databases

=== "The Terminal Output"

    ```
    Name: Event 1
    Created: 2026-09-03T08:30:45Z
    Updated: 2026-09-03T08:30:45Z
    ```

## Best Practices

| Practice | Recommendation |
|----------|----------------|
| Store times | Use UTC in storage, convert for display |
| Parse times | Always check for errors |
| Use tickers | Always call Stop() to prevent leaks |
| Time zones | Use time.LoadLocation for named zones |
| Precision | Consider if you need nanoseconds |
| Context | Use WithTimeout/WithDeadline for deadlines |

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Wrong time zone | System timezone mismatch | Use time.LoadLocation explicitly |
| Parse errors | Incorrect layout format | Use reference time layout |
| Ticker leak | Not calling Stop() | Always defer ticker.Stop() |
| Time drift | Using real-time in tests | Mock time or use fixed values |

## Summary

- `time.Now` returns the current local time
- `time.Duration` represents elapsed time
- `time.Parse` and `time.Format` use reference time layouts
- Timers fire once; tickers fire repeatedly
- Always stop tickers to prevent resource leaks
- Use time zones for correct internationalization
- Context deadlines and timeouts enable cancellation

## Next Steps

- Learn about [Regular Expressions](regular-expressions.md)
- Explore [Context & Cancellation](context-cancellation.md)
- Understand [Sync Primitives](sync-primitives.md)
- Discover [Sort & Collections](sort-collections.md)
