# Functions & Methods

Functions are the building blocks of Go programs. Unlike many languages, Go treats functions as first-class citizens, enabling powerful patterns like closures and higher-order functions. Methods are simply functions with a special receiver argument, forming the foundation of Go's approach to object-oriented design.

## What You Will Learn

- How to declare and call functions with parameters and return values
- Working with multiple return values and named return values
- Using variadic functions to accept flexible argument counts
- Understanding closures and their practical applications
- Defining methods with value and pointer receivers
- Leveraging function types and higher-order functions
- The role and behavior of the init() function

## Prerequisites

- Basic understanding of Go syntax and data types
- Familiarity with variables and constants
- A Go development environment (Go 1.21+)

---

## Function Declarations

Go functions are declared with the `func` keyword, followed by the function name, parameters, and return type.

=== "The Code"

    ```go
    package main

    import "fmt"

    // Basic function with no parameters and no return value
    func greet() {
        fmt.Println("Hello, Go!")
    }

    // Function with parameters
    func add(a int, b int) int {
        return a + b
    }

    // Function with shorthand parameter types
    func multiply(a, b int) int {
        return a * b
    }

    func main() {
        greet()
        fmt.Println("3 + 4 =", add(3, 4))
        fmt.Println("3 * 4 =", multiply(3, 4))
    }
    ```

=== "The Explanation"

    - **`func` keyword**: Every function declaration starts with this keyword
    - **Function name**: Follows Go naming conventions (camelCase for unexported, PascalCase for exported)
    - **Parameters**: Declared as `name type`, with shorthand for same-type parameters
    - **Return type**: Placed after the parameter list; can be omitted for void functions

=== "The Terminal Output"

    ```
    Hello, Go!
    3 + 4 = 7
    3 * 4 = 12
    ```

---

## Multiple Return Values

Go functions can return multiple values, a feature commonly used for error handling and returning rich results.

=== "The Code"

    ```go
    package main

    import (
        "errors"
        "fmt"
    )

    // Multiple return values
    func divide(a, b float64) (float64, error) {
        if b == 0 {
            return 0, errors.New("division by zero")
        }
        return a / b, nil
    }

    // Swapping values
    func swap(a, b int) (int, int) {
        return b, a
    }

    func main() {
        result, err := divide(10, 3)
        if err != nil {
            fmt.Println("Error:", err)
        } else {
            fmt.Printf("10 / 3 = %.2f\n", result)
        }

        x, y := swap(1, 2)
        fmt.Printf("Swapped: %d, %d\n", x, y)
    }
    ```

=== "The Explanation"

    - **Multiple returns**: Separate return types with commas; wrap in parentheses
    - **Error convention**: Go uses multiple returns for error handling instead of exceptions
    - **Blank identifier**: Use `_` to ignore unwanted return values
    - **Named returns**: Can name return values for documentation purposes

=== "The Terminal Output"

    ```
    10 / 3 = 3.33
    Swapped: 2, 1
    ```

---

## Named Return Values

Named return values provide implicit documentation and enable the naked return statement.

=== "The Code"

    ```go
    package main

    import "fmt"

    // Named return values
    func rectangleStats(width, height float64) (area, perimeter float64) {
        area = width * height
        perimeter = 2 * (width + height)
        return // Naked return
    }

    // Named returns with error
    func divide(a, b float64) (result float64, err error) {
        if b == 0 {
            err = fmt.Errorf("cannot divide %v by zero", a)
            return
        }
        result = a / b
        return
    }

    func main() {
        area, perimeter := rectangleStats(5, 3)
        fmt.Printf("Area: %.2f, Perimeter: %.2f\n", area, perimeter)

        result, err := divide(10, 0)
        if err != nil {
            fmt.Println("Error:", err)
        } else {
            fmt.Printf("Result: %.2f\n", result)
        }
    }
    ```

=== "The Explanation"

    - **Named returns**: Variables declared in the return type are initialized to zero values
    - **Naked return**: A bare `return` statement returns the current values of named returns
    - **Readability**: Named returns improve code documentation
    - **Caution**: Use naked returns sparingly; they can reduce clarity in longer functions

=== "The Terminal Output"

    ```
    Area: 15.00, Perimeter: 16.00
    Error: cannot divide 10 by zero
    ```

---

## Variadic Functions

Variadic functions accept a variable number of arguments, providing flexibility similar to rest parameters in other languages.

=== "The Code"

    ```go
    package main

    import "fmt"

    // Variadic function accepting multiple integers
    func sum(numbers ...int) int {
        total := 0
        for _, n := range numbers {
            total += n
        }
        return total
    }

    // Mixing variadic with regular parameters
    func logMessage(level string, messages ...string) {
        for _, msg := range messages {
            fmt.Printf("[%s] %s\n", level, msg)
        }
    }

    // Spreading a slice into variadic parameters
    func max(nums ...int) int {
        if len(nums) == 0 {
            return 0
        }
        max := nums[0]
        for _, n := range nums[1:] {
            if n > max {
                max = n
            }
        }
        return max
    }

    func main() {
        fmt.Println("Sum:", sum(1, 2, 3, 4, 5))
        fmt.Println("Sum of 10-20:", sum(10, 20))

        logMessage("INFO", "Server started", "Listening on port 8080")

        numbers := []int{5, 3, 8, 1, 9}
        fmt.Println("Max:", max(numbers...))
    }
    ```

=== "The Explanation"

    - **`...` operator**: When placed before the last parameter type, it collects arguments into a slice
    - **Slice conversion**: The variadic parameter is internally a slice of the specified type
    - **Spread operator**: Use `slice...` to pass a slice as variadic arguments
    - **Order**: Non-variadic parameters must come before the variadic parameter

=== "The Terminal Output"

    ```
    Sum: 15
    Sum of 10-20: 30
    [INFO] Server started
    [INFO] Listening on port 8080
    Max: 9
    ```

---

## Closures

Closures are functions that capture and reference variables from their enclosing scope, enabling powerful patterns like stateful functions and callbacks.

=== "The Code"

    ```go
    package main

    import "fmt"

    // Counter using closure
    func makeCounter() func() int {
        count := 0
        return func() int {
            count++
            return count
        }
    }

    // Multiplication table generator
    func multiplier(factor int) func(int) int {
        return func(x int) int {
            return x * factor
        }
    }

    // Filter using closure
    func filterFunc(predicate func(int) bool) func([]int) []int {
        return func(slice []int) []int {
            var result []int
            for _, v := range slice {
                if predicate(v) {
                    result = append(result, v)
                }
            }
            return result
        }
    }

    func main() {
        counter := makeCounter()
        fmt.Println(counter()) // 1
        fmt.Println(counter()) // 2
        fmt.Println(counter()) // 3

        double := multiplier(2)
        triple := multiplier(3)
        fmt.Println("Double 5:", double(5))
        fmt.Println("Triple 5:", triple(5))

        numbers := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
        isEven := func(n int) bool { return n%2 == 0 }
        evenFilter := filterFunc(isEven)
        fmt.Println("Even numbers:", evenFilter(numbers))
    }
    ```

=== "The Explanation"

    - **Closure**: A function value that references variables from outside its body
    - **Encapsulated state**: The `count` variable persists across calls to the returned function
    - **Factory pattern**: Functions like `makeCounter` create specialized functions
    - **Variable lifetime**: Captured variables live as long as the closure exists

=== "The Terminal Output"

    ```
    1
    2
    3
    Double 5: 10
    Triple 5: 15
    Even numbers: [2 4 6 8 10]
    ```

---

## Methods: Value and Pointer Receivers

Methods in Go are functions with a special receiver argument, enabling syntax like `object.Method()`.

=== "The Code"

    ```go
    package main

    import "fmt"

    type Rect struct {
        Width, Height float64
    }

    // Value receiver: operates on a copy
    func (r Rect) Area() float64 {
        return r.Width * r.Height
    }

    // Value receiver for display
    func (r Rect) String() string {
        return fmt.Sprintf("Rect{%.2f x %.2f}", r.Width, r.Height)
    }

    // Pointer receiver: can modify the original struct
    func (r *Rect) Scale(factor float64) {
        r.Width *= factor
        r.Height *= factor
    }

    // Pointer receiver for efficiency (avoids copying large structs)
    func (r *Rect) Perimeter() float64 {
        return 2 * (r.Width + r.Height)
    }

    func main() {
        rect := Rect{Width: 10, Height: 5}

        fmt.Println("Original:", rect)
        fmt.Printf("Area: %.2f\n", rect.Area())
        fmt.Printf("Perimeter: %.2f\n", rect.Perimeter())

        rect.Scale(2)
        fmt.Println("After scaling:", rect)
        fmt.Printf("New Area: %.2f\n", rect.Area())
    }
    ```

=== "The Explanation"

    - **Receiver declaration**: Place the receiver between `func` and the method name
    - **Value receiver (`r Rect`)**: Operates on a copy; cannot modify the original
    - **Pointer receiver (`r *Rect`)**: Operates on the original; can modify the struct
    - **Consistency**: Use pointer receivers when any method needs to modify the receiver
    - **Efficiency**: Pointer receivers avoid copying large structs

=== "The Terminal Output"

    ```
    Original: Rect{10.00 x 5.00}
    Area: 50.00
    Perimeter: 30.00
    After scaling: Rect{20.00 x 10.00}
    New Area: 200.00
    ```

---

## Function Types and Higher-Order Functions

Go supports first-class functions, allowing functions to be passed as arguments, returned from other functions, and assigned to variables.

=== "The Code"

    ```go
    package main

    import "fmt"

    // Function type definition
    type MathFunc func(float64, float64) float64

    // Higher-order function accepting a function
    func apply(a, b float64, operation MathFunc) float64 {
        return operation(a, b)
    }

    // Function returning a function
    func makeAdder(x int) func(int) int {
        return func(y int) int {
            return x + y
        }
    }

    // Map function using higher-order pattern
    func mapInts(slice []int, transform func(int) int) []int {
        result := make([]int, len(slice))
        for i, v := range slice {
            result[i] = transform(v)
        }
        return result
    }

    func main() {
        // Assign functions to variables
        add := func(a, b float64) float64 { return a + b }
        sub := func(a, b float64) float64 { return a - b }

        fmt.Println("10 + 5 =", apply(10, 5, add))
        fmt.Println("10 - 5 =", apply(10, 5, sub))

        // Closure as a factory
        add10 := makeAdder(10)
        add20 := makeAdder(20)
        fmt.Println("10 + 5 =", add10(5))
        fmt.Println("20 + 5 =", add20(5))

        // Map pattern
        numbers := []int{1, 2, 3, 4, 5}
        doubled := mapInts(numbers, func(n int) int { return n * 2 })
        fmt.Println("Doubled:", doubled)
    }
    ```

=== "The Explanation"

    - **Function types**: Define named types for function signatures using `type`
    - **First-class functions**: Functions can be passed as arguments and returned
    - **Closures as factories**: Return functions that capture configuration values
    - **Higher-order functions**: Functions that operate on other functions enable powerful abstractions

=== "The Terminal Output"

    ```
    10 + 5 = 15
    10 - 5 = 5
    10 + 5 = 15
    20 + 5 = 25
    Doubled: [2 4 6 8 10]
    ```

---

## The init() Function

Go has a special `init()` function that runs automatically before `main()`, useful for package initialization.

=== "The Code"

    ```go
    package main

    import "fmt"

    // Global variables initialized first
    var config = map[string]string{
        "env":  "development",
        "port": "8080",
    }

    // First init function
    func init() {
        fmt.Println("init() #1: Config loaded")
        fmt.Println("Environment:", config["env"])
    }

    // Second init function (multiple init functions are allowed)
    func init() {
        fmt.Println("init() #2: Validation complete")
        if config["port"] == "" {
            config["port"] = "3000"
        }
    }

    func main() {
        fmt.Println("main(): Application started")
        fmt.Println("Listening on port:", config["port"])
    }
    ```

=== "The Explanation"

    - **Execution order**: Variable init → `init()` functions → `main()`
    - **Multiple inits**: A package can have multiple `init()` functions
    - **Package-level init**: `init()` runs when the package is imported
    - **Use cases**: Database connections, validation, configuration loading

=== "The Terminal Output"

    ```
    init() #1: Config loaded
    Environment: development
    init() #2: Validation complete
    main(): Application started
    Listening on port: 8080
    ```

---

## Best Practices

| Practice | Recommendation | Reason |
|----------|---------------|--------|
| Function length | Keep functions under 30 lines | Easier to read and test |
| Naming | Use descriptive names | Self-documenting code |
| Return values | Return errors last | Follow Go conventions |
| Pointer receivers | Use when modifying state | Consistency across methods |
| Closures | Avoid excessive complexity | Can be hard to debug |
| init() | Use sparingly | Can obscure startup logic |

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Cannot use type X as Y | Type mismatch in parameters | Check function signature |
| Undefined: method | Receiver not pointer/value | Try changing receiver type |
| Closure captures wrong value | Variable captured by reference | Use local copy in loop |
| init() not running | Package not imported | Ensure blank import `_ "pkg"` |
| Too many return values | Mismatched return statement | Check function signature |

## Summary

- Go functions support multiple return values, named returns, and variadic parameters
- Closures capture variables from their enclosing scope for stateful behavior
- Methods use value or pointer receivers to define type-specific behavior
- Function types enable higher-order patterns like callbacks and factories
- `init()` provides automatic package initialization before `main()`

## Next Steps

- [Structs & Interfaces](structs-interfaces.md) - Learn about Go's type system
- [Error Handling](error-handling.md) - Master Go's error handling patterns
- [Collections & Generics](collections-generics.md) - Work with slices, maps, and generics
