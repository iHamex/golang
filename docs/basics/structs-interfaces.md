# Structs & Interfaces

Structs and interfaces are the cornerstones of Go's type system. Structs provide a way to define custom data types with named fields, while interfaces enable polymorphism through implicit satisfaction. Together, they form the foundation of Go's approach to composition over inheritance.

## What You Will Learn

- Defining and using structs with fields and methods
- Working with embedded structs for composition
- Understanding struct tags for JSON, database, and validation
- Implementing interfaces through implicit satisfaction
- Using type assertions and type switches safely
- Composing interfaces for flexible API design
- Applying SOLID principles in Go code

## Prerequisites

- Understanding of Go functions and methods
- Familiarity with basic Go data types
- Knowledge of package structure

---

## Struct Definitions

Structs are composite types that group named fields of different types into a single unit.

=== "The Code"

    ```go
    package main

    import "fmt"

    // Basic struct definition
    type Person struct {
        FirstName string
        LastName  string
        Age       int
    }

    // Struct with tag
    type User struct {
        ID    int    `json:"id"`
        Name  string `json:"name"`
        Email string `json:"email"`
    }

    // Anonymous struct (useful for temporary data)
    func main() {
        // Named struct initialization
        p1 := Person{
            FirstName: "John",
            LastName:  "Doe",
            Age:       30,
        }

        // Positional initialization (less readable)
        p2 := Person{"Jane", "Smith", 25}

        // Partial initialization
        p3 := Person{FirstName: "Bob"}

        fmt.Println("Person 1:", p1)
        fmt.Println("Person 2:", p2)
        fmt.Println("Person 3:", p3)

        // Anonymous struct
        temp := struct {
            X, Y int
        }{X: 10, Y: 20}
        fmt.Println("Anonymous:", temp)
    }
    ```

=== "The Explanation"

    - **Struct literal**: Initialize with `TypeName{field: value}` syntax
    - **Field access**: Use dot notation `p.FirstName` to access fields
    - **Zero values**: Uninitialized fields get their type's zero value
    - **Anonymous structs**: Useful for temporary data without defining a type

=== "The Terminal Output"

    ```
    Person 1: {John Doe 30}
    Person 2: {Jane Smith 25}
    Person 3: {Bob  0}
    Anonymous: {10 20}
    ```

---

## Embedded Structs

Embedding allows you to compose structs by including one struct inside another, promoting its fields and methods.

=== "The Code"

    ```go
    package main

    import "fmt"

    type Address struct {
        Street  string
        City    string
        Country string
    }

    type Employee struct {
        Person    // Embedded struct (promoted fields)
        Address   // Embedded struct
        Company   string
        Position  string
        Salary    float64
    }

    type Person struct {
        Name  string
        Email string
    }

    func main() {
        emp := Employee{
            Person: Person{
                Name:  "Alice Johnson",
                Email: "alice@example.com",
            },
            Address: Address{
                Street:  "123 Main St",
                City:    "Berlin",
                Country: "Germany",
            },
            Company:  "Tech Corp",
            Position: "Software Engineer",
            Salary:   85000,
        }

        // Accessing promoted fields directly
        fmt.Println("Name:", emp.Name)
        fmt.Println("City:", emp.City)

        // Accessing embedded struct
        fmt.Println("Full Address:", emp.Address)

        // Method promotion
        emp.PrintDetails()
    }

    func (p Person) PrintDetails() {
        fmt.Printf("Name: %s, Email: %s\n", p.Name, p.Email)
    }
    ```

=== "The Explanation"

    - **Embedding**: Include a struct type without a field name
    - **Promoted fields**: Fields from embedded structs are accessible directly
    - **Method promotion**: Methods from embedded types are promoted to the outer struct
    - **Name conflicts**: If two embedded types have the same field name, access via the type name

=== "The Terminal Output"

    ```
    Name: Alice Johnson
    City: Berlin
    Full Address: {123 Main St Berlin Germany}
    Name: Alice Johnson, Email: alice@example.com
    ```

---

## Struct Tags

Struct tags provide metadata for encoding, decoding, and validation of struct fields.

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "fmt"
        "strings"
    )

    type Product struct {
        ID          int     `json:"id" validate:"required"`
        Name        string  `json:"name" validate:"required,min=2,max=100"`
        Price       float64 `json:"price" validate:"required,gt=0"`
        Description string  `json:"description,omitempty"`
        InStock     bool    `json:"in_stock"`
        Tags        []string `json:"tags,omitempty"`
    }

    func main() {
        // Create a product
        product := Product{
            ID:          1,
            Name:        "Go Programming Book",
            Price:       29.99,
            Description: "Learn Go from scratch",
            InStock:     true,
            Tags:        []string{"programming", "golang"},
        }

        // Marshal to JSON (uses json tags)
        jsonData, _ := json.MarshalIndent(product, "", "  ")
        fmt.Println("JSON Output:")
        fmt.Println(string(jsonData))

        // Simulate validation (basic implementation)
        validateProduct(product)
    }

    func validateProduct(p Product) {
        var errors []string
        if p.Name == "" {
            errors = append(errors, "name is required")
        }
        if p.Price <= 0 {
            errors = append(errors, "price must be greater than 0")
        }
        if len(p.Name) < 2 {
            errors = append(errors, "name must be at least 2 characters")
        }
        if len(errors) == 0 {
            fmt.Println("\nValidation: PASSED")
        } else {
            fmt.Println("\nValidation: FAILED")
            fmt.Println("Errors:", strings.Join(errors, "; "))
        }
    }
    ```

=== "The Explanation"

    - **JSON tags**: Control field names and serialization behavior in JSON output
    - **`omitempty`**: Omit the field from JSON if it has a zero value
    - **Validation tags**: Define validation rules (used by frameworks like `go-playground/validator`)
    - **Tag format**: `key:"value"` pairs separated by spaces

=== "The Terminal Output"

    ```
    JSON Output:
    {
      "id": 1,
      "name": "Go Programming Book",
      "price": 29.99,
      "description": "Learn Go from scratch",
      "in_stock": true,
      "tags": [
        "programming",
        "golang"
      ]
    }
    Validation: PASSED
    ```

---

## Methods on Structs

Methods defined on structs enable object-oriented behavior while maintaining Go's simplicity.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "math"
    )

    type Circle struct {
        X, Y   float64
        Radius float64
    }

    // Method with value receiver (read-only)
    func (c Circle) Area() float64 {
        return math.Pi * c.Radius * c.Radius
    }

    // Method with value receiver
    func (c Circle) Perimeter() float64 {
        return 2 * math.Pi * c.Radius
    }

    // Method with value receiver
    func (c Circle) Contains(x, y float64) bool {
        dx := c.X - x
        dy := c.Y - y
        return math.Sqrt(dx*dx+dy*dy) <= c.Radius
    }

    // String method for fmt.Stringer interface
    func (c Circle) String() string {
        return fmt.Sprintf("Circle(%.2f, %.2f, r=%.2f)", c.X, c.Y, c.Radius)
    }

    func main() {
        c := Circle{X: 0, Y: 0, Radius: 5}

        fmt.Println("Circle:", c)
        fmt.Printf("Area: %.2f\n", c.Area())
        fmt.Printf("Perimeter: %.2f\n", c.Perimeter())
        fmt.Printf("Contains (3,4): %v\n", c.Contains(3, 4))
        fmt.Printf("Contains (6,0): %v\n", c.Contains(6, 0))
    }
    ```

=== "The Explanation"

    - **Value receiver `(c Circle)`**: Creates a copy; cannot modify the original
    - **Read-only methods**: Use value receivers for methods that don't modify state
    - **String() method**: Implements the `fmt.Stringer` interface for custom formatting
    - **Method chaining**: Not directly supported in Go (methods return values, not receiver)

=== "The Terminal Output"

    ```
    Circle: Circle(0.00, 0.00, r=5.00)
    Area: 78.54
    Perimeter: 31.42
    Contains (3,4): true
    Contains (6,0): false
    ```

---

## Interfaces and Implicit Satisfaction

Go interfaces are satisfied implicitly—no explicit `implements` keyword is needed.

=== "The Code"

    ```go
    package main

    import "fmt"

    // Interface definition
    type Shape interface {
        Area() float64
        Perimeter() float64
    }

    // Circle implements Shape
    type Circle struct {
        Radius float64
    }

    func (c Circle) Area() float64 {
        return 3.14159 * c.Radius * c.Radius
    }

    func (c Circle) Perimeter() float64 {
        return 2 * 3.14159 * c.Radius
    }

    // Rectangle implements Shape
    type Rectangle struct {
        Width, Height float64
    }

    func (r Rectangle) Area() float64 {
        return r.Width * r.Height
    }

    func (r Rectangle) Perimeter() float64 {
        return 2 * (r.Width + r.Height)
    }

    // Function accepting interface
    func printShapeInfo(s Shape) {
        fmt.Printf("Type: %T\n", s)
        fmt.Printf("Area: %.2f\n", s.Area())
        fmt.Printf("Perimeter: %.2f\n", s.Perimeter())
    }

    func main() {
        shapes := []Shape{
            Circle{Radius: 5},
            Rectangle{Width: 10, Height: 5},
        }

        for _, shape := range shapes {
            printShapeInfo(shape)
            fmt.Println("---")
        }
    }
    ```

=== "The Explanation"

    - **Interface declaration**: Define a set of method signatures
    - **Implicit satisfaction**: Any type implementing all methods satisfies the interface
    - **Polymorphism**: Use interfaces to write generic code that works with multiple types
    - **Duck typing**: "If it walks like a duck and quacks like a duck, it's a duck"

=== "The Terminal Output"

    ```
    Type: main.Circle
    Area: 78.54
    Perimeter: 31.42
    ---
    Type: main.Rectangle
    Area: 50.00
    Perimeter: 30.00
    ---
    ```

---

## The Empty Interface

The empty interface `interface{}` accepts any type, useful when you don't know the type at compile time.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "strconv"
    )

    // Empty interface accepts any type
    func describe(i interface{}) string {
        return fmt.Sprintf("(type=%T, value=%v)", i, i)
    }

    // Type assertion from empty interface
    func asString(i interface{}) (string, bool) {
        s, ok := i.(string)
        return s, ok
    }

    func asInt(i interface{}) (int, bool) {
        n, ok := i.(int)
        return n, ok
    }

    func main() {
        values := []interface{}{
            42,
            "hello",
            3.14,
            true,
            []int{1, 2, 3},
        }

        for _, v := range values {
            fmt.Println(describe(v))
        }

        // Safe type assertions
        fmt.Println("\nType assertions:")
        if s, ok := asString("hello"); ok {
            fmt.Println("String:", s)
        }
        if n, ok := asInt(42); ok {
            fmt.Println("Int:", n)
        }

        // Using strconv for conversion
        result, err := strconv.Atoi("123")
        if err == nil {
            fmt.Println("Converted:", result)
        }
    }
    ```

=== "The Explanation"

    - **`interface{}`**: Equivalent to `any` in Go 1.18+; accepts any type
    - **Type assertion**: Use `i.(Type)` to extract the underlying value
    - **Comma-ok idiom**: Always use the two-value form `v, ok := i.(Type)` for safe assertions
    - **`any` alias**: Go 1.18+ provides `any` as a more readable alias for `interface{}`

=== "The Terminal Output"

    ```
    (type=int, value=42)
    (type=string, value=hello)
    (type=float64, value=3.14)
    (type=bool, value=true)
    (type=[]int, value=[1 2 3])
    Type assertions:
    String: hello
    Int: 42
    Converted: 123
    ```

---

## Type Assertions and Type Switches

Type switches provide a clean way to handle multiple possible types from an interface value.

=== "The Code"

    ```go
    package main

    import "fmt"

    type Animal interface {
        Speak() string
    }

    type Dog struct {
        Name string
    }

    func (d Dog) Speak() string {
        return "Woof!"
    }

    type Cat struct {
        Name string
    }

    func (c Cat) Speak() string {
        return "Meow!"
    }

    type Bird struct {
        Name string
    }

    func (b Bird) Speak() string {
        return "Tweet!"
    }

    // Type switch to handle different types
    func describeAnimal(a Animal) string {
        switch v := a.(type) {
        case Dog:
            return fmt.Sprintf("Dog %s says: %s", v.Name, v.Speak())
        case Cat:
            return fmt.Sprintf("Cat %s says: %s", v.Name, v.Speak())
        case Bird:
            return fmt.Sprintf("Bird %s says: %s", v.Name, v.Speak())
        default:
            return fmt.Sprintf("Unknown animal: %T", v)
        }
    }

    func main() {
        animals := []Animal{
            Dog{Name: "Rex"},
            Cat{Name: "Whiskers"},
            Bird{Name: "Tweety"},
        }

        for _, animal := range animals {
            fmt.Println(describeAnimal(animal))
        }
    }
    ```

=== "The Explanation"

    - **Type switch**: `switch v := a.(type)` pattern to match on concrete types
    - **Variable `v`**: Holds the typed value in each case branch
    - **Default case**: Handles unexpected types gracefully
    - **Exhaustive matching**: Consider covering all possible types or using a default

=== "The Terminal Output"

    ```
    Dog Rex says: Woof!
    Cat Whiskers says: Meow!
    Bird Tweety says: Tweet!
    ```

---

## Interface Composition

Go interfaces can be composed by embedding smaller interfaces, following the Interface Segregation Principle.

=== "The Code"

    ```go
    package main

    import "fmt"

    // Small, focused interfaces
    type Reader interface {
        Read(p []byte) (n int, err error)
    }

    type Writer interface {
        Write(p []byte) (n int, err error)
    }

    // Composed interface
    type ReadWriter interface {
        Reader
        Writer
    }

    // Concrete implementation
    type Buffer struct {
        data []byte
    }

    func (b *Buffer) Read(p []byte) (int, error) {
        if len(b.data) == 0 {
            return 0, fmt.Errorf("buffer empty")
        }
        n := copy(p, b.data)
        b.data = b.data[n:]
        return n, nil
    }

    func (b *Buffer) Write(p []byte) (int, error) {
        b.data = append(b.data, p...)
        return len(p), nil
    }

    func processBuffer(rw ReadWriter) {
        // Write some data
        data := []byte("Hello, Go interfaces!")
        n, _ := rw.Write(data)
        fmt.Printf("Wrote %d bytes\n", n)

        // Read it back
        buf := make([]byte, 100)
        n, _ = rw.Read(buf)
        fmt.Printf("Read %d bytes: %s\n", n, string(buf[:n]))
    }

    func main() {
        var buf Buffer
        processBuffer(&buf)
    }
    ```

=== "The Explanation"

    - **Interface embedding**: Compose interfaces by embedding smaller ones
    - **Single Responsibility**: Each interface has a focused purpose
    - **Open/Closed**: New implementations can satisfy interfaces without modification
    - **Go convention**: Keep interfaces small (1-3 methods ideally)

=== "The Terminal Output"

    ```
    Wrote 21 bytes
    Read 21 bytes: Hello, Go interfaces!
    ```

---

## SOLID Principles in Go

Go naturally supports SOLID principles through its type system and interface design.

=== "The Code"

    ```go
    package main

    import "fmt"

    // Single Responsibility Principle
    type UserRepository struct {
        users map[int]string
    }

    func NewUserRepository() *UserRepository {
        return &UserRepository{users: make(map[int]string)}
    }

    func (r *UserRepository) SaveUser(id int, name string) {
        r.users[id] = name
    }

    func (r *UserRepository) FindUser(id int) (string, bool) {
        name, ok := r.users[id]
        return name, ok
    }

    // Interface Segregation Principle
    type UserReader interface {
        FindUser(id int) (string, bool)
    }

    type UserWriter interface {
        SaveUser(id int, name string)
    }

    // Dependency Inversion Principle
    type UserService struct {
        reader UserReader
        writer UserWriter
    }

    func NewUserService(r UserReader, w UserWriter) *UserService {
        return &UserService{reader: r, writer: w}
    }

    func (s *UserService) GetUser(id int) string {
        name, ok := s.reader.FindUser(id)
        if !ok {
            return "User not found"
        }
        return name
    }

    func (s *UserService) CreateUser(id int, name string) {
        s.writer.SaveUser(id, name)
        fmt.Printf("Created user: %s\n", name)
    }

    func main() {
        repo := NewUserRepository()
        service := NewUserService(repo, repo)

        service.CreateUser(1, "Alice")
        fmt.Println("Get user 1:", service.GetUser(1))
        fmt.Println("Get user 2:", service.GetUser(2))
    }
    ```

=== "The Explanation"

    - **SRP**: Each type has a single responsibility (repository, service)
    - **ISP**: Small, focused interfaces (`UserReader`, `UserWriter`)
    - **DIP**: High-level modules depend on abstractions, not concrete implementations
    - **Composition**: Go favors composition over inheritance for code reuse

=== "The Terminal Output"

    ```
    Created user: Alice
    Get user 1: Alice
    Get user 2: User not found
    ```

---

## Best Practices

| Practice | Recommendation | Reason |
|----------|---------------|--------|
| Struct size | Keep structs focused | Single responsibility |
| Interface size | 1-3 methods ideal | Easier to implement and test |
| Embedding | Prefer over inheritance | Promotes composition |
| Struct tags | Use consistently | Enables serialization |
| Empty interface | Avoid when possible | Lose type safety |
| Pointer receivers | Use for methods that modify | Prevents unintended copies |

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Cannot use type as interface | Missing method implementation | Add required methods |
| Ambiguous embedded field | Same field name in multiple embeddings | Access via type name explicitly |
| Nil pointer dereference | Accessing method on nil pointer receiver | Add nil checks in methods |
| Interface not satisfied | Method signature mismatch | Check parameter and return types |
| Circular embedding | Struct embedding itself | Restructure to break the cycle |

## Summary

- Structs define custom types with named fields and methods
- Embedded structs enable composition with promoted fields and methods
- Struct tags provide metadata for serialization and validation
- Interfaces are satisfied implicitly, enabling polymorphism
- Type switches safely handle multiple concrete types
- Small interfaces promote better design and testability

## Next Steps

- [Collections & Generics](collections-generics.md) - Work with slices, maps, and generics
- [Error Handling](error-handling.md) - Master Go's error handling patterns
- [HTTP Servers](http-servers.md) - Build web applications with net/http
