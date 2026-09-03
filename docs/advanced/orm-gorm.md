# ORM & GORM

GORM is a popular Go ORM library that simplifies database operations. This guide covers models, CRUD operations, associations, hooks, and performance considerations.

## What You Will Learn

- GORM overview and installation
- Model definitions and conventions
- CRUD operations
- Association handling
- Lifecycle hooks
- Transaction management
- Schema migrations
- Query scopes
- Raw SQL execution
- Performance optimization
- GORM vs sqlx comparison

## Prerequisites

- Understanding of Go structs
- Basic SQL knowledge
- Familiarity with interfaces

---

## GORM Installation

Install GORM and drivers.

```bash
go get -u gorm.io/gorm
go get -u gorm.io/driver/postgres
go get -u gorm.io/driver/mysql
go get -u gorm.io/driver/sqlite
```

!!! go "Driver Selection"
    GORM supports multiple databases. Choose the driver matching your database.

---

## Model Definitions

Define models using Go structs.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "time"

        "gorm.io/driver/sqlite"
        "gorm.io/gorm"
    )

    type User struct {
        gorm.Model
        Name      string
        Email     string    `gorm:"uniqueIndex"`
        Age       int
        CreatedAt time.Time
        UpdatedAt time.Time
        DeletedAt gorm.DeletedAt `gorm:"index"`
    }

    type Product struct {
        ID          uint   `gorm:"primaryKey"`
        Name        string `gorm:"size:100;not null"`
        Description string `gorm:"type:text"`
        Price       float64
        InStock     bool   `gorm:"default:true"`
        CreatedAt   time.Time
        UpdatedAt   time.Time
    }

    func main() {
        db, err := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
        if err != nil {
            panic("failed to connect database")
        }

        db.AutoMigrate(&User{}, &Product{})

        fmt.Println("Models migrated successfully")
    }
    ```

=== "The Explanation"

    - **gorm.Model**: Includes ID, CreatedAt, UpdatedAt, DeletedAt fields
    - **gorm tags**: Define column constraints (unique, size, not null)
    - **gorm.DeletedAt**: Enables soft deletes
    - **AutoMigrate**: Creates/updates tables based on models
    - **primaryKey**: Designates primary key column

=== "The Terminal Output"

    ```
    Models migrated successfully
    ```

!!! note "Model Conventions"
    GORM uses conventions for table names (pluralized), column names (snake_case), and relationships.

---

## CRUD Operations

Perform Create, Read, Update, Delete operations.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"

        "gorm.io/driver/sqlite"
        "gorm.io/gorm"
    )

    type User struct {
        gorm.Model
        Name  string
        Email string
        Age   int
    }

    func main() {
        db, err := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
        if err != nil {
            log.Fatal(err)
        }
        db.AutoMigrate(&User{})

        // CREATE
        user := User{Name: "Alice", Email: "alice@example.com", Age: 30}
        result := db.Create(&user)
        if result.Error != nil {
            log.Fatal(result.Error)
        }
        fmt.Printf("Created user ID: %d\n", user.ID)

        // CREATE MULTIPLE
        users := []User{
            {Name: "Bob", Email: "bob@example.com", Age: 25},
            {Name: "Charlie", Email: "charlie@example.com", Age: 35},
        }
        result = db.Create(&users)
        fmt.Printf("Created %d users\n", result.RowsAffected)

        // READ - First
        var first User
        db.First(&first, 1)
        fmt.Printf("First: %+v\n", first)

        // READ - Where
        var found User
        db.Where("email = ?", "bob@example.com").First(&found)
        fmt.Printf("Found: %+v\n", found)

        // READ - All
        var allUsers []User
        db.Find(&allUsers)
        fmt.Printf("Total users: %d\n", len(allUsers))

        // UPDATE - Single field
        db.Model(&user).Update("Name", "Alice Updated")
        fmt.Println("Updated name")

        // UPDATE - Multiple fields
        db.Model(&user).Updates(User{Name: "Alice Final", Age: 31})
        fmt.Println("Updated multiple fields")

        // DELETE
        db.Delete(&User{}, 3)
        fmt.Println("Deleted user 3")

        // SOFT DELETE
        db.Delete(&user)
        fmt.Println("Soft deleted user")
    }
    ```

=== "The Explanation"

    - **Create**: Inserts new record, auto-fills ID
    - **First**: Retrieves first record by primary key
    - **Where**: Filters records with conditions
    - **Find**: Retrieves all matching records
    - **Update**: Modifies single or multiple fields
    - **Delete**: Soft deletes if DeletedAt field exists
    - **RowsAffected**: Number of records affected

=== "The Terminal Output"

    ```
    Created user ID: 1
    Created 2 users
    First: {Model:{ID:1 CreatedAt:...} Name:Alice Email:alice@example.com Age:30}
    Found: {Model:{ID:2 CreatedAt:...} Name:Bob Email:bob@example.com Age:25}
    Total users: 3
    Updated name
    Updated multiple fields
    Deleted user 3
    Soft deleted user
    ```

!!! go "Soft Deletes"
    GORM automatically uses soft deletes when DeletedAt field exists. Records are marked deleted, not removed.

---

## Associations

Handle relationships between models.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"

        "gorm.io/driver/sqlite"
        "gorm.io/gorm"
    )

    type User struct {
        gorm.Model
        Name     string
        Emails   []Email
        Profile  Profile
        Orders   []Order
    }

    type Email struct {
        gorm.Model
        UserID uint
        Email  string
        Primary bool
    }

    type Profile struct {
        gorm.Model
        UserID   uint
        Bio      string
        Avatar   string
    }

    type Order struct {
        gorm.Model
        UserID  uint
        Product string
        Amount  float64
    }

    func main() {
        db, err := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
        if err != nil {
            log.Fatal(err)
        }
        db.AutoMigrate(&User{}, &Email{}, &Profile{}, &Order{})

        // CREATE WITH ASSOCIATIONS
        user := User{
            Name: "Alice",
            Emails: []Email{
                {Email: "alice@example.com", Primary: true},
                {Email: "alice.work@company.com", Primary: false},
            },
            Profile: Profile{
                Bio: "Software Developer",
                Avatar: "avatar.jpg",
            },
            Orders: []Order{
                {Product: "Laptop", Amount: 999.99},
                {Product: "Mouse", Amount: 29.99},
            },
        }
        db.Create(&user)

        // READ WITH ASSOCIATIONS
        var loaded User
        db.Preload("Emails").Preload("Profile").Preload("Orders").First(&loaded, 1)

        fmt.Printf("User: %s\n", loaded.Name)
        fmt.Printf("Emails: %d\n", len(loaded.Emails))
        fmt.Printf("Profile: %s\n", loaded.Profile.Bio)
        fmt.Printf("Orders: %d\n", len(loaded.Orders))

        // ASSOCIATIONS - ADD
        newEmail := Email{Email: "alice.new@example.com", Primary: false}
        db.Model(&loaded).Association("Emails").Add(&newEmail)

        // ASSOCIATIONS - REPLACE
        newProfile := Profile{Bio: "Senior Developer", Avatar: "new.jpg"}
        db.Model(&loaded).Association("Profile").Replace(&newProfile)

        // ASSOCIATIONS - DELETE
        db.Model(&loaded).Association("Emails").Delete(&loaded.Emails[0])

        // ASSOCIATIONS - COUNT
        count := db.Model(&loaded).Association("Orders").Count()
        fmt.Printf("Order count: %d\n", count)
    }
    ```

=== "The Explanation"

    - **Has Many**: User has multiple Emails and Orders
    - **Has One**: User has one Profile
    - **Preload**: Eager loads associated records
    - **Association methods**: Add, Replace, Delete, Clear, Count
    - **Foreign key**: Automatically linked by convention (UserID)

=== "The Terminal Output"

    ```
    User: Alice
    Emails: 2
    Profile: Software Developer
    Orders: 2
    Order count: 2
    ```

!!! abstract "Association Types"
    GORM supports Has One, Has Many, Belongs To, and Many-to-Many relationships through struct tags.

---

## Hooks

Execute custom logic at lifecycle events.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "strings"

        "gorm.io/driver/sqlite"
        "gorm.io/gorm"
    )

    type User struct {
        gorm.Model
        Name     string
        Email    string
        Password string `gorm:"-"`
    }

    func (u *User) BeforeCreate(tx *gorm.DB) error {
        fmt.Printf("BeforeCreate: Creating user %s\n", u.Name)
        if u.Email == "" {
            return fmt.Errorf("email is required")
        }
        return nil
    }

    func (u *User) AfterCreate(tx *gorm.DB) error {
        fmt.Printf("AfterCreate: User %d created\n", u.ID)
        return nil
    }

    func (u *User) BeforeUpdate(tx *gorm.DB) error {
        fmt.Printf("BeforeUpdate: Updating user %d\n", u.ID)
        return nil
    }

    func (u *User) AfterUpdate(tx *gorm.DB) error {
        fmt.Printf("AfterUpdate: User %d updated\n", u.ID)
        return nil
    }

    func (u *User) BeforeDelete(tx *gorm.DB) error {
        fmt.Printf("BeforeDelete: Deleting user %d\n", u.ID)
        return nil
    }

    func (u *User) AfterDelete(tx *gorm.DB) error {
        fmt.Printf("AfterDelete: User %d deleted\n", u.ID)
        return nil
    }

    func (u *User) AfterFind(tx *gorm.DB) error {
        u.Name = strings.TrimSpace(u.Name)
        return nil
    }

    func main() {
        db, err := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
        if err != nil {
            log.Fatal(err)
        }
        db.AutoMigrate(&User{})

        user := User{Name: "Alice", Email: "alice@example.com"}
        db.Create(&user)

        db.Model(&user).Update("Name", "Bob")
        db.Delete(&user)

        var found User
        db.First(&found, 1)
    }
    ```

=== "The Explanation"

    - **BeforeCreate**: Validates data before insertion
    - **AfterCreate**: Post-processing after successful creation
    - **BeforeUpdate**: Modifies data before update
    - **AfterUpdate**: Logging after update
    - **BeforeDelete**: Pre-deletion logic
    - **AfterDelete**: Cleanup after deletion
    - **AfterFind**: Modifies data after retrieval

=== "The Terminal Output"

    ```
    BeforeCreate: Creating user Alice
    AfterCreate: User 1 created
    BeforeUpdate: Updating user 1
    AfterUpdate: User 1 updated
    BeforeDelete: Deleting user 1
    AfterDelete: User 1 deleted
    ```

!!! go "Hook Timing"
    Hooks run before/after GORM operations. Return error to abort the operation.

---

## Transactions

Manage transactions with GORM.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"

        "gorm.io/driver/sqlite"
        "gorm.io/gorm"
    )

    type Account struct {
        gorm.Model
        Name    string
        Balance float64
    }

    func transfer(db *gorm.DB, fromID, toID uint, amount float64) error {
        return db.Transaction(func(tx *gorm.DB) error {
            var from, to Account

            if err := tx.First(&from, fromID).Error; err != nil {
                return fmt.Errorf("from account not found: %w", err)
            }

            if err := tx.First(&to, toID).Error; err != nil {
                return fmt.Errorf("to account not found: %w", err)
            }

            if from.Balance < amount {
                return fmt.Errorf("insufficient funds")
            }

            from.Balance -= amount
            to.Balance += amount

            if err := tx.Save(&from).Error; err != nil {
                return fmt.Errorf("update from account: %w", err)
            }

            if err := tx.Save(&to).Error; err != nil {
                return fmt.Errorf("update to account: %w", err)
            }

            return nil
        })
    }

    func main() {
        db, err := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
        if err != nil {
            log.Fatal(err)
        }
        db.AutoMigrate(&Account{})

        db.Create(&Account{Name: "Alice", Balance: 1000})
        db.Create(&Account{Name: "Bob", Balance: 500})

        if err := transfer(db, 1, 2, 200); err != nil {
            log.Printf("Transfer failed: %v", err)
        } else {
            fmt.Println("Transfer successful")
        }

        var accounts []Account
        db.Find(&accounts)
        for _, a := range accounts {
            fmt.Printf("%s: $%.2f\n", a.Name, a.Balance)
        }
    }
    ```

=== "The Explanation"

    - **db.Transaction**: Wraps operations in transaction
    - **Auto-commit**: Returns nil to commit
    - **Auto-rollback**: Returns error to rollback
    - **Nested operations**: All operations use same transaction

=== "The Terminal Output"

    ```
    Transfer successful
    Alice: $800.00
    Bob: $700.00
    ```

!!! danger "Transaction Safety"
    Always check errors within transactions. Any error automatically rolls back all changes.

---

## Migrations

Manage schema with GORM's migration features.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"

        "gorm.io/driver/sqlite"
        "gorm.io/gorm"
    )

    type User struct {
        gorm.Model
        Name     string
        Email    string `gorm:"uniqueIndex"`
        Age      int    `gorm:"default:0"`
        IsActive bool   `gorm:"default:true"`
    }

    func main() {
        db, err := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
        if err != nil {
            log.Fatal(err)
        }

        // AUTO MIGRATE
        err = db.AutoMigrate(&User{})
        if err != nil {
            log.Fatal(err)
        }
        fmt.Println("AutoMigrate completed")

        // CREATE TABLE
        db.Migrator().CreateTable(&User{})
        fmt.Println("CreateTable completed")

        // HAS TABLE
        has := db.Migrator().HasTable(&User{})
        fmt.Printf("Has User table: %v\n", has)

        // HAS COLUMN
        hasCol := db.Migrator().HasColumn(&User{}, "Email")
        fmt.Printf("Has Email column: %v\n", hasCol)

        // ADD COLUMN
        type UserV2 struct {
            gorm.Model
            Name     string
            Email    string `gorm:"uniqueIndex"`
            Phone    string
            Age      int    `gorm:"default:0"`
            IsActive bool   `gorm:"default:true"`
        }
        db.AutoMigrate(&UserV2{})
        fmt.Println("Added Phone column")

        // DROP TABLE
        db.Migrator().DropTable(&User{})
        fmt.Println("Dropped User table")
    }
    ```

=== "The Explanation"

    - **AutoMigrate**: Creates tables, adds missing columns, indexes
    - **CreateTable**: Explicitly creates table
    - **HasTable/HasColumn**: Check existence before operations
    - **Versioned models**: Create new model versions for migrations
    - **DropTable**: Removes table

=== "The Terminal Output"

    ```
    AutoMigrate completed
    CreateTable completed
    Has User table: true
    Has Email column: true
    Added Phone column
    Dropped User table
    ```

!!! abstract "Production Migrations"
    For production, use dedicated migration tools (golang-migrate, Atlas) instead of AutoMigrate.

---

## Scopes

Create reusable query filters.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"

        "gorm.io/driver/sqlite"
        "gorm.io/gorm"
    )

    type User struct {
        gorm.Model
        Name     string
        Email    string
        Age      int
        IsActive bool
    }

    func ActiveUsers(db *gorm.DB) *gorm.DB {
        return db.Where("is_active = ?", true)
    }

    func Adults(db *gorm.DB) *gorm.DB {
        return db.Where("age >= ?", 18)
    }

    func WithEmail(db *gorm.DB) *gorm.DB {
        return db.Where("email != ?", "")
    }

    func Paginate(page, pageSize int) func(db *gorm.DB) *gorm.DB {
        return func(db *gorm.DB) *gorm.DB {
            if page <= 0 {
                page = 1
            }
            if pageSize <= 0 {
                pageSize = 10
            }
            offset := (page - 1) * pageSize
            return db.Offset(offset).Limit(pageSize)
        }
    }

    func main() {
        db, err := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
        if err != nil {
            log.Fatal(err)
        }
        db.AutoMigrate(&User{})

        users := []User{
            {Name: "Alice", Email: "alice@example.com", Age: 30, IsActive: true},
            {Name: "Bob", Email: "bob@example.com", Age: 17, IsActive: true},
            {Name: "Charlie", Email: "", Age: 25, IsActive: false},
        }
        db.Create(&users)

        // SINGLE SCOPE
        var active []User
        db.Scopes(ActiveUsers).Find(&active)
        fmt.Printf("Active users: %d\n", len(active))

        // CHAINED SCOPES
        var activeAdultsWithEmail []User
        db.Scopes(ActiveUsers, Adults, WithEmail).Find(&activeAdultsWithEmail)
        fmt.Printf("Active adults with email: %d\n", len(activeAdultsWithEmail))

        // PAGINATED
        var page1 []User
        db.Scopes(Paginate(1, 2)).Find(&page1)
        fmt.Printf("Page 1: %d users\n", len(page1))
    }
    ```

=== "The Explanation"

    - **Scope functions**: Reusable query conditions
    - **Chaining**: Combine multiple scopes with comma
    - **Paginate**: Closure returning scope with pagination
    - **Composability**: Mix and match scopes as needed

=== "The Terminal Output"

    ```
    Active users: 2
    Active adults with email: 1
    Page 1: 2 users
    ```

!!! go "Scope Composition"
    Scopes enable building complex queries from simple, testable functions.

---

## Raw SQL

Execute raw SQL when GORM's query builder isn't sufficient.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"

        "gorm.io/driver/sqlite"
        "gorm.io/gorm"
    )

    type User struct {
        gorm.Model
        Name  string
        Email string
        Age   int
    }

    type UserStats struct {
        Name  string
        Count int
    }

    func main() {
        db, err := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
        if err != nil {
            log.Fatal(err)
        }
        db.AutoMigrate(&User{})

        users := []User{
            {Name: "Alice", Email: "alice@example.com", Age: 30},
            {Name: "Bob", Email: "bob@example.com", Age: 25},
            {Name: "Charlie", Email: "charlie@example.com", Age: 35},
        }
        db.Create(&users)

        // RAW QUERY
        var result User
        db.Raw("SELECT * FROM users WHERE id = ?", 1).Scan(&result)
        fmt.Printf("Raw query: %+v\n", result)

        // RAW QUERY WITH MULTIPLE RESULTS
        var allUsers []User
        db.Raw("SELECT * FROM users WHERE age > ?", 20).Scan(&allUsers)
        fmt.Printf("Users over 20: %d\n", len(allUsers))

        // AGGREGATE QUERY
        var count int
        db.Raw("SELECT COUNT(*) FROM users").Scan(&count)
        fmt.Printf("Total users: %d\n", count)

        // CUSTOM STRUCT SCANNING
        var stats []UserStats
        db.Raw(`
            SELECT name, COUNT(*) as count 
            FROM users 
            GROUP BY name
        `).Scan(&stats)
        fmt.Printf("Stats: %+v\n", stats)

        // EXEC RAW SQL
        db.Exec("UPDATE users SET age = age + 1 WHERE age < ?", 30)
        fmt.Println("Incremented ages")

        // SQL BUILDER
        db.Where("age > ?", 20).
            Order("name ASC").
            Limit(2).
            Find(&allUsers)
        fmt.Printf("Query builder: %d users\n", len(allUsers))
    }
    ```

=== "The Explanation"

    - **Raw**: Executes raw SQL query
    - **Scan**: Maps results to struct
    - **Exec**: Executes statements without result set
    - **Custom structs**: Map aggregated results
    - **Query builder**: Chainable methods for complex queries

=== "The Terminal Output"

    ```
    Raw query: {Model:{ID:1} Name:Alice Email:alice@example.com Age:30}
    Users over 20: 3
    Total users: 3
    Stats: [{Name:Alice Count:1} {Name:Bob Count:1} {Name:Charlie Count:1}]
    Incremented ages
    Query builder: 2 users
    ```

!!! warning "Raw SQL"
    Raw SQL bypasses GORM's safety features. Use only when query builder cannot express the logic.

---

## Performance Considerations

Optimize GORM queries.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"

        "gorm.io/driver/sqlite"
        "gorm.io/gorm"
    )

    type User struct {
        gorm.Model
        Name    string
        Email   string
        Profile Profile
    }

    type Profile struct {
        gorm.Model
        UserID uint
        Bio    string
    }

    func main() {
        db, err := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
        if err != nil {
            log.Fatal(err)
        }
        db.AutoMigrate(&User{}, &Profile{})

        // EAGER LOADING
        var user User
        db.Preload("Profile").First(&user, 1)

        // BATCH PRELOAD
        var users []User
        db.Preload("Profile").Find(&users)

        // SELECT SPECIFIC COLUMNS
        var names []string
        db.Model(&User{}).Pluck("name", &names)

        // SCOPES FOR PERFORMANCE
        var filtered []User
        db.Scopes(
            func(db *gorm.DB) *gorm.DB {
                return db.Select("id, name, email")
            },
        ).Find(&filtered)

        // BATCH OPERATIONS
        batchSize := 100
        var largeUsers []User
        db.FindInBatches(&largeUsers, batchSize, func(tx *gorm.DB, batch int) error {
            fmt.Printf("Processing batch %d: %d users\n", batch, len(largeUsers))
            return nil
        })

        // COUNTER
        var count int64
        db.Model(&User{}).Where("age > ?", 18).Count(&count)
        fmt.Printf("Adult users: %d\n", count)

        fmt.Println("Performance optimization examples completed")
    }
    ```

=== "The Explanation"

    - **Preload**: Eager loads associations to prevent N+1 queries
    - **FindInBatches**: Processes large datasets in chunks
    - **Pluck**: Extracts single column values
    - **Select**: Limits columns retrieved
    - **Count**: Efficient counting without loading records

=== "The Terminal Output"

    ```
    Processing batch 0: 0 users
    Adult users: 0
    Performance optimization examples completed
    ```

!!! go "N+1 Prevention"
    Always use Preload for associations you'll access. Each unloaded association triggers separate query.

---

## GORM vs sqlx Comparison

| Feature | GORM | sqlx |
|---------|------|------|
| Learning Curve | Medium | Low |
| Type Safety | Runtime | Compile-time |
| Query Builder | Yes | No |
| Migrations | Built-in | External |
| Performance | Overhead | Minimal |
| Flexibility | Limited | Full SQL |
| Associations | Built-in | Manual |
| Hooks | Built-in | Manual |
| Best For | CRUD apps | Performance |

!!! abstract "Choosing Between"
    Use GORM for rapid development with complex models. Use sqlx for performance-critical queries or when you need full SQL control.

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Use transactions | Group related operations |
| Avoid N+1 queries | Use Preload for associations |
| Batch inserts | Use CreateInBatches for large datasets |
| Validate in hooks | Use BeforeCreate/Update hooks |
| Index frequently queried columns | Add gorm:"index" tags |
| Use scopes | Create reusable query filters |
| Monitor queries | Enable logger for debugging |

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| N+1 queries | Missing Preload | Add Preload for associations |
| Slow queries | Missing indexes | Add database indexes |
| Lock timeouts | Long transactions | Keep transactions short |
| Migration errors | Schema mismatch | Run AutoMigrate or check schema |
| Memory issues | Large result sets | Use FindInBatches |

## Summary

- GORM simplifies database operations with ORM patterns
- Models define schema through struct tags
- Associations handle relationships automatically
- Hooks enable custom lifecycle logic
- Transactions ensure data consistency
- Scopes create reusable queries
- Raw SQL available when needed
- Performance optimization through batching and preloading

## Next Steps

- [Caching](caching.md)
- [Database & SQL](database-sql.md)
- [Testing with GORM](../basics/testing.md)
- [Performance Tuning](../production/performance.md)
