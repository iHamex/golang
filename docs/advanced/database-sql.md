# Database & SQL

Go's `database/sql` package provides a standard interface for SQL databases. This guide covers connection management, query execution, transactions, and best practices for production use.

## What You Will Learn

- database/sql package fundamentals
- Database drivers (pgx, mysql, sqlite)
- Connection pooling configuration
- Prepared statements
- Transaction management
- Context with database queries
- Row scanning techniques
- SQL injection prevention
- Schema migrations
- Connection health monitoring

## Prerequisites

- Basic SQL knowledge
- Understanding of Go interfaces
- Familiarity with context package

---

## Drivers Overview

Choose the right driver for your database.

| Database | Driver | Import Path | Notes |
|----------|--------|-------------|-------|
| PostgreSQL | pgx | `github.com/jackc/pgx/v5/stdlib` | Recommended, pure Go |
| PostgreSQL | lib/pq | `github.com/lib/pq` | Legacy, CGo required |
| MySQL | go-sql-driver | `github.com/go-sql-driver/mysql` | Battle-tested |
| SQLite | modernc | `github.com/glebarez/go-sqlite` | Pure Go |
| SQLite | mattn | `github.com/mattn/go-sqlite3` | CGo required |
| SQL Server | go-mssqldb | `github.com/denisenkom/go-mssqldb` | Microsoft official |

!!! go "Driver Selection"
    Prefer pure Go drivers (pgx, modernc) for easier deployment. CGo drivers require build tools on target systems.

---

## Connection Setup

Configure database connections with connection pooling.

=== "The Code"

    ```go
    package main

    import (
        "database/sql"
        "fmt"
        "log"
        "time"

        _ "github.com/jackc/pgx/v5/stdlib"
    )

    func main() {
        db, err := sql.Open("pgx", "postgres://user:pass@localhost:5432/mydb?sslmode=disable")
        if err != nil {
            log.Fatal(err)
        }
        defer db.Close()

        db.SetMaxOpenConns(25)
        db.SetMaxIdleConns(5)
        db.SetConnMaxLifetime(5 * time.Minute)
        db.SetConnMaxIdleTime(1 * time.Minute)

        if err := db.Ping(); err != nil {
            log.Fatal(err)
        }

        fmt.Println("Connected to database")
    }
    ```

=== "The Explanation"

    - **sql.Open**: Creates connection pool (doesn't connect immediately)
    - **MaxOpenConns**: Maximum simultaneous database connections
    - **MaxIdleConns**: Connections kept alive in pool
    - **ConnMaxLifetime**: Maximum time a connection can exist
    - **ConnMaxIdleTime**: Maximum idle time before closing
    - **db.Ping**: Verifies actual connectivity

=== "The Terminal Output"

    ```
    Connected to database
    ```

!!! warning "Connection Pool Sizing"
    Set MaxOpenConns based on database limits. PostgreSQL default is 100 connections. Leave room for admin connections.

---

## Querying Rows

Execute SELECT queries and scan results.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "database/sql"
        "fmt"
        "log"
        "time"

        _ "github.com/jackc/pgx/v5/stdlib"
    )

    type User struct {
        ID        int64
        Name      string
        Email     string
        CreatedAt time.Time
    }

    func getUser(ctx context.Context, db *sql.DB, id int64) (*User, error) {
        query := `SELECT id, name, email, created_at FROM users WHERE id = $1`

        user := &User{}
        err := db.QueryRowContext(ctx, query, id).Scan(
            &user.ID,
            &user.Name,
            &user.Email,
            &user.CreatedAt,
        )
        if err != nil {
            if err == sql.ErrNoRows {
                return nil, fmt.Errorf("user %d not found", id)
            }
            return nil, fmt.Errorf("query user: %w", err)
        }

        return user, nil
    }

    func listUsers(ctx context.Context, db *sql.DB) ([]User, error) {
        query := `SELECT id, name, email, created_at FROM users ORDER BY id`

        rows, err := db.QueryContext(ctx, query)
        if err != nil {
            return nil, fmt.Errorf("query users: %w", err)
        }
        defer rows.Close()

        var users []User
        for rows.Next() {
            var u User
            if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.CreatedAt); err != nil {
                return nil, fmt.Errorf("scan user: %w", err)
            }
            users = append(users, u)
        }

        if err := rows.Err(); err != nil {
            return nil, fmt.Errorf("rows iteration: %w", err)
        }

        return users, nil
    }

    func main() {
        db, err := sql.Open("pgx", "postgres://user:pass@localhost:5432/mydb?sslmode=disable")
        if err != nil {
            log.Fatal(err)
        }
        defer db.Close()

        ctx := context.Background()

        user, err := getUser(ctx, db, 1)
        if err != nil {
            log.Printf("Error: %v", err)
        } else {
            fmt.Printf("User: %+v\n", user)
        }

        users, err := listUsers(ctx, db)
        if err != nil {
            log.Printf("Error: %v", err)
        } else {
            for _, u := range users {
                fmt.Printf("User: %+v\n", u)
            }
        }
    }
    ```

=== "The Explanation"

    - **QueryRowContext**: Executes query with context for cancellation
    - **Scan**: Maps columns to Go variables
    - **sql.ErrNoRows**: Check for empty results
    - **rows.Close**: Always close rows to release connections
    - **rows.Err**: Check for iteration errors after loop

=== "The Terminal Output"

    ```
    User: {ID:1 Name:Alice Email:alice@example.com CreatedAt:2024-01-15 10:30:00 +0000 UTC}
    User: {ID:2 Name:Bob Email:bob@example.com CreatedAt:2024-01-15 11:00:00 +0000 UTC}
    ```

!!! danger "Resource Leak"
    Always `defer rows.Close()` immediately after `QueryContext`. Forgetting this leaks database connections.

---

## Insert, Update, Delete

Execute write operations and track affected rows.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "database/sql"
        "fmt"
        "log"

        _ "github.com/jackc/pgx/v5/stdlib"
    )

    func insertUser(ctx context.Context, db *sql.DB, name, email string) (int64, error) {
        query := `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id`

        var id int64
        err := db.QueryRowContext(ctx, query, name, email).Scan(&id)
        if err != nil {
            return 0, fmt.Errorf("insert user: %w", err)
        }

        return id, nil
    }

    func updateUser(ctx context.Context, db *sql.DB, id int64, name string) (int64, error) {
        query := `UPDATE users SET name = $1 WHERE id = $2`

        result, err := db.ExecContext(ctx, query, name, id)
        if err != nil {
            return 0, fmt.Errorf("update user: %w", err)
        }

        rows, err := result.RowsAffected()
        if err != nil {
            return 0, fmt.Errorf("rows affected: %w", err)
        }

        return rows, nil
    }

    func deleteUser(ctx context.Context, db *sql.DB, id int64) error {
        query := `DELETE FROM users WHERE id = $1`

        result, err := db.ExecContext(ctx, query, id)
        if err != nil {
            return fmt.Errorf("delete user: %w", err)
        }

        rows, err := result.RowsAffected()
        if err != nil {
            return fmt.Errorf("rows affected: %w", err)
        }

        if rows == 0 {
            return fmt.Errorf("user %d not found", id)
        }

        return nil
    }

    func main() {
        db, err := sql.Open("pgx", "postgres://user:pass@localhost:5432/mydb?sslmode=disable")
        if err != nil {
            log.Fatal(err)
        }
        defer db.Close()

        ctx := context.Background()

        id, err := insertUser(ctx, db, "Charlie", "charlie@example.com")
        if err != nil {
            log.Fatal(err)
        }
        fmt.Printf("Inserted user with ID: %d\n", id)

        affected, err := updateUser(ctx, db, id, "Charles")
        if err != nil {
            log.Fatal(err)
        }
        fmt.Printf("Updated %d row(s)\n", affected)

        err = deleteUser(ctx, db, id)
        if err != nil {
            log.Fatal(err)
        }
        fmt.Println("User deleted")
    }
    ```

=== "The Explanation"

    - **RETURNING id**: Gets auto-generated ID without extra query
    - **ExecContext**: For INSERT/UPDATE/DELETE without result set
    - **RowsAffected**: Returns number of modified rows
    - **Error checking**: Verify at least one row affected for updates/deletes

=== "The Terminal Output"

    ```
    Inserted user with ID: 123
    Updated 1 row(s)
    User deleted
    ```

!!! go "RETURNING Clause"
    Use PostgreSQL's `RETURNING` clause to get inserted/updated data without a separate SELECT query.

---

## Prepared Statements

Optimize repeated queries with prepared statements.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "database/sql"
        "fmt"
        "log"

        _ "github.com/jackc/pgx/v5/stdlib"
    )

    func main() {
        db, err := sql.Open("pgx", "postgres://user:pass@localhost:5432/mydb?sslmode=disable")
        if err != nil {
            log.Fatal(err)
        }
        defer db.Close()

        ctx := context.Background()

        stmt, err := db.PrepareContext(ctx, `SELECT id, name, email FROM users WHERE id = $1`)
        if err != nil {
            log.Fatal(err)
        }
        defer stmt.Close()

        for i := 1; i <= 3; i++ {
            var id int64
            var name, email string

            err := stmt.QueryRowContext(ctx, i).Scan(&id, &name, &email)
            if err != nil {
                if err == sql.ErrNoRows {
                    fmt.Printf("User %d not found\n", i)
                    continue
                }
                log.Fatal(err)
            }

            fmt.Printf("User %d: %s (%s)\n", id, name, email)
        }
    }
    ```

=== "The Explanation"

    - **db.PrepareContext**: Compiles SQL once, reuses execution plan
    - **stmt.QueryRowContext**: Executes prepared statement with parameters
    - **Defer close**: Release statement resources after use
    - **Performance**: Reduces parsing overhead for repeated queries

=== "The Terminal Output"

    ```
    User 1: Alice (alice@example.com)
    User 2: Bob (bob@example.com)
    User 3: Charlie (charlie@example.com)
    ```

!!! note "When to Use"
    Prepared statements shine when executing the same query multiple times with different parameters.

---

## Transactions

Ensure atomicity with database transactions.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "database/sql"
        "fmt"
        "log"

        _ "github.com/jackc/pgx/v5/stdlib"
    )

    func transferMoney(ctx context.Context, db *sql.DB, fromID, toID int64, amount float64) error {
        tx, err := db.BeginTx(ctx, nil)
        if err != nil {
            return fmt.Errorf("begin transaction: %w", err)
        }
        defer tx.Rollback()

        _, err = tx.ExecContext(ctx, `UPDATE accounts SET balance = balance - $1 WHERE id = $2`, amount, fromID)
        if err != nil {
            return fmt.Errorf("debit failed: %w", err)
        }

        _, err = tx.ExecContext(ctx, `UPDATE accounts SET balance = balance + $1 WHERE id = $2`, amount, toID)
        if err != nil {
            return fmt.Errorf("credit failed: %w", err)
        }

        if err := tx.Commit(); err != nil {
            return fmt.Errorf("commit failed: %w", err)
        }

        return nil
    }

    func main() {
        db, err := sql.Open("pgx", "postgres://user:pass@localhost:5432/mydb?sslmode=disable")
        if err != nil {
            log.Fatal(err)
        }
        defer db.Close()

        ctx := context.Background()

        err = transferMoney(ctx, db, 1, 2, 100.00)
        if err != nil {
            log.Printf("Transfer failed: %v", err)
        } else {
            fmt.Println("Transfer completed")
        }
    }
    ```

=== "The Explanation"

    - **BeginTx**: Starts transaction with optional isolation level
    - **defer Rollback**: Safe cleanup if commit isn't reached
    - **ExecContext**: Executes statements within transaction
    - **Commit**: Finalizes changes; Rollback becomes no-op

=== "The Terminal Output"

    ```
    Transfer completed
    ```

!!! danger "Transaction Safety"
    Always defer Rollback immediately after BeginTx. It's safe to call even after successful Commit.

---

## Context with Queries

Cancel long-running queries using context.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "database/sql"
        "fmt"
        "log"
        "time"

        _ "github.com/jackc/pgx/v5/stdlib"
    )

    func main() {
        db, err := sql.Open("pgx", "postgres://user:pass@localhost:5432/mydb?sslmode=disable")
        if err != nil {
            log.Fatal(err)
        }
        defer db.Close()

        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()

        rows, err := db.QueryContext(ctx, `
            SELECT pg_sleep(10), id, name 
            FROM users 
            WHERE id = 1
        `)
        if err != nil {
            log.Printf("Query error: %v", err)
            return
        }
        defer rows.Close()

        fmt.Println("Query completed (unexpectedly)")
    }
    ```

=== "The Explanation"

    - **WithTimeout**: Creates context that cancels after duration
    - **QueryContext**: Respects context cancellation
    - **pg_sleep(10)**: Simulates slow query (10 seconds)
    - **5 second timeout**: Query cancelled before completion

=== "The Terminal Output"

    ```
    Query error: context deadline exceeded
    ```

!!! go "Query Timeouts"
    Always use context timeouts for production queries. Prevents connection pool exhaustion from stuck queries.

---

## SQL Injection Prevention

Never concatenate user input into SQL queries.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "database/sql"
        "fmt"
        "log"
        "strings"

        _ "github.com/jackc/pgx/v5/stdlib"
    )

    func unsafeQuery(db *sql.DB, username string) {
        query := fmt.Sprintf("SELECT * FROM users WHERE name = '%s'", username)
        fmt.Println("Dangerous query:", query)

        rows, err := db.Query(query)
        if err != nil {
            log.Printf("Error: %v", err)
            return
        }
        defer rows.Close()
    }

    func safeQuery(ctx context.Context, db *sql.DB, username string) error {
        query := `SELECT id, name, email FROM users WHERE name = $1`

        rows, err := db.QueryContext(ctx, query, username)
        if err != nil {
            return fmt.Errorf("query: %w", err)
        }
        defer rows.Close()

        for rows.Next() {
            var id int64
            var name, email string
            if err := rows.Scan(&id, &name, &email); err != nil {
                return fmt.Errorf("scan: %w", err)
            }
            fmt.Printf("User: %d %s %s\n", id, name, email)
        }

        return rows.Err()
    }

    func main() {
        db, err := sql.Open("pgx", "postgres://user:pass@localhost:5432/mydb?sslmode=disable")
        if err != nil {
            log.Fatal(err)
        }
        defer db.Close()

        malicious := "'; DROP TABLE users; --"
        fmt.Printf("Input: %s\n", malicious)

        fmt.Println("Unsafe query:")
        unsafeQuery(db, malicious)

        fmt.Println("\nSafe query:")
        ctx := context.Background()
        err = safeQuery(ctx, db, malicious)
        if err != nil {
            log.Printf("Error: %v", err)
        }
    }
    ```

=== "The Explanation"

    - **String concatenation**: Creates SQL injection vulnerability
    - **Parameterized query**: Uses $1 placeholder for safe parameter binding
    - **Driver escaping**: Database driver properly escapes input
    - **No parsing risk**: Parameters never parsed as SQL

=== "The Terminal Output"

    ```
    Input: '; DROP TABLE users; --
    Unsafe query:
    Dangerous query: SELECT * FROM users WHERE name = ''; DROP TABLE users; --'
    
    Safe query:
    ```

!!! danger "Never Concatenate SQL"
    Always use parameterized queries. String concatenation is the #1 cause of SQL injection vulnerabilities.

---

## Migrations

Manage database schema changes.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "database/sql"
        "fmt"
        "log"

        _ "github.com/jackc/pgx/v5/stdlib"
    )

    type Migration struct {
        Version int
        Name    string
        SQL     string
    }

    var migrations = []Migration{
        {
            Version: 1,
            Name:    "create_users_table",
            SQL: `CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
        },
        {
            Version: 2,
            Name:    "create_posts_table",
            SQL: `CREATE TABLE IF NOT EXISTS posts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                title VARCHAR(255) NOT NULL,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
        },
    }

    func migrate(ctx context.Context, db *sql.DB) error {
        _, err := db.ExecContext(ctx, `
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)
        if err != nil {
            return fmt.Errorf("create migrations table: %w", err)
        }

        for _, m := range migrations {
            var exists bool
            err := db.QueryRowContext(ctx,
                `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`,
                m.Version,
            ).Scan(&exists)
            if err != nil {
                return fmt.Errorf("check migration %d: %w", m.Version, err)
            }

            if exists {
                continue
            }

            tx, err := db.BeginTx(ctx, nil)
            if err != nil {
                return fmt.Errorf("begin migration %d: %w", m.Version, err)
            }

            if _, err := tx.ExecContext(ctx, m.SQL); err != nil {
                tx.Rollback()
                return fmt.Errorf("execute migration %d: %w", m.Version, err)
            }

            if _, err := tx.ExecContext(ctx,
                `INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`,
                m.Version, m.Name,
            ); err != nil {
                tx.Rollback()
                return fmt.Errorf("record migration %d: %w", m.Version, err)
            }

            if err := tx.Commit(); err != nil {
                return fmt.Errorf("commit migration %d: %w", m.Version, err)
            }

            fmt.Printf("Applied migration %d: %s\n", m.Version, m.Name)
        }

        return nil
    }

    func main() {
        db, err := sql.Open("pgx", "postgres://user:pass@localhost:5432/mydb?sslmode=disable")
        if err != nil {
            log.Fatal(err)
        }
        defer db.Close()

        ctx := context.Background()

        if err := migrate(ctx, db); err != nil {
            log.Fatal(err)
        }

        fmt.Println("Migrations complete")
    }
    ```

=== "The Explanation"

    - **Migration struct**: Version, name, and SQL for each migration
    - **Schema tracking**: schema_migrations table records applied versions
    - **Idempotent execution**: Skips already-applied migrations
    - **Transactional**: Each migration runs in its own transaction

=== "The Terminal Output"

    ```
    Applied migration 1: create_users_table
    Applied migration 2: create_posts_table
    Migrations complete
    ```

!!! abstract "Migration Tools"
    For production use, consider established tools like golang-migrate, goose, or Atlas for migration management.

---

## Connection Health

Monitor and maintain database connections.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "database/sql"
        "fmt"
        "log"
        "time"

        _ "github.com/jackc/pgx/v5/stdlib"
    )

    func monitorHealth(db *sql.DB, interval time.Duration) {
        ticker := time.NewTicker(interval)
        defer ticker.Stop()

        for range ticker.C {
            ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)

            start := time.Now()
            err := db.PingContext(ctx)
            duration := time.Since(start)

            cancel()

            stats := db.Stats()

            if err != nil {
                log.Printf("Health check FAILED: %v (took %v)", err, duration)
                continue
            }

            log.Printf("Health OK: latency=%v open=%d in_use=%d idle=%d wait_count=%d",
                duration,
                stats.OpenConnections,
                stats.InUse,
                stats.Idle,
                stats.WaitCount,
            )
        }
    }

    func main() {
        db, err := sql.Open("pgx", "postgres://user:pass@localhost:5432/mydb?sslmode=disable")
        if err != nil {
            log.Fatal(err)
        }
        defer db.Close()

        db.SetMaxOpenConns(25)
        db.SetMaxIdleConns(5)

        go monitorHealth(db, 30*time.Second)

        ctx := context.Background()

        for i := 0; i < 5; i++ {
            var result int
            err := db.QueryRowContext(ctx, `SELECT 1`).Scan(&result)
            if err != nil {
                log.Printf("Query error: %v", err)
            } else {
                fmt.Printf("Query result: %d\n", result)
            }
            time.Sleep(2 * time.Second)
        }

        time.Sleep(35 * time.Second)
    }
    ```

=== "The Explanation"

    - **PingContext**: Verifies connection is alive
    - **db.Stats**: Returns pool statistics
    - **Ticker**: Periodic health checks
    - **OpenConnections**: Current connections in pool
    - **InUse**: Currently executing queries
    - **WaitCount**: Times pool was exhausted

=== "The Terminal Output"

    ```
    Query result: 1
    Query result: 1
    Health OK: latency=1.2ms open=1 in_use=0 idle=1 wait_count=0
    ```

!!! go "Monitoring"
    Expose connection pool stats via metrics endpoint (Prometheus, etc.) for production monitoring.

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Use context always | Pass context to all database operations |
| Close resources | Defer rows.Close(), stmt.Close() |
| Check sql.ErrNoRows | Handle empty results gracefully |
| Use transactions | Group related operations atomically |
| Parameterize queries | Prevent SQL injection |
| Set pool limits | Match database connection limits |
| Monitor health | Track connection pool metrics |

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Connection refused | Wrong host/port or DB down | Verify connection string and DB status |
| Too many connections | Pool exhausted | Reduce MaxOpenConns or increase DB limit |
| Timeout errors | Query too slow | Add context timeout, optimize query |
| Scan errors | Column type mismatch | Verify Go types match SQL types |
| Transaction deadlock | Concurrent conflicting writes | Use optimistic locking or retry logic |

## Summary

- database/sql provides a universal SQL interface
- Connection pooling is essential for performance
- Use context for cancellation and timeouts
- Always use parameterized queries
- Transactions ensure atomicity
- Monitor connection pool health
- Migrations track schema changes

## Next Steps

- [ORM & GORM](orm-gorm.md)
- [Caching](caching.md)
- [Testing Databases](../basics/testing.md)
- [Performance Tuning](../production/performance.md)
