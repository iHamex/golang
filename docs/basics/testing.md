# Testing

Testing is a critical part of building reliable Go applications. Go's built-in `testing` package provides a comprehensive framework for writing unit tests, benchmarks, fuzz tests, and example tests. Good tests help catch bugs early, document expected behavior, and enable confident refactoring.

---

## What You Will Learn

- Writing basic test functions with the `testing` package
- Creating table-driven tests for comprehensive coverage
- Organizing tests with subtests using `t.Run`
- Using test fixtures and `TestMain` for setup/teardown
- Writing benchmarks to measure performance
- Creating fuzz tests for property-based testing
- Writing example tests that double as documentation
- Measuring test coverage
- Mocking dependencies with interfaces
- Using testify for enhanced assertions

---

## Prerequisites

- Understanding of Go functions and packages
- Familiarity with interfaces and structs
- Basic knowledge of command-line operations

---

## Writing Basic Tests

Go tests are regular functions with specific naming conventions.

=== "The Code"

    ```go
    // math.go
    package math

    func Add(a, b int) int {
        return a + b
    }

    func Multiply(a, b int) int {
        return a * b
    }

    func Divide(a, b float64) (float64, error) {
        if b == 0 {
            return 0, fmt.Errorf("division by zero")
        }
        return a / b, nil
    }
    ```

=== "The Code"

    ```go
    // math_test.go
    package math

    import "testing"

    func TestAdd(t *testing.T) {
        result := Add(2, 3)
        if result != 5 {
            t.Errorf("Add(2, 3) = %d; want 5", result)
        }
    }

    func TestMultiply(t *testing.T) {
        result := Multiply(4, 5)
        if result != 20 {
            t.Errorf("Multiply(4, 5) = %d; want 20", result)
        }
    }

    func TestDivide(t *testing.T) {
        result, err := Divide(10, 2)
        if err != nil {
            t.Errorf("Divide(10, 2) returned unexpected error: %v", err)
        }
        if result != 5 {
            t.Errorf("Divide(10, 2) = %f; want 5", result)
        }
    }

    func TestDivideByZero(t *testing.T) {
        _, err := Divide(10, 0)
        if err == nil {
            t.Error("Divide(10, 0) expected error, got nil")
        }
    }
    ```

=== "The Explanation"

    - **Test functions**: Must start with `Test` and take `*testing.T`
    - **t.Errorf**: Reports error but continues test execution
    - **t.Fatalf**: Reports error and stops test immediately
    - **File naming**: Test files end with `_test.go`
    - **Package**: Tests can be in the same package

=== "The Terminal Output"

    ```
    === RUN   TestAdd
    --- PASS: TestAdd (0.00s)
    === RUN   TestMultiply
    --- PASS: TestMultiply (0.00s)
    === RUN   TestDivide
    --- PASS: TestDivide (0.00s)
    === RUN   TestDivideByZero
    --- PASS: TestDivideByZero (0.00s)
    PASS
    ok  	example.com/math	0.001s
    ```

!!! go "Tip"
Run tests with `go test ./...` to test all packages, or `go test -v` for verbose output showing each test.

---

## Table-Driven Tests

Table-driven tests are the Go standard for comprehensive test coverage.

=== "The Code"

    ```go
    package math

    import "testing"

    func TestAddTableDriven(t *testing.T) {
        tests := []struct {
            name     string
            a, b     int
            expected int
        }{
            {"positive numbers", 2, 3, 5},
            {"negative numbers", -1, -2, -3},
            {"mixed signs", -1, 5, 4},
            {"zero values", 0, 0, 0},
            {"large numbers", 1000000, 2000000, 3000000},
        }

        for _, tt := range tests {
            t.Run(tt.name, func(t *testing.T) {
                result := Add(tt.a, tt.b)
                if result != tt.expected {
                    t.Errorf("Add(%d, %d) = %d; want %d",
                        tt.a, tt.b, result, tt.expected)
                }
            })
        }
    }
    ```

=== "The Explanation"

    - **Anonymous struct**: Defines test case structure inline
    - **Test names**: Descriptive names for each case
    - **t.Run**: Creates a subtest for each case
    - **Loop execution**: Each test case runs independently
    - **Easy to extend**: Add new cases by appending to slice

=== "The Terminal Output"

    ```
    === RUN   TestAddTableDriven
    === RUN   TestAddTableDriven/positive_numbers
    === RUN   TestAddTableDriven/negative_numbers
    === RUN   TestAddTableDriven/mixed_signs
    === RUN   TestAddTableDriven/zero_values
    === RUN   TestAddTableDriven/large_numbers
    --- PASS: TestAddTableDriven (0.00s)
    PASS
    ```

!!! note "Benefits of Table-Driven Tests"
- Consistent test structure across the codebase
- Easy to add new test cases
- Clear failure messages with test case names
- Reduces code duplication

---

## Subtests

Use subtests to organize related test cases and run specific subsets.

=== "The Code"

    ```go
    package validator

    import "testing"

    func ValidateEmail(email string) bool {
        return len(email) > 0 && len(email) < 255
    }

    func TestValidateEmail(t *testing.T) {
        t.Run("valid emails", func(t *testing.T) {
            validEmails := []string{
                "user@example.com",
                "test.email@domain.org",
                "name+tag@company.co",
            }

            for _, email := range validEmails {
                if !ValidateEmail(email) {
                    t.Errorf("ValidateEmail(%q) = false; want true", email)
                }
            }
        })

        t.Run("invalid emails", func(t *testing.T) {
            invalidEmails := []string{
                "",
                "no-at-sign",
                "@no-local-part.com",
            }

            for _, email := range invalidEmails {
                if ValidateEmail(email) {
                    t.Errorf("ValidateEmail(%q) = true; want false", email)
                }
            }
        })
    }
    ```

=== "The Explanation"

    - **Nested subtests**: Group related test cases together
    - **Selective running**: Run specific subtests with `-run` flag
    - **Independent execution**: Each subtest can fail independently
    - **Better organization**: Logical grouping of test cases

=== "The Terminal Output"

    ```
    === RUN   TestValidateEmail
    === RUN   TestValidateEmail/valid_emails
    === RUN   TestValidateEmail/invalid_emails
    --- PASS: TestValidateEmail (0.00s)
    PASS
    ```

### Running Specific Subtests

```bash
# Run only valid email tests
go test -run TestValidateEmail/valid_emails

# Run all email tests
go test -run TestValidateEmail
```

---

## Test Fixtures and TestMain

Use `TestMain` for setup and teardown that runs once per test package.

=== "The Code"

    ```go
    package database

    import (
        "fmt"
        "os"
        "testing"
    )

    var testDB *Database

    func TestMain(m *testing.M) {
        // Setup: Create test database
        var err error
        testDB, err = CreateTestDatabase()
        if err != nil {
            fmt.Printf("Failed to create test database: %v\n", err)
            os.Exit(1)
        }

        // Run tests
        code := m.Run()

        // Teardown: Clean up
        testDB.Close()
        os.Remove("test.db")

        os.Exit(code)
    }

    func TestInsert(t *testing.T) {
        err := testDB.Insert("key", "value")
        if err != nil {
            t.Errorf("Insert failed: %v", err)
        }

        result, err := testDB.Get("key")
        if err != nil {
            t.Errorf("Get failed: %v", err)
        }

        if result != "value" {
            t.Errorf("Get() = %q; want %q", result, "value")
        }
    }
    ```

=== "The Explanation"

    - **TestMain**: Entry point for test package setup/teardown
    - **m.Run**: Executes all tests in the package
    - **os.Exit**: Must be called with the test result code
    - **Shared resources**: Create once, use in all tests
    - **Cleanup**: Ensure resources are released after tests

=== "The Terminal Output"

    ```
    === RUN   TestInsert
    --- PASS: TestInsert (0.01s)
    PASS
    ok  	example.com/database	0.015s
    ```

!!! danger "TestMain Gotcha"
If you forget `os.Exit(m.Run())`, tests won't run. Always ensure `TestMain` calls `os.Exit` with the return value of `m.Run`.

---

## Benchmarks

Measure performance with benchmark functions.

=== "The Code"

    ```go
    package benchmark

    import "testing"

    func Concatenation(n int) string {
        s := ""
        for i := 0; i < n; i++ {
            s += "a"
        }
        return s
    }

    func Builder(n int) string {
        var builder strings.Builder
        for i := 0; i < n; i++ {
            builder.WriteString("a")
        }
        return builder.String()
    }

    func BenchmarkConcatenation(b *testing.B) {
        for i := 0; i < b.N; i++ {
            Concatenation(1000)
        }
    }

    func BenchmarkBuilder(b *testing.B) {
        for i := 0; i < b.N; i++ {
            Builder(1000)
        }
    }

    func BenchmarkConcatenationParallel(b *testing.B) {
        b.RunParallel(func(pb *testing.PB) {
            for pb.Next() {
                Concatenation(1000)
            }
        })
    }
    ```

=== "The Explanation"

    - **Benchmark functions**: Start with `Benchmark` and take `*testing.B`
    - **b.N**: Number of iterations (determined by testing framework)
    - **b.RunParallel**: For testing concurrent code
    - **Run benchmarks**: Use `go test -bench=.`

=== "The Terminal Output"

    ```
    BenchmarkConcatenation-8      	    5000	    234567 ns/op
    BenchmarkBuilder-8          	  100000	     12345 ns/op
    BenchmarkConcatenationParallel-8    20000	     56789 ns/op
    PASS
    ok  	example.com/benchmark	3.456s
    ```

!!! go "Performance Tip"
Use `-benchmem` flag to see memory allocation statistics: `go test -bench=. -benchmem`

---

## Fuzz Tests

Go 1.18+ supports fuzz testing for finding edge cases automatically.

=== "The Code"

    ```go
    package fuzz

    import "testing"

    func Reverse(s string) string {
        runes := []rune(s)
        for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
            runes[i], runes[j] = runes[j], runes[i]
        }
        return string(runes)
    }

    func FuzzReverse(f *testing.F) {
        // Seed corpus
        f.Add("hello")
        f.Add("world")
        f.Add("")
        f.Add("racecar")

        // Fuzz function
        f.Fuzz(func(t *testing.T, original string) {
            reversed := Reverse(original)
            doubleReversed := Reverse(reversed)

            // Property: reversing twice gives original
            if original != doubleReversed {
                t.Errorf("Double reverse mismatch: original=%q, doubleReversed=%q",
                    original, doubleReversed)
            }

            // Property: length is preserved
            if len(original) != len(reversed) {
                t.Errorf("Length mismatch: original=%d, reversed=%d",
                    len(original), len(reversed))
            }
        })
    }
    ```

=== "The Explanation"

    - **Fuzz functions**: Start with `Fuzz` and take `*testing.F`
    - **f.Add**: Seeds the corpus with known inputs
    - **f.Fuzz**: The actual fuzz function to test
    - **Properties**: Define invariants that should always hold
    - **Run fuzz tests**: Use `go test -fuzz=FuzzReverse`

=== "The Terminal Output"

    ```
    === FUZZ  FuzzReverse
    Fuzzing: FuzzReverse corpus/
    --- PASS: FuzzReverse (0.00s)
    PASS
    ```

!!! abstract "When to Use Fuzz Testing"
- Parser implementations
- Data format decoders
- Cryptographic functions
- Any function handling untrusted input

---

## Example Tests

Write tests that serve as documentation and run in test mode.

=== "The Code"

    ```go
    package stringutil

    import "fmt"

    func Reverse(s string) string {
        runes := []rune(s)
        for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
            runes[i], runes[j] = runes[j], runes[i]
        }
        return string(runes)
    }

    func ExampleReverse() {
        fmt.Println(Reverse("hello"))
        fmt.Println(Reverse("Hello, World!"))

        // Output:
        // olleh
        // !dlroW ,olleH
    }

    func ExampleReverse_withEmptyString() {
        fmt.Println(Reverse(""))

        // Output:
        //
    }

    func ExampleReverse_withUnicode() {
        fmt.Println(Reverse("café"))

        // Output:
        // éfac
    }
    ```

=== "The Explanation"

    - **Example functions**: Start with `Example`
    - **Output comments**: `// Output:` defines expected output
    - **Documentation**: Appears in godoc output
    - **Run examples**: Execute with `go test`

=== "The Terminal Output"

    ```
    === RUN   ExampleReverse
    --- PASS: ExampleReverse (0.00s)
    === RUN   ExampleReverse_withEmptyString
    --- PASS: ExampleReverse_withEmptyString (0.00s)
    === RUN   ExampleReverse_withUnicode
    --- PASS: ExampleReverse_withUnicode (0.00s)
    PASS
    ```

!!! go "Documentation Tip"
Example tests automatically appear in godoc. They serve as both tests and documentation for your API.

---

## Test Coverage

Measure how much of your code is covered by tests.

### Generating Coverage Reports

```bash
# Run tests with coverage
go test -cover ./...

# Generate coverage profile
go test -coverprofile=coverage.out ./...

# View coverage in terminal
go tool cover -func=coverage.out

# Generate HTML report
go tool cover -html=coverage.out -o coverage.html
```

=== "The Code"

    ```go
    package coverage

    func CalculateGrade(score int) string {
        switch {
        case score >= 90:
            return "A"
        case score >= 80:
            return "B"
        case score >= 70:
            return "C"
        case score >= 60:
            return "D"
        default:
            return "F"
        }
    }

    func IsPassing(score int) bool {
        return score >= 60
    }
    ```

=== "The Code"

    ```go
    // coverage_test.go
    package coverage

    import "testing"

    func TestCalculateGrade(t *testing.T) {
        tests := []struct {
            score    int
            expected string
        }{
            {95, "A"},
            {85, "B"},
            {75, "C"},
            {65, "D"},
            {50, "F"},
        }

        for _, tt := range tests {
            result := CalculateGrade(tt.score)
            if result != tt.expected {
                t.Errorf("CalculateGrade(%d) = %s; want %s",
                    tt.score, result, tt.expected)
            }
        }
    }

    func TestIsPassing(t *testing.T) {
        if !IsPassing(70) {
            t.Error("IsPassing(70) = false; want true")
        }
        if IsPassing(50) {
            t.Error("IsPassing(50) = true; want false")
        }
    }
    ```

=== "The Terminal Output"

    ```
    ok  	example.com/coverage	0.001s	coverage: 100.0% of statements
    ```

### Coverage Output

```
=== RUN   TestCalculateGrade
--- PASS: TestCalculateGrade (0.00s)
=== RUN   TestIsPassing
--- PASS: TestIsPassing (0.00s)
PASS
coverage: 100.0% of statements
ok  	example.com/coverage	0.001s
```

---

## Mocking with Interfaces

Use interfaces to create testable code with mock dependencies.

=== "The Code"

    ```go
    // user.go
    package user

    type Repository interface {
        GetByID(id int) (*User, error)
        Save(user *User) error
    }

    type User struct {
        ID    int
        Name  string
        Email string
    }

    type Service struct {
        repo Repository
    }

    func NewService(repo Repository) *Service {
        return &Service{repo: repo}
    }

    func (s *Service) GetUser(id int) (*User, error) {
        return s.repo.GetByID(id)
    }
    ```

=== "The Code"

    ```go
    // user_test.go
    package user

    import (
        "errors"
        "testing"
    )

    type MockRepository struct {
        users map[int]*User
        err   error
    }

    func NewMockRepository() *MockRepository {
        return &MockRepository{
            users: make(map[int]*User),
        }
    }

    func (m *MockRepository) GetByID(id int) (*User, error) {
        if m.err != nil {
            return nil, m.err
        }
        user, ok := m.users[id]
        if !ok {
            return nil, errors.New("user not found")
        }
        return user, nil
    }

    func (m *MockRepository) Save(user *User) error {
        if m.err != nil {
            return m.err
        }
        m.users[user.ID] = user
        return nil
    }

    func TestGetUser(t *testing.T) {
        mock := NewMockRepository()
        mock.users[1] = &User{ID: 1, Name: "Alice", Email: "alice@example.com"}

        service := NewService(mock)

        user, err := service.GetUser(1)
        if err != nil {
            t.Errorf("GetUser(1) returned unexpected error: %v", err)
        }

        if user.Name != "Alice" {
            t.Errorf("GetUser(1).Name = %q; want %q", user.Name, "Alice")
        }
    }

    func TestGetUserNotFound(t *testing.T) {
        mock := NewMockRepository()
        mock.err = errors.New("database connection failed")

        service := NewService(mock)

        _, err := service.GetUser(1)
        if err == nil {
            t.Error("GetUser(1) expected error, got nil")
        }
    }
    ```

=== "The Explanation"

    - **Interface**: Defines the contract for dependencies
    - **Mock implementation**: Provides controlled behavior for tests
    - **Dependency injection**: Pass mock through constructor
    - **Test isolation**: Tests don't depend on external systems
    - **Behavior control**: Mock can simulate various scenarios

=== "The Terminal Output"

    ```
    === RUN   TestGetUser
    --- PASS: TestGetUser (0.00s)
    === RUN   TestGetUserNotFound
    --- PASS: TestGetUserNotFound (0.00s)
    PASS
    ```

!!! go "Mocking Best Practice"
Keep mocks simple and focused. Create separate mock implementations for different test scenarios rather than one complex mock.

---

## Using Testify (Optional)

Testify provides enhanced assertions and test organization.

=== "The Code"

    ```go
    package testify_example

    import (
        "testing"
        "github.com/stretchr/testify/assert"
        "github.com/stretchr/testify/require"
    )

    func TestWithTestify(t *testing.T) {
        result := Add(2, 3)

        // Assertions - continue on failure
        assert.Equal(t, 5, result, "Add(2, 3) should equal 5")
        assert.NotZero(t, result, "Result should not be zero")
        assert.True(t, result > 0, "Result should be positive")

        // Required - stop on failure
        require.NotEmpty(t, result, "Result should not be empty")
    }

    func TestSliceOperations(t *testing.T) {
        items := []string{"a", "b", "c"}

        assert.Len(t, items, 3, "Slice should have 3 elements")
        assert.Contains(t, items, "b", "Slice should contain 'b'")
        assert.NotEmpty(t, items, "Slice should not be empty")
    }

    func TestWithSubtests(t *testing.T) {
        tests := []struct {
            name     string
            input    int
            expected int
        }{
            {"positive", 5, 10},
            {"negative", -5, -10},
            {"zero", 0, 0},
        }

        for _, tt := range tests {
            t.Run(tt.name, func(t *testing.T) {
                result := Double(tt.input)
                assert.Equal(t, tt.expected, result)
            })
        }
    }
    ```

=== "The Explanation"

    - **assert vs require**: `assert` continues, `require` stops on failure
    - **Rich assertions**: Many assertion methods available
    - **Clear messages**: Custom failure messages for debugging
    - **Optional dependency**: Add with `go get github.com/stretchr/testify`

=== "The Terminal Output"

    ```
    === RUN   TestWithTestify
    --- PASS: TestWithTestify (0.00s)
    === RUN   TestSliceOperations
    --- PASS: TestSliceOperations (0.00s)
    === RUN   TestSliceOperations
    === RUN   TestSliceOperations/positive
    === RUN   TestSliceOperations/negative
    === RUN   TestSliceOperations/zero
    --- PASS: TestSliceOperations (0.00s)
    PASS
    ```

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Table-driven tests | Use for comprehensive test coverage |
| Descriptive names | Name tests clearly for easy debugging |
| Independent tests | Tests should not depend on execution order |
| Test edge cases | Include zero values, nil, empty inputs |
| Use subtests | Group related test cases together |
| Mock external dependencies | Use interfaces for testability |
| Run tests in CI | Automate testing in continuous integration |
| Maintain coverage | Aim for >80% code coverage |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Test not running | Ensure function starts with `Test` and takes `*testing.T` |
| Race condition | Use `-race` flag to detect data races |
| Flaky tests | Avoid time-dependent tests; use deterministic inputs |
| Slow tests | Use `testing.Short()` to skip long tests in development |
| Coverage gaps | Run `go tool cover -html` to find untested code |

## Summary

- Go tests are regular functions with `Test` prefix
- Table-driven tests are the standard pattern
- Subtests organize related test cases
- Benchmarks measure performance
- Fuzz tests find edge cases automatically
- Example tests serve as documentation
- Interfaces enable effective mocking
- Use `-cover` to measure test coverage

## Next Steps

- [CLI Applications](cli-applications.md) - Test CLI tools effectively
- [HTTP Clients](http-clients.md) - Test HTTP interactions with httptest
- [JSON & Encoding](json-encoding.md) - Test marshaling/unmarshaling
- [Advanced Testing](../advanced/code-generation.md) - Explore advanced patterns