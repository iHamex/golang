# Basic Syntax & Types

Go is a statically typed language with a clean, minimal syntax. This chapter covers the fundamental types, declarations, and data structures you need to write effective Go code.

## What You Will Learn

- Declare variables and constants with proper Go syntax
- Use basic types: `int`, `string`, `bool`, `float64`
- Work with arrays, slices, and maps
- Convert between types safely
- Understand zero values and short declarations

## Prerequisites

- [Your First Program](first-program.md) — Basic Go program structure
- [Setup & Installation](setup-installation.md) — Go 1.22+ installed

---

## Variables

Go provides multiple ways to declare variables. Each has its place in idiomatic code.

=== "The Code"

    ```go
    package main

    import "fmt"

    func main() {
        // Explicit type declaration
        var name string = "Alice"

        // Type inferred from value
        var age = 30

        // Multiple declarations
        var (
            width  int     = 100
            height int     = 200
            area   float64 // zero value: 0
        )

        // Short declaration (most common in functions)
        city := "Berlin"
        active := true
        score := 98.5

        // Grouped short declarations
        x, y, z := 1, 2, 3

        fmt.Printf("name: %s, age: %d\n", name, age)
        fmt.Printf("dimensions: %dx%d = %.0f\n", width, height, area)
        fmt.Printf("city: %s, active: %t\n", city, active)
        fmt.Printf("score: %.1f\n", score)
        fmt.Printf("coordinates: %d, %d, %d\n", x, y, z)
    }
    ```

=== "The Explanation"

    - **`var name string = "Alice"`**: Explicit declaration with type and value. Used when you need to specify the type or when the zero value is meaningful.
    - **`var age = 30`**: Type inferred. Go determines `age` is `int` from the literal `30`.
    - **`city := "Berlin"`**: Short declaration. Only usable inside functions. Most common form.
    - **`var area float64`**: Declared without a value — gets the zero value (`0` for numbers, `""` for strings, `false` for bools).
    - **`x, y, z := 1, 2, 3`**: Multiple short declarations in one line.

=== "The Terminal Output"

    ```bash
    $ go run variables.go
    name: Alice, age: 30
    dimensions: 100x200 = 0
    city: Berlin, active: true
    score: 98.5
    coordinates: 1, 2, 3
    ```

!!! go "Short Declaration Rule"

    `:=` can only be used inside functions. At package level, you must use `var`. The short declaration requires at least one new variable on the left side.

---

## Constants

Constants are compile-time values that cannot be changed after declaration.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "math"
    )

    func main() {
        // Simple constant
        const Pi = 3.141592653589793

        // Typed constant
        const MaxRetries int = 3

        // Multiple constants
        const (
            StatusOK       = 200
            StatusNotFound = 404
            StatusError    = 500
        )

        // Typed constants with iota (enumeration)
        const (
            Sunday    iota // 0
            Monday         // 1
            Tuesday        // 2
            Wednesday      // 3
            Thursday       // 4
            Friday         // 5
            Saturday       // 6
        )

        // Bitmask constants
        const (
            ReadPermission   = 1 << iota // 1 (001)
            WritePermission               // 2 (010)
            ExecutePermission             // 4 (100)
        )

        // Mathematical constants
        fmt.Printf("Pi: %.10f\n", Pi)
        fmt.Printf("MaxRetries: %d\n", MaxRetries)
        fmt.Printf("Status codes: %d, %d, %d\n", StatusOK, StatusNotFound, StatusError)

        // Day names
        fmt.Printf("Days: %d, %d, %d, %d, %d, %d, %d\n",
            Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday)

        // Permissions
        fmt.Printf("Read: %d, Write: %d, Execute: %d\n",
            ReadPermission, WritePermission, ExecutePermission)

        // Combine permissions
        allPermissions := ReadPermission | WritePermission | ExecutePermission
        fmt.Printf("All permissions: %d\n", allPermissions)

        // Mathematical constant from math package
        fmt.Printf("Sqrt(2): %.10f\n", math.Sqrt2)
    }
    ```

=== "The Explanation"

    - **`const Pi = 3.14...`**: Untyped constant. Can be used with any numeric type.
    - **`const MaxRetries int = 3`**: Typed constant. Always has type `int`.
    - **`iota`**: Auto-increments for each constant in a group. Resets to 0 for each new `const` block.
    - **`1 << iota`**: Bit shifting with iota creates bitmask constants: 1, 2, 4, 8, ...
    - Constants are resolved at compile time — no runtime overhead.

=== "The Terminal Output"

    ```bash
    $ go run constants.go
    Pi: 3.1415926536
    MaxRetries: 3
    Status codes: 200, 404, 500
    Days: 0, 1, 2, 3, 4, 5, 6
    Read: 1, Write: 2, Execute: 4
    All permissions: 7
    Sqrt(2): 1.4142135624
    ```

---

## Basic Types

Go has a small set of basic types that map closely to hardware:

```go
package main

import (
    "fmt"
    "math"
)

func main() {
    // Integer types
    var a int8 = 127           // -128 to 127
    var b uint8 = 255          // 0 to 255
    var c int16 = 32767        // -32768 to 32767
    var d uint16 = 65535       // 0 to 65535
    var e int32 = 2147483647   // -2^31 to 2^31-1
    var f uint32 = 4294967295  // 0 to 2^32-1
    var g int64 = 9223372036854775807  // -2^63 to 2^63-1
    var h uint64 = 18446744073709551615

    // Platform-specific (recommended for most cases)
    var i int = -42
    var j uint = 42

    // Float types
    var f1 float32 = 3.14
    var f2 float64 = 3.141592653589793

    // String type
    var s string = "Hello, Go!"

    // Boolean type
    var b1 bool = true
    var b2 bool // zero value: false

    // Byte (alias for uint8)
    var byteVal byte = 'A'

    // Rune (alias for int32, represents a Unicode code point)
    var runeVal rune = '€'

    fmt.Printf("int8:    %d (size: %d bytes)\n", a, 1)
    fmt.Printf("uint8:   %d (size: %d bytes)\n", b, 1)
    fmt.Printf("int16:   %d (size: %d bytes)\n", c, 2)
    fmt.Printf("uint16:  %d (size: %d bytes)\n", d, 2)
    fmt.Printf("int32:   %d (size: %d bytes)\n", e, 4)
    fmt.Printf("uint32:  %d (size: %d bytes)\n", f, 4)
    fmt.Printf("int64:   %d (size: %d bytes)\n", g, 8)
    fmt.Printf("uint64:  %d (size: %d bytes)\n", h, 8)
    fmt.Printf("int:     %d\n", i)
    fmt.Printf("uint:    %d\n", j)
    fmt.Printf("float32: %f\n", f1)
    fmt.Printf("float64: %.15f\n", f2)
    fmt.Printf("string:  %s (length: %d)\n", s, len(s))
    fmt.Printf("bool:    %t, %t\n", b1, b2)
    fmt.Printf("byte:    %c (decimal: %d)\n", byteVal, byteVal)
    fmt.Printf("rune:    %c (decimal: %d)\n", runeVal, runeVal)

    // Limits
    fmt.Printf("\nType limits:\n")
    fmt.Printf("int8 min/max:   %d / %d\n", math.MinInt8, math.MaxInt8)
    fmt.Printf("int16 min/max:  %d / %d\n", math.MinInt16, math.MaxInt16)
    fmt.Printf("int32 min/max:  %d / %d\n", math.MinInt32, math.MaxInt32)
    fmt.Printf("int64 min/max:  %d / %d\n", math.MinInt64, math.MaxInt64)
}
```

| Type | Size | Range | Default |
|------|------|-------|---------|
| `int8` | 1 byte | -128 to 127 | `0` |
| `uint8` (byte) | 1 byte | 0 to 255 | `0` |
| `int16` | 2 bytes | -32,768 to 32,767 | `0` |
| `uint16` | 2 bytes | 0 to 65,535 | `0` |
| `int32` (rune) | 4 bytes | -2^31 to 2^31-1 | `0` |
| `uint32` | 4 bytes | 0 to 2^32-1 | `0` |
| `int64` | 8 bytes | -2^63 to 2^63-1 | `0` |
| `uint64` | 8 bytes | 0 to 2^64-1 | `0` |
| `int` | 4 or 8 bytes | Platform-dependent | `0` |
| `uint` | 4 or 8 bytes | Platform-dependent | `0` |
| `float32` | 4 bytes | ±3.4e38 | `0` |
| `float64` | 8 bytes | ±1.7e308 | `0` |
| `string` | — | UTF-8 encoded | `""` |
| `bool` | 1 byte | `true` or `false` | `false` |

!!! go "Use int Unless You Need Specific Size"

    Use `int` for most integer operations. Only use sized types (`int64`, `uint32`, etc.) when you need specific memory layout or API compatibility.

---

## Strings

Strings in Go are immutable sequences of bytes (UTF-8 encoded).

```go
package main

import (
    "fmt"
    "strings"
    "unicode/utf8"
)

func main() {
    s := "Hello, 世界!"

    // String operations
    fmt.Printf("Length (bytes): %d\n", len(s))
    fmt.Printf("Length (runes): %d\n", utf8.RuneCountInString(s))

    // Indexing returns bytes
    fmt.Printf("First byte: %d\n", s[0])

    // Range iterates over runes
    for i, r := range s {
        fmt.Printf("Index %d: %c (U+%04X)\n", i, r, r)
    }

    // String manipulation
    fmt.Println(strings.ToUpper("hello"))
    fmt.Println(strings.ToLower("HELLO"))
    fmt.Println(strings.Contains("Hello, World", "World"))
    fmt.Println(strings.HasPrefix("Hello", "He"))
    fmt.Println(strings.HasSuffix("Hello", "llo"))
    fmt.Println(strings.Replace("Hello World", "World", "Go", 1))
    fmt.Println(strings.Split("a,b,c", ","))
    fmt.Println(strings.Join([]string{"a", "b", "c"}, " - "))

    // String building
    var builder strings.Builder
    for i := 0; i < 5; i++ {
        builder.WriteString(fmt.Sprintf("Item %d ", i))
    }
    fmt.Println(builder.String())

    // Raw strings (no escape processing)
    path := `C:\Users\name\Documents`
    fmt.Println(path)
}
```

---

## Zero Values

Every type in Go has a zero value — the value assigned when a variable is declared without initialization.

```go
package main

import "fmt"

func main() {
    var i int
    var f float64
    var b bool
    var s string
    var p *int
    var sl []int
    var m map[string]int
    var ch chan int

    fmt.Printf("int:      %d\n", i)
    fmt.Printf("float64:  %f\n", f)
    fmt.Printf("bool:     %t\n", b)
    fmt.Printf("string:   %q\n", s)
    fmt.Printf("pointer:  %v\n", p)
    fmt.Printf("slice:    %v (len: %d)\n", sl, len(sl))
    fmt.Printf("map:      %v (len: %d)\n", m, len(m))
    fmt.Printf("channel:  %v\n", ch)
}
```

!!! go "Zero Values Are Useful"

    Go's zero values are not `undefined` or `null`. They are well-defined and often useful:
    - Numeric zero values initialize counters
    - Empty strings are valid initial states
    - `false` booleans are sensible defaults
    - `nil` pointers and slices are expected empty states

---

## Arrays

Arrays are fixed-size, value-type collections. In practice, you almost always use slices instead.

```go
package main

import "fmt"

func main() {
    // Array declaration
    var a [5]int
    fmt.Println("Empty array:", a) // [0 0 0 0 0]

    // Array with initialization
    b := [5]int{1, 2, 3, 4, 5}
    fmt.Println("Initialized:", b)

    // Let the compiler count elements
    c := [...]int{10, 20, 30}
    fmt.Println("Auto-count:", c) // [10 20 30]

    // Array with index specification
    d := [5]int{0: 10, 2: 30, 4: 50}
    fmt.Println("With index:", d) // [10 0 30 0 50]

    // Array length
    fmt.Printf("Length: %d\n", len(b))

    // Array iteration
    for i, v := range b {
        fmt.Printf("Index %d: %d\n", i, v)
    }

    // Arrays are value types (copied)
    original := [3]int{1, 2, 3}
    copied := original
    copied[0] = 99
    fmt.Println("Original:", original) // [1 2 3]
    fmt.Println("Copied:", copied)     // [99 2 3]

    // Fixed size is part of the type
    var arr3 [3]int
    var arr5 [5]int
    // arr3 = arr5  // Type mismatch: [3]int vs [5]int
}
```

---

## Slices

Slices are dynamic, reference-type collections built on top of arrays. They are the most commonly used collection type.

=== "The Code"

    ```go
    package main

    import "fmt"

    func main() {
        // Slice declaration
        var s1 []int
        fmt.Println("Nil slice:", s1, "len:", len(s1), "cap:", cap(s1))

        // Slice with make
        s2 := make([]int, 5)       // len=5, cap=5
        s3 := make([]int, 0, 10)   // len=0, cap=10

        // Slice literal
        s4 := []int{1, 2, 3, 4, 5}
        fmt.Println("Literal:", s4)

        // Append elements
        s1 = append(s1, 1, 2, 3)
        fmt.Println("After append:", s1)

        // Append slice to slice
        more := []int{4, 5, 6}
        s1 = append(s1, more...)
        fmt.Println("After append slice:", s1)

        // Slice from array
        arr := [5]int{10, 20, 30, 40, 50}
        sub := arr[1:4]  // [20 30 40]
        fmt.Println("Sub slice:", sub)

        // Full slice
        full := arr[:]
        fmt.Println("Full slice:", full)

        // Slice operations
        fmt.Printf("Length: %d\n", len(s4))
        fmt.Printf("Capacity: %d\n", cap(s4))

        // Copy
        src := []int{1, 2, 3}
        dst := make([]int, len(src))
        copy(dst, src)
        fmt.Println("Copy:", dst)

        // Delete element (not built-in)
        delete := []int{1, 2, 3, 4, 5}
        i := 2 // remove index 2
        delete = append(delete[:i], delete[i+1:]...)
        fmt.Println("After delete:", delete)

        // Slice of slices
        matrix := [][]int{
            {1, 2, 3},
            {4, 5, 6},
            {7, 8, 9},
        }
        fmt.Println("Matrix:", matrix)
    }
    ```

=== "The Explanation"

    - **`var s1 []int`**: Nil slice. Has length 0 and capacity 0. Safe to `append` to.
    - **`make([]int, 5)`**: Creates a slice with length 5, all elements initialized to zero.
    - **`make([]int, 0, 10)`**: Creates a slice with length 0 and capacity 10. Pre-allocates memory for efficiency.
    - **`append(s1, 4, 5, 6...)`**: Appends elements. The `...` unpacks a slice into individual arguments.
    - **`arr[1:4]`**: Sub-slice from index 1 to 3 (4 is exclusive).
    - **`copy(dst, src)`**: Copies elements from src to dst. Returns number of elements copied.
    - **Append-delete pattern**: Go has no built-in delete for slices; use append to splice around the element.

=== "The Terminal Output"

    ```bash
    $ go run slices.go
    Nil slice: [] len: 0 cap: 0
    Literal: [1 2 3 4 5]
    After append: [1 2 3]
    After append slice: [1 2 3 4 5 6]
    Sub slice: [20 30 40]
    Full slice: [10 20 30 40 50]
    Length: 5
    Capacity: 5
    Copy: [1 2 3]
    After delete: [1 2 4 5]
    Matrix: [[1 2 3] [4 5 6] [7 8 9]]
    ```

!!! warning "Slice Capacity and Reallocation"

    Slices are backed by an array. When you append beyond the capacity, Go allocates a new, larger array. This is amortized O(1) but can cause unexpected memory usage. Use `make([]T, 0, capacity)` when you know the approximate size.

---

## Maps

Maps are key-value pairs. They are reference types and must be initialized before use.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sort"
    )

    func main() {
        // Map declaration
        var m1 map[string]int
        fmt.Println("Nil map:", m1) // map[]

        // Map initialization
        m2 := make(map[string]int)
        m3 := map[string]int{
            "alice": 95,
            "bob":   87,
            "carol": 92,
        }

        // Add entries
        m2["dave"] = 88
        m2["eve"] = 91

        // Read entries
        fmt.Println("Alice's score:", m3["alice"])

        // Check if key exists (comma-ok idiom)
        score, ok := m3["frank"]
        fmt.Printf("Frank: %d, exists: %t\n", score, ok)

        // Delete entry
        delete(m3, "bob")
        fmt.Println("After delete:", m3)

        // Map length
        fmt.Println("Length:", len(m3))

        // Iterate over map (order is random)
        fmt.Println("\nAll scores:")
        for name, score := range m3 {
            fmt.Printf("  %s: %d\n", name, score)
        }

        // Sorted iteration
        fmt.Println("\nSorted scores:")
        keys := make([]string, 0, len(m3))
        for k := range m3 {
            keys = append(keys, k)
        }
        sort.Strings(keys)
        for _, k := range keys {
            fmt.Printf("  %s: %d\n", k, m3[k])
        }

        // Map of slices
        groups := make(map[string][]string)
        groups["backend"] = append(groups["backend"], "alice", "bob")
        groups["frontend"] = append(groups["frontend"], "carol", "dave")
        fmt.Println("\nGroups:", groups)

        // Check existence before access
        if score, ok := m3["alice"]; ok {
            fmt.Printf("\nAlice: %d\n", score)
        }
    }
    ```

=== "The Explanation"

    - **`var m1 map[string]int`**: Nil map. Reading from a nil map returns zero values; writing to a nil map **panics**.
    - **`make(map[string]int)`**: Creates an initialized, empty map ready for writes.
    - **`map[string]int{...}`**: Map literal with initial values.
    - **`m3["alice"]`**: Returns the value for key `"alice"`.
    - **`score, ok := m3["frank"]`**: Comma-ok idiom. `ok` is `true` if the key exists, `false` otherwise.
    - **`delete(m3, "bob")`**: Removes the entry for key `"bob"`.
    - Maps are **not safe for concurrent use**. Use `sync.Map` or a mutex for concurrent access.

=== "The Terminal Output"

    ```bash
    $ go run maps.go
    Nil map: map[]
    Alice's score: 95
    Frank: 0, exists: false
    After delete: map[alice:95 carol:92]
    Length: 2

    All scores:
      alice: 95
      carol: 92

    Sorted scores:
      alice: 95
      carol: 92

    Groups: map[backend:[alice bob] frontend:[carol dave]]

    Alice: 95
    ```

!!! danger "Nil Map Writes Panic"

    Writing to a nil map causes a runtime panic. Always initialize maps with `make()` or a literal before writing.

---

## Type Conversion

Go requires explicit type conversion. There is no implicit type coercion.

```go
package main

import (
    "fmt"
    "strconv"
    "strings"
)

func main() {
    // Numeric conversions
    var i int = 42
    var f float64 = float64(i)
    var u uint = uint(f)

    fmt.Printf("int: %d, float64: %.2f, uint: %d\n", i, f, u)

    // Warning: precision loss
    var bigFloat float64 = 3.99
    var truncated int = int(bigFloat)
    fmt.Printf("Truncated: %.2f -> %d\n", bigFloat, truncated)

    // String conversions
    num := 42
    str := strconv.Itoa(num)
    fmt.Printf("Number to string: %q\n", str)

    // String to number
    parsed, err := strconv.Atoi("123")
    if err != nil {
        fmt.Printf("Parse error: %v\n", err)
    } else {
        fmt.Printf("Parsed: %d\n", parsed)
    }

    // Float to string
    pi := 3.14159
    piStr := strconv.FormatFloat(pi, 'f', 2, 64)
    fmt.Printf("Pi as string: %s\n", piStr)

    // String to float
    f2, _ := strconv.ParseFloat("3.14", 64)
    fmt.Printf("Parsed float: %.2f\n", f2)

    // String to bool
    b, _ := strconv.ParseBool("true")
    fmt.Printf("Parsed bool: %t\n", b)

    // String operations
    s := "Hello, World"
    runes := []rune(s)
    fmt.Printf("String to rune slice: %v\n", runes)
    fmt.Printf("Rune slice to string: %s\n", string(runes))

    // Slice conversion
    intSlice := []int{1, 2, 3}
    floatSlice := make([]float64, len(intSlice))
    for i, v := range intSlice {
        floatSlice[i] = float64(v)
    }
    fmt.Printf("Int slice: %v\n", intSlice)
    fmt.Printf("Float slice: %v\n", floatSlice)

    // Interface conversion (type assertion)
    var iface interface{} = "hello"
    str2, ok := iface.(string)
    fmt.Printf("Type assertion: %s, ok: %t\n", str2, ok)

    // Type switch
    var val interface{} = 42
    switch v := val.(type) {
    case int:
        fmt.Printf("Type switch: int = %d\n", v)
    case string:
        fmt.Printf("Type switch: string = %s\n", v)
    default:
        fmt.Printf("Type switch: unknown = %v\n", v)
    }
}
```

---

## Short Declaration Best Practices

```go
package main

import "fmt"

func main() {
    // GOOD: Use short declaration inside functions
    name := "Go"
    version := 1.22

    // GOOD: Use var when you need the zero value or explicit type
    var count int
    var message string

    // GOOD: Use var for package-level variables (outside functions)
    // var globalConfig = loadConfig()

    // GOOD: Use := for error handling (very common pattern)
    result, err := doSomething()
    if err != nil {
        fmt.Printf("Error: %v\n", err)
    }
    fmt.Println(result)

    // BAD: Redundant type declaration
    // var name string = "Go"  // type is obvious from literal

    // BAD: Using := when you just want to assign
    // name := "Go"  // if name was already declared, this shadows it

    // Use named returns for clarity in function signatures
    fmt.Println("Short declarations keep code concise")
}

func doSomething() (string, error) {
    return "result", nil
}
```

---

## Best Practices

| Practice | Recommendation |
|----------|---------------|
| **Use `int`** | Default choice for integers; sized types only when needed |
| **Use `float64`** | Default choice for floating point; `float32` only for memory-critical code |
| **Predeclare var blocks** | Group related declarations with `var (...)` at package level |
| **Short declarations `:=`** | Use inside functions for concise, readable code |
| **Comma-ok idiom** | Always check map access with `, ok` pattern |
| **Slice capacity** | Pre-allocate with `make([]T, 0, cap)` when size is known |
| **Map initialization** | Always use `make()` or literal; never use nil map |
| **String building** | Use `strings.Builder` for concatenation in loops |
| **Type conversion** | Always explicit; no implicit coercion in Go |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `cannot use x (type T) as type U` | Use explicit conversion: `U(x)` |
| `assignment count mismatch` | Ensure number of values matches number of variables |
| `panic: assignment to entry in nil map` | Initialize map with `make()` before writing |
| `index out of range` | Check slice length with `len()` before indexing |
| `cannot slice x (type string)` | Convert string to `[]rune` or `[]byte` first |
| `undefined: iota` | `iota` only works inside `const` blocks |
| `cannot convert x to int` | Use `strconv.Atoi()` for string-to-int conversion |
| `strings.Builder not resettable` | Create a new `strings.Builder` for each build |

## Summary

- Go is statically typed with explicit conversion
- `int` and `float64` are the default numeric types
- Slices are the primary collection; arrays are rarely used directly
- Maps must be initialized before writing; use comma-ok for safe reads
- `iota` generates sequential constants automatically
- Zero values are well-defined and often useful
- Short declaration `:=` is the most common variable declaration form

## Next Steps

- [IDE Setup & Tooling](ide-setup.md) — Configure your editor for Go syntax highlighting and linting
- [Go Modules & Dependencies](go-modules.md) — Manage external packages
- [Project Structure](project-structure.md) — Organize your Go code
