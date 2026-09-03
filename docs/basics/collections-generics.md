# Collections & Generics

Go provides powerful built-in collection types: slices for ordered sequences and maps for key-value pairs. Since Go 1.18, the language also supports generics, enabling type-safe reusable code without sacrificing performance.

## What You Will Learn

- Creating and manipulating slices with make, append, copy, len, and cap
- Working with maps for key-value storage and retrieval
- Understanding slice internals: pointer, length, and capacity
- Implementing common slice patterns and algorithms
- Using generics (Go 1.18+) for type-safe reusable code
- Defining type constraints with comparable, any, and custom interfaces
- Building generic functions and types

## Prerequisites

- Understanding of Go arrays and basic data types
- Familiarity with Go functions and loops
- Go 1.18+ for generics features

---

## Slices: Make, Append, Copy, Len, Cap

Slices are dynamically-sized, flexible views into underlying arrays.

=== "The Code"

    ```go
    package main

    import "fmt"

    func main() {
        // Slice literals
        fruits := []string{"apple", "banana", "cherry"}
        numbers := []int{1, 2, 3, 4, 5}
        fmt.Println("Numbers:", numbers)

        // make: create slice with length and capacity
        zeros := make([]int, 5)          // [0 0 0 0 0]
        buffer := make([]byte, 0, 1024)  // empty, capacity 1024
        fmt.Println("Zeros:", zeros)
        fmt.Println("Buffer len:", len(buffer), "cap:", cap(buffer))

        // len and cap
        fmt.Println("Fruits:", fruits)
        fmt.Println("Length:", len(fruits), "Capacity:", cap(fruits))

        // append: add elements (may reallocate)
        fruits = append(fruits, "date")
        fruits = append(fruits, "elderberry", "fig")
        fmt.Println("After append:", fruits)
        fmt.Println("Length:", len(fruits), "Capacity:", cap(fruits))

        // Append slice to slice
        more := []string{"grape", "honeydew"}
        fruits = append(fruits, more...)
        fmt.Println("After extend:", fruits)

        // copy: copy elements between slices
        src := []int{1, 2, 3, 4, 5}
        dst := make([]int, len(src))
        n := copy(dst, src)
        fmt.Printf("Copied %d elements: %v\n", n, dst)

        // Partial copy
        partial := make([]int, 3)
        copy(partial, src[1:4])
        fmt.Println("Partial copy:", partial)

        // Initialize with values
        evens := make([]int, 5)
        for i := range evens {
            evens[i] = i * 2
        }
        fmt.Println("Evens:", evens)
    }
    ```

=== "The Explanation"

    - **Slice literal**: `[]Type{values...}` creates and initializes a slice
    - **`make([]T, len, cap)`**: Allocates underlying array with specified length and capacity
    - **`len()`**: Returns the number of elements in the slice
    - **`cap()`**: Returns the capacity of the underlying array
    - **`append()`**: Adds elements; may reallocate if capacity is exceeded
    - **`copy()`**: Copies elements; returns number of elements copied

=== "The Terminal Output"

    ```
    Fruits: [apple banana cherry]
    Length: 3 Capacity: 3
    After append: [apple banana cherry date elderberry fig]
    Length: 6 Capacity: 6
    After extend: [apple banana cherry date elderberry fig grape honeydew]
    Copied 5 elements: [1 2 3 4 5]
    Partial copy: [2 3 4]
    Evens: [0 2 4 6 8]
    ```

---

## Maps: Make, Delete, Len

Maps provide key-value storage with fast lookup, insertion, and deletion.

=== "The Code"

    ```go
    package main

    import "fmt"

    func main() {
        // Map literal
        ages := map[string]int{
            "Alice":   30,
            "Bob":     25,
            "Charlie": 35,
        }

        // make: create empty map
        scores := make(map[string]int)

        // Add and update entries
        scores["math"] = 95
        scores["science"] = 88
        scores["english"] = 92

        // Access values
        fmt.Println("Alice's age:", ages["Alice"])
        fmt.Println("Math score:", scores["math"])

        // Check if key exists (comma-ok idiom)
        age, ok := ages["David"]
        if ok {
            fmt.Println("David's age:", age)
        } else {
            fmt.Println("David not found")
        }

        // Delete entries
        delete(scores, "english")
        fmt.Println("After delete:", scores)

        // Iterate over map
        fmt.Println("\nAll ages:")
        for name, age := range ages {
            fmt.Printf("  %s: %d\n", name, age)
        }

        // Length
        fmt.Println("\nNumber of people:", len(ages))

        // Map with different value types
        config := map[string]interface{}{
            "host":    "localhost",
            "port":    8080,
            "timeout": 30.5,
            "enabled": true,
        }
        fmt.Println("Config:", config)
    }
    ```

=== "The Explanation"

    - **Map literal**: `map[KeyType]ValueType{key: value}` initializes with values
    - **`make(map[K,V])`**: Creates an empty map ready for use
- **Key types**: Must be comparable (strings, ints, floats, bools, pointers, channels, arrays, structs)
    - **Comma-ok**: Always check if key exists before using value
    - **`delete()`**: Removes a key-value pair from the map
    - **Iteration order**: Maps have no guaranteed order; sort keys for deterministic output

=== "The Terminal Output"

    ```
    Alice's age: 30
    Math score: 95
    David not found
    After delete: [english:0 math:95 science:88]
    All ages:
      Alice: 30
      Bob: 25
      Charlie: 35
    Number of people: 3
    Config: [enabled:true host:localhost port:8080 timeout:30.5]
    ```

---

## Slice Internals

Understanding slice internals helps avoid common pitfalls and optimize performance.

=== "The Code"

    ```go
    package main

    import "fmt"

    // Slice header structure (conceptual)
    type SliceHeader struct {
        Data uintptr
        Len  int
        Cap  int
    }

    func main() {
        // Create a slice from an array
        arr := [5]int{10, 20, 30, 40, 50}
        slice := arr[1:4] // [20 30 40]

        fmt.Println("Original array:", arr)
        fmt.Println("Slice:", slice)
        fmt.Printf("Slice: len=%d, cap=%d\n", len(slice), cap(slice))

        // Reslicing: change length and capacity
        extended := slice[:5] // Extend to capacity
        fmt.Println("Extended:", extended)

        // Sub-slicing shares underlying array
        sub := slice[1:3] // [30 40]
        fmt.Println("Sub-slice:", sub)

        // Modifying sub-slice affects original
        sub[0] = 999
        fmt.Println("After modifying sub-slice:")
        fmt.Println("  Slice:", slice)
        fmt.Println("  Original array:", arr)

        // To break sharing, use copy
        independent := make([]int, len(slice))
        copy(independent, slice)
        independent[0] = 100
        fmt.Println("\nAfter independent copy:")
        fmt.Println("  Independent:", independent)
        fmt.Println("  Slice:", slice)

        // Show internal representation
        fmt.Println("\nSlice internals:")
        fmt.Printf("  Data pointer points to arr[%d]\n", 1)
        fmt.Printf("  Length: %d (slice[1:4])\n", len(slice))
        fmt.Printf("  Capacity: %d (arr[1:] has cap 4)\n", cap(slice))
    }
    ```

=== "The Explanation"

    - **Slice header**: Contains a pointer to data, length, and capacity
    - **Shared backing array**: Multiple slices can share the same underlying array
    - **Reslicing**: Changing slice bounds can extend within capacity
    - **Mutability**: Modifying one slice affects all slices sharing the same backing array
    - **Copy to independent**: Use `copy()` to create an independent slice

=== "The Terminal Output"

    ```
    Original array: [10 20 30 40 50]
    Slice: [20 30 40]
    Slice: len=3, cap=4
    Extended: [20 30 40 50]
    Sub-slice: [30 40]
    After modifying sub-slice:
      Slice: [20 999 40]
      Original array: [10 20 999 40 50]
    After independent copy:
      Independent: [100 999 40]
      Slice: [20 999 40]
    Slice internals:
      Data pointer points to arr[1]
      Length: 3 (slice[1:4])
      Capacity: 4 (arr[1:] has cap 4)
    ```

---

## Common Slice Patterns

Go provides efficient idioms for filtering, mapping, and transforming slices.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "strings"
    )

    // Filter: keep elements matching predicate
    func filterInts(slice []int, predicate func(int) bool) []int {
        var result []int
        for _, v := range slice {
            if predicate(v) {
                result = append(result, v)
            }
        }
        return result
    }

    // Map: transform each element
    func mapStrings(slice []string, transform func(string) string) []string {
        result := make([]string, len(slice))
        for i, v := range slice {
            result[i] = transform(v)
        }
        return result
    }

    // Reduce: accumulate result
    func reduceInts(slice []int, initial int, operation func(int, int) int) int {
        result := initial
        for _, v := range slice {
            result = operation(result, v)
        }
        return result
    }

    // Contains: check if element exists
    func contains(slice []string, target string) bool {
        for _, v := range slice {
            if v == target {
                return true
            }
        }
        return false
    }

    // IndexOf: find element position
    func indexOf(slice []int, target int) int {
        for i, v := range slice {
            if v == target {
                return i
            }
        }
        return -1
    }

    // Chunk: split slice into groups
    func chunk(slice []int, size int) [][]int {
        var chunks [][]int
        for i := 0; i < len(slice); i += size {
            end := i + size
            if end > len(slice) {
                end = len(slice)
            }
            chunks = append(chunks, slice[i:end])
        }
        return chunks
    }

    func main() {
        numbers := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}

        // Filter even numbers
        evens := filterInts(numbers, func(n int) bool {
            return n%2 == 0
        })
        fmt.Println("Even numbers:", evens)

        // Map: convert to strings
        words := []string{"hello", "world", "go"}
        capitalized := mapStrings(words, strings.Title)
        fmt.Println("Capitalized:", capitalized)

        // Reduce: sum all numbers
        sum := reduceInts(numbers, 0, func(acc, n int) int {
            return acc + n
        })
        fmt.Println("Sum:", sum)

        // Contains
        fruits := []string{"apple", "banana", "cherry"}
        fmt.Println("Has banana:", contains(fruits, "banana"))
        fmt.Println("Has grape:", contains(fruits, "grape"))

        // IndexOf
        fmt.Println("Index of 5:", indexOf(numbers, 5))
        fmt.Println("Index of 11:", indexOf(numbers, 11))

        // Chunk
        data := []int{1, 2, 3, 4, 5, 6, 7, 8}
        chunks := chunk(data, 3)
        fmt.Println("Chunks:", chunks)
    }
    ```

=== "The Explanation"

    - **Filter**: Iterate and keep elements matching a condition
    - **Map**: Transform each element using a function
    - **Reduce**: Accumulate elements into a single result
    - **Contains**: Linear search for element existence
    - **IndexOf**: Find position of element (or -1 if not found)
    - **Chunk**: Split into fixed-size groups for batch processing

=== "The Terminal Output"

    ```
    Even numbers: [2 4 6 8 10]
    Capitalized: [Hello World Go]
    Sum: 55
    Has banana: true
    Has grape: false
    Index of 5: 4
    Index of 11: -1
    Chunks: [[1 2 3] [4 5 6] [7 8]]
    ```

---

## Generics: Go 1.18+

Generics enable writing type-safe, reusable code without sacrificing performance.

=== "The Code"

    ```go
    package main

    import "fmt"

    // Generic function: works with any ordered type
    func min[T int | float64 | string](a, b T) T {
        if a < b {
            return a
        }
        return b
    }

    // Generic function with multiple type parameters
    func mapSlice[T any, R any](slice []T, transform func(T) R) []R {
        result := make([]R, len(slice))
        for i, v := range slice {
            result[i] = transform(v)
        }
        return result
    }

    // Generic constraint using interface
    type Number interface {
        int | int32 | int64 | float32 | float64
    }

    func sum[T Number](numbers []T) T {
        var total T
        for _, n := range numbers {
            total += n
        }
        return total
    }

    func main() {
        // Works with different types
        fmt.Println("min(3, 5):", min(3, 5))
        fmt.Println("min(3.14, 2.71):", min(3.14, 2.71))
        fmt.Println("min('abc', 'xyz'):", min("abc", "xyz"))

        // Generic map function
        numbers := []int{1, 2, 3, 4, 5}
        doubled := mapSlice(numbers, func(n int) int { return n * 2 })
        fmt.Println("Doubled:", doubled)

        strings := []string{"a", "b", "c"}
        lengths := mapSlice(strings, func(s string) int { return len(s) })
        fmt.Println("Lengths:", lengths)

        // Sum with different number types
        ints := []int{1, 2, 3, 4, 5}
        floats := []float64{1.5, 2.5, 3.5}
        fmt.Println("Sum of ints:", sum(ints))
        fmt.Println("Sum of floats:", sum(floats))
    }
    ```

=== "The Explanation"

    - **Type parameter `[T int | float64 | string]`**: Defines allowed types
    - **`any` constraint**: Accepts any type (equivalent to `interface{}`)
    - **Union types**: Use `|` to specify multiple allowed types
    - **Named constraints**: Define reusable type constraints as interfaces
    - **Type inference**: Go infers types from function arguments

=== "The Terminal Output"

    ```
    min(3, 5): 3
    min(3.14, 2.71): 2.71
    min(abc, xyz): abc
    Doubled: [2 4 6 8 10]
    Lengths: [1 1 1]
    Sum of ints: 15
    Sum of floats: 7.5
    ```

---

## Type Constraints

Go provides built-in constraints and allows defining custom ones for more specific requirements.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "golang.org/x/exp/constraints"
    )

    // Built-in comparable constraint
    func contains[T comparable](slice []T, target T) bool {
        for _, v := range slice {
            if v == target {
                return true
            }
        }
        return false
    }

    // Custom ordered constraint
    type Ordered interface {
        ~int | ~int8 | ~int16 | ~int32 | ~int64 |
            ~uint | ~uint8 | ~uint16 | ~uint32 | ~uint64 |
            ~float32 | ~float64 | ~string
    }

    // Generic stack data structure
    type Stack[T any] struct {
        items []T
    }

    func NewStack[T any]() *Stack[T] {
        return &Stack[T]{items: make([]T, 0)}
    }

    func (s *Stack[T]) Push(item T) {
        s.items = append(s.items, item)
    }

    func (s *Stack[T]) Pop() (T, bool) {
        var zero T
        if len(s.items) == 0 {
            return zero, false
        }
        item := s.items[len(s.items)-1]
        s.items = s.items[:len(s.items)-1]
        return item, true
    }

    func (s *Stack[T]) Len() int {
        return len(s.items)
    }

    func main() {
        // Comparable constraint
        nums := []int{1, 2, 3, 4, 5}
        fmt.Println("Contains 3:", contains(nums, 3))
        fmt.Println("Contains 6:", contains(nums, 6))

        words := []string{"go", "is", "awesome"}
        fmt.Println("Contains 'go':", contains(words, "go"))

        // Generic stack with strings
        stringStack := NewStack[string]()
        stringStack.Push("hello")
        stringStack.Push("world")
        stringStack.Push("go")

        for stringStack.Len() > 0 {
            item, _ := stringStack.Pop()
            fmt.Println("Popped:", item)
        }

        // Generic stack with integers
        intStack := NewStack[int]()
        intStack.Push(10)
        intStack.Push(20)
        intStack.Push(30)

        for intStack.Len() > 0 {
            item, _ := intStack.Pop()
            fmt.Println("Popped:", item)
        }
    }
    ```

=== "The Explanation"

    - **`comparable`**: Built-in constraint for types that support `==` and `!=`
    - **`cmp.Ordered`**: Types that support `<`, `>`, `<=`, `>=`
    - **Custom constraints**: Define interfaces with union types
    - **`~` operator**: Includes underlying types (e.g., `~int` matches `type MyInt int`)
    - **Generic data structures**: Create type-safe collections like Stack, Queue, Map

=== "The Terminal Output"

    ```
    Contains 3: true
    Contains 6: false
    Contains 'go': true
    Popped: go
    Popped: world
    Popped: hello
    Popped: 30
    Popped: 20
    Popped: 10
    ```

---

## Generic Functions and Types

Build reusable algorithms and data structures with type safety.

=== "The Code"

    ```go
    package main

    import (
        "cmp"
        "fmt"
        "sort"
    )

    // Generic interface for sortable items
    type Sortable[T any] interface {
        Len() int
        Less(i, j int) bool
        Swap(i, j int)
    }

    // Generic min/max functions
    func Min[T cmp.Ordered](a, b T) T {
        if a < b {
            return a
        }
        return b
    }

    func Max[T cmp.Ordered](a, b T) T {
        if a > b {
            return a
        }
        return b
    }

    // Generic clamp function
    func Clamp[T cmp.Ordered](value, min, max T) T {
        if value < min {
            return min
        }
        if value > max {
            return max
        }
        return value
    }

    // Generic key-value pair
    type Pair[K comparable, V any] struct {
        Key   K
        Value V
    }

    // Generic dictionary using pairs
    type Dictionary[K comparable, V any] struct {
        pairs []Pair[K, V]
    }

    func NewDictionary[K comparable, V any]() *Dictionary[K, V] {
        return &Dictionary[K, V]{pairs: make([]Pair[K, V], 0)}
    }

    func (d *Dictionary[K, V]) Set(key K, value V) {
        for i, p := range d.pairs {
            if p.Key == key {
                d.pairs[i].Value = value
                return
            }
        }
        d.pairs = append(d.pairs, Pair[K, V]{Key: key, Value: value})
    }

    func (d *Dictionary[K, V]) Get(key K) (V, bool) {
        for _, p := range d.pairs {
            if p.Key == key {
                return p.Value, true
            }
        }
        var zero V
        return zero, false
    }

    func main() {
        // Min/Max
        fmt.Println("Min(3, 5):", Min(3, 5))
        fmt.Println("Max(3, 5):", Max(3, 5))
        fmt.Println("Min(3.14, 2.71):", Min(3.14, 2.71))

        // Clamp
        fmt.Println("Clamp(15, 0, 10):", Clamp(15, 0, 10))
        fmt.Println("Clamp(-5, 0, 10):", Clamp(-5, 0, 10))
        fmt.Println("Clamp(5, 0, 10):", Clamp(5, 0, 10))

        // Generic dictionary
        dict := NewDictionary[string, int]()
        dict.Set("one", 1)
        dict.Set("two", 2)
        dict.Set("three", 3)

        if val, ok := dict.Get("two"); ok {
            fmt.Println("two:", val)
        }

        // Generic sort helper
        numbers := []int{5, 2, 8, 1, 9, 3}
        sort.Slice(numbers, func(i, j int) bool {
            return numbers[i] < numbers[j]
        })
        fmt.Println("Sorted:", numbers)
    }
    ```

=== "The Explanation"

    - **Generic functions**: Write once, use with multiple types
    - **Generic types**: Create type-safe data structures
    - **Type parameters**: Multiple parameters `[K comparable, V any]`
    - **Zero values**: Use `var zero T` to get the zero value for type assertions
    - **Performance**: Generics avoid runtime type assertions and boxing

=== "The Terminal Output"

    ```
    Min(3, 5): 3
    Max(3, 5): 5
    Min(3.14, 2.71): 2.71
    Clamp(15, 0, 10): 10
    Clamp(-5, 0, 10): 0
    Clamp(5, 0, 10): 5
    two: 2
    Sorted: [1 2 3 5 8 9]
    ```

---

## Best Practices

| Practice | Recommendation | Reason |
|----------|---------------|--------|
| Slice growth | Pre-allocate with `make([]T, 0, cap)` | Avoids repeated reallocation |
| Map usage | Check key existence before access | Prevents zero value surprises |
| Generics | Use when type safety matters | Avoids `interface{}` overhead |
| Constraints | Keep minimal | Easier to satisfy and understand |
| Slice sharing | Be aware of backing array | Prevents unintended mutations |
| Maps vs slices | Maps for lookup, slices for ordering | Choose based on access pattern |

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Index out of range | Accessing beyond slice length | Check `len(slice)` first |
| Map assignment panic | Assigning to nil map | Initialize with `make()` |
| Unexpected zero value | Key doesn't exist in map | Use comma-ok idiom |
| Slice mutation | Shared backing array | Copy slice before modifying |
| Generic type error | Type doesn't satisfy constraint | Check constraint definition |
| Capacity exceeded | Append beyond capacity | Use `append(slice, more...)` |

## Summary

- Slices are dynamically-sized views into arrays with length and capacity
- Maps provide fast key-value storage with comparable key types
- Slice internals include a pointer, length, and capacity
- Common patterns include filter, map, reduce, and chunk
- Generics enable type-safe reusable code with constraints
- `comparable` and `any` are fundamental built-in constraints

## Next Steps

- [Error Handling](error-handling.md) - Master Go's error handling patterns
- [HTTP Servers](http-servers.md) - Build web applications with net/http
- [Functions & Methods](functions-methods.md) - Deepen understanding of Go functions
