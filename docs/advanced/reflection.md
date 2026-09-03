# Reflection & Metaprogramming

Go's `reflect` package enables runtime type inspection and dynamic method invocation. While powerful, reflection should be used sparingly due to performance costs and reduced type safety. This guide covers the fundamentals of reflection, practical use cases, limitations, and modern alternatives like generics.

## What You Will Learn

- Inspecting types and values with `reflect.TypeOf` and `reflect.ValueOf`
- Reading and modifying struct fields dynamically
- Calling methods at runtime using reflection
- Understanding performance implications and limitations
- Using generics as a modern alternative to reflection
- Basics of the `unsafe` package for low-level memory access

## Prerequisites

- Go 1.20 or later installed
- Understanding of interfaces and type assertions
- Familiarity with struct tags

---

## Fundamentals of reflect

The `reflect` package provides two core types: `Type` and `Value`.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "reflect"
    )

    func inspectValue(v interface{}) {
        val := reflect.ValueOf(v)
        typ := val.Type()

        fmt.Printf("Type:  %s\n", typ)
        fmt.Printf("Kind:  %s\n", typ.Kind())
        fmt.Printf("Value: %v\n", val)

        if typ.Kind() == reflect.Ptr {
            fmt.Printf("Elem Type: %s\n", typ.Elem())
            fmt.Printf("Elem Kind: %s\n", typ.Elem().Kind())
        }
    }

    func main() {
        s := "Hello, Reflection"
        inspectValue(s)
        fmt.Println("---")

        n := 42
        inspectValue(n)
        fmt.Println("---")

        f := 3.14
        inspectValue(f)
        fmt.Println("---")

        b := true
        inspectValue(b)
    }
    ```

=== "The Explanation"

    - **reflect.ValueOf**: Creates a Value representing the passed interface
    - **reflect.TypeOf**: Returns the Type of the value
    - **Type.Kind**: The underlying kind (String, Int, Float64, Bool, etc.)
    - **reflect.Ptr**: Detects pointer types for nested inspection
    - **Elem**: Dereferences a pointer to get the underlying type

=== "The Terminal Output"

    ```
    Type:  string
    Kind:  string
    Value: Hello, Reflection
    ---
    Type:  int
    Kind:  int
    Value: 42
    ---
    Type:  float64
    Kind:  float64
    Value: 3.14
    ---
    Type:  bool
    Kind:  bool
    Value: true
    ```

## Inspecting Struct Fields

Read struct field names, types, tags, and values dynamically.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "reflect"
    )

    type User struct {
        ID       string `json:"id" validate:"required"`
        Name     string `json:"name" validate:"required,min=2,max=100"`
        Email    string `json:"email" validate:"required,email"`
        Age      int    `json:"age" validate:"required,min=18,max=150"`
        IsActive bool   `json:"is_active"`
    }

    func inspectStruct(v interface{}) {
        val := reflect.ValueOf(v)
        typ := val.Type()

        if typ.Kind() == reflect.Ptr {
            typ = typ.Elem()
            val = val.Elem()
        }

        fmt.Printf("Struct: %s (%d fields)\n", typ.Name(), typ.NumField())

        for i := 0; i < typ.NumField(); i++ {
            field := typ.Field(i)
            value := val.Field(i)

            fmt.Printf("\n  Field: %s\n", field.Name)
            fmt.Printf("  Type:  %s\n", field.Type)
            fmt.Printf("  JSON:  %s\n", field.Tag.Get("json"))
            fmt.Printf("  Validation: %s\n", field.Tag.Get("validate"))
            fmt.Printf("  Value: %v\n", value.Interface())
            fmt.Printf("  Exported: %t\n", field.IsExported())
        }
    }

    func main() {
        user := User{
            ID:       "usr_123",
            Name:     "Alice",
            Email:    "alice@example.com",
            Age:      30,
            IsActive: true,
        }

        inspectStruct(&user)
    }
    ```

=== "The Explanation"

    - **typ.NumField**: Returns the number of fields in the struct
    - **Field.Tag.Get**: Reads specific struct tag values by key
    - **value.Interface**: Converts reflect.Value back to an interface
    - **IsExported**: Checks if the field starts with an uppercase letter

=== "The Terminal Output"

    ```
    Struct: User (5 fields)

      Field: ID
      Type:  string
      JSON:  id
      Validation: required
      Value: usr_123
      Exported: true

      Field: Name
      Type:  string
      JSON:  name
      Validation: required,min=2,max=100
      Value: Alice
      Exported: true

      Field: Email
      Type:  string
      JSON:  email
      Validation: required,email
      Value: alice@example.com
      Exported: true

      Field: Age
      Type:  int
      JSON:  age
      Validation: required,min=18,max=150
      Value: 30
      Exported: true

      Field: IsActive
      Type:  bool
      JSON:  is_active
      Validation:
      Value: true
      Exported: true
    ```

## Modifying Struct Fields

Set struct field values dynamically using reflection.

!!! danger "Pointer Required"

    You must pass a pointer to `reflect.ValueOf` when you want to modify values. Passing a value directly will cause a panic.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "reflect"
    )

    type Config struct {
        Host     string
        Port     int
        Debug    bool
        LogLevel string
    }

    func setField(obj interface{}, name string, value interface{}) error {
        val := reflect.ValueOf(obj)
        if val.Kind() != reflect.Ptr || val.Elem().Kind() != reflect.Struct {
            return fmt.Errorf("expected pointer to struct")
        }

        val = val.Elem()
        field := val.FieldByName(name)
        if !field.IsValid() {
            return fmt.Errorf("field %s not found", name)
        }
        if !field.CanSet() {
            return fmt.Errorf("field %s is not settable", name)
        }

        reflectVal := reflect.ValueOf(value)
        if field.Type() != reflectVal.Type() {
            return fmt.Errorf("type mismatch: expected %s, got %s",
                field.Type(), reflectVal.Type())
        }

        field.Set(reflectVal)
        return nil
    }

    func main() {
        cfg := Config{
            Host:     "localhost",
            Port:     8080,
            Debug:    false,
            LogLevel: "info",
        }

        fmt.Printf("Before: %+v\n", cfg)

        setField(&cfg, "Host", "0.0.0.0")
        setField(&cfg, "Port", 9090)
        setField(&cfg, "Debug", true)
        setField(&cfg, "LogLevel", "debug")

        fmt.Printf("After:  %+v\n", cfg)
    }
    ```

=== "The Explanation"

    - **val.Kind() != reflect.Ptr**: Ensures we have a pointer
    - **val.Elem()**: Dereferences the pointer to access the struct
    - **FieldByName**: Finds a field by its name (case-sensitive)
    - **CanSet**: Returns false for unexported fields or non-addressable values
    - **field.Set**: Assigns a new value to the field

=== "The Terminal Output"

    ```
    Before: {Host:localhost Port:8080 Debug:false LogLevel:info}
    After:  {Host:0.0.0.0 Port:9090 Debug:true LogLevel:debug}
    ```

## Dynamic Method Calls

Invoke methods on values at runtime using reflection.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "reflect"
    )

    type Greeter struct {
        Name string
    }

    func (g Greeter) Greet() string {
        return fmt.Sprintf("Hello, %s!", g.Name)
    }

    func (g Greeter) GreetInLanguage(lang string) string {
        greetings := map[string]string{
            "en": "Hello",
            "de": "Hallo",
            "es": "Hola",
            "fr": "Bonjour",
        }
        greeting, ok := greetings[lang]
        if !ok {
            greeting = "Hello"
        }
        return fmt.Sprintf("%s, %s!", greeting, g.Name)
    }

    func callMethod(obj interface{}, methodName string, args ...interface{}) ([]reflect.Value, error) {
        val := reflect.ValueOf(obj)
        method := val.MethodByName(methodName)
        if !method.IsValid() {
            return nil, fmt.Errorf("method %s not found", methodName)
        }

        reflectArgs := make([]reflect.Value, len(args))
        for i, arg := range args {
            reflectArgs[i] = reflect.ValueOf(arg)
        }

        results := method.Call(reflectArgs)
        return results, nil
    }

    func main() {
        g := Greeter{Name: "Alice"}

        results, err := callMethod(g, "Greet")
        if err != nil {
            panic(err)
        }
        fmt.Println(results[0].String())

        results, err = callMethod(g, "GreetInLanguage", "de")
        if err != nil {
            panic(err)
        }
        fmt.Println(results[0].String())

        results, err = callMethod(g, "GreetInLanguage", "es")
        if err != nil {
            panic(err)
        }
        fmt.Println(results[0].String())
    }
    ```

=== "The Explanation"

    - **MethodByName**: Looks up a method by name on the value
    - **method.Call**: Invokes the method with the provided arguments
    - **reflect.ValueOf**: Converts each argument to a reflect.Value
    - **results[0].String()**: Extracts the first return value as a string

=== "The Terminal Output"

    ```
    Hello, Alice!
    Hallo, Alice!
    Hola, Alice!
    ```

## Type Switches vs Reflection

Prefer type switches over reflection when possible.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "reflect"
    )

    func describeWithSwitch(v interface{}) string {
        switch val := v.(type) {
        case string:
            return fmt.Sprintf("string: %q (len=%d)", val, len(val))
        case int:
            return fmt.Sprintf("int: %d", val)
        case float64:
            return fmt.Sprintf("float64: %.2f", val)
        case bool:
            return fmt.Sprintf("bool: %t", val)
        case []string:
            return fmt.Sprintf("[]string: %v (len=%d)", val, len(val))
        default:
            return fmt.Sprintf("unknown type: %T", val)
        }
    }

    func describeWithReflection(v interface{}) string {
        val := reflect.ValueOf(v)
        typ := val.Type()

        switch typ.Kind() {
        case reflect.String:
            return fmt.Sprintf("string: %q (len=%d)", val.String(), val.Len())
        case reflect.Int, reflect.Int64:
            return fmt.Sprintf("int: %d", val.Int())
        case reflect.Float64:
            return fmt.Sprintf("float64: %.2f", val.Float())
        case reflect.Bool:
            return fmt.Sprintf("bool: %t", val.Bool())
        case reflect.Slice:
            return fmt.Sprintf("%s: %v (len=%d)", typ, val, val.Len())
        default:
            return fmt.Sprintf("unknown kind: %s", typ.Kind())
        }
    }

    func main() {
        values := []interface{}{
            "hello",
            42,
            3.14,
            true,
            []string{"a", "b", "c"},
        }

        for _, v := range values {
            fmt.Printf("Type switch: %s\n", describeWithSwitch(v))
            fmt.Printf("Reflection:  %s\n", describeWithReflection(v))
            fmt.Println()
        }
    }
    ```

=== "The Explanation"

    - **Type switch**: Compile-time safe, faster, preferred for known types
    - **Reflection**: Runtime flexible, slower, needed for dynamic type discovery
    - **reflect.Kind**: The underlying type category (not the specific type)
    - **Performance**: Type switches are ~10x faster than reflection

=== "The Terminal Output"

    ```
    Type switch: string: "hello" (len=5)
    Reflection:  string: "hello" (len=5)

    Type switch: int: 42
    Reflection:  int: 42

    Type switch: float64: 3.14
    Reflection:  float64: 3.14

    Type switch: bool: true
    Reflection:  bool: true

    Type switch: []string: [a b c] (len=3)
    Reflection:  []string: [a b c] (len=3)
    ```

## Generics as a Modern Alternative

Go 1.18+ generics provide type-safe alternatives to many reflection use cases.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "reflect"
    )

    type Number interface {
        int | int32 | int64 | float32 | float64
    }

    func sumGeneric[T Number](numbers []T) T {
        var total T
        for _, n := range numbers {
            total += n
        }
        return total
    }

    func sumReflection(numbers interface{}) (interface{}, error) {
        val := reflect.ValueOf(numbers)
        if val.Kind() != reflect.Slice {
            return nil, fmt.Errorf("expected slice, got %s", val.Kind())
        }

        total := reflect.Zero(val.Type().Elem())
        for i := 0; i < val.Len(); i++ {
            item := val.Index(i)
            switch total.Kind() {
            case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
                total = reflect.ValueOf(total.Int() + item.Int()).Convert(total.Type())
            case reflect.Float32, reflect.Float64:
                total = reflect.ValueOf(total.Float() + item.Float()).Convert(total.Type())
            default:
                return nil, fmt.Errorf("unsupported element type: %s", total.Kind())
            }
        }

        return total.Interface(), nil
    }

    func main() {
        ints := []int{1, 2, 3, 4, 5}
        floats := []float64{1.1, 2.2, 3.3}

        fmt.Printf("Generic sum (ints): %d\n", sumGeneric(ints))
        fmt.Printf("Generic sum (floats): %.1f\n", sumGeneric(floats))

        result, err := sumReflection(ints)
        if err != nil {
            panic(err)
        }
        fmt.Printf("Reflection sum: %v\n", result)
    }
    ```

=== "The Explanation"

    - **Number constraint**: A type set that limits generic parameter to numeric types
    - **sumGeneric**: Type-safe function that works with any numeric slice
    - **sumReflection**: Runtime-flexible but slower and less safe
    - **reflect.Zero**: Creates a zero value of the element type
    - **val.Add**: Dynamically adds values using reflection

=== "The Terminal Output"

    ```
    Generic sum (ints): 15
    Generic sum (floats): 6.6
    Reflection sum: 15
    ```

## Performance Comparison

Reflection is significantly slower than direct access or generics.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "reflect"
        "testing"
    )

    type Data struct {
        ID    int
        Name  string
        Value float64
    }

    func BenchmarkDirectAccess(b *testing.B) {
        d := Data{ID: 1, Name: "test", Value: 3.14}
        var s string
        for i := 0; i < b.N; i++ {
            s = d.Name
        }
        _ = s
    }

    func BenchmarkReflection(b *testing.B) {
        d := Data{ID: 1, Name: "test", Value: 3.14}
        val := reflect.ValueOf(d)
        var s string
        for i := 0; i < b.N; i++ {
            s = val.FieldByName("Name").String()
        }
        _ = s
    }

    func main() {
        d := Data{ID: 1, Name: "test", Value: 3.14}
        val := reflect.ValueOf(d)

        fmt.Printf("Direct: %s\n", d.Name)
        fmt.Printf("Reflection: %s\n", val.FieldByName("Name").String())

        fmt.Println("\nPerformance impact:")
        fmt.Println("  Direct access: ~1 ns/op")
        fmt.Println("  Reflection: ~50-100 ns/op")
        fmt.Println("  Overhead: 50-100x slower")
    }
    ```

=== "The Terminal Output"

    ```
    Direct: test
    Reflection: test

    Performance impact:
      Direct access: ~1 ns/op
      Reflection: ~50-100 ns/op
      Overhead: 50-100x slower
    ```

## The unsafe Package

!!! danger "unsafe.Pointer"

    The `unsafe` package bypasses Go's type safety. Use only when absolutely necessary and with extreme caution.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "unsafe"
    )

    type Example struct {
        A bool
        B int64
        C string
    }

    func main() {
        var e Example

        fmt.Println("Size:", unsafe.Sizeof(e))
        fmt.Println("Alignment:", unsafe.Alignof(e))

        fmt.Println("Field A offset:", unsafe.Offsetof(e.A))
        fmt.Println("Field B offset:", unsafe.Offsetof(e.B))
        fmt.Println("Field C offset:", unsafe.Offsetof(e.C))

        fmt.Println("Field A size:", unsafe.Sizeof(e.A))
        fmt.Println("Field B size:", unsafe.Sizeof(e.B))
        fmt.Println("Field C size:", unsafe.Sizeof(e.C))
    }
    ```

=== "The Explanation"

    - **unsafe.Sizeof**: Returns the size in bytes of the type
    - **unsafe.Alignof**: Returns the alignment requirement
    - **unsafe.Offsetof**: Returns the byte offset of a struct field
    - **Memory layout**: Understanding offsets helps with serialization

=== "The Terminal Output"

    ```
    Size: 40
    Alignment: 8
    Field A offset: 0
    Field B offset: 8
    Field C offset: 24
    Field A size: 1
    Field B size: 8
    Field C size: 16
    ```

## When to Use Reflection

| Use Case | Use Reflection? | Alternative |
|----------|----------------|-------------|
| JSON serialization | No | `encoding/json` handles this |
| ORM field mapping | Sometimes | Struct tags + code generation |
| Validation | No | `go-playground/validator` |
| Dependency injection | Sometimes | Wire, fx, or manual DI |
| Dynamic method calls | Sometimes | Interfaces with type assertions |
| Generic algorithms | No | Go generics |
| Protocol Buffers | No | `protoc` code generation |

## Best Practices

| Practice | Recommendation |
|----------|----------------|
| Avoid reflection when possible | Use type switches, interfaces, or generics first |
| Cache reflected values | Store `reflect.Type` and `reflect.Value` for repeated use |
| Validate at startup | Fail fast on type errors rather than at runtime |
| Document reflection use | Explain why reflection is necessary in comments |
| Benchmark regularly | Measure performance impact of reflection |
| Use generics over reflection | Prefer generic functions for type-safe algorithms |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Panic: reflect.Value.Set using unaddressable value | Pass a pointer to `reflect.ValueOf` |
| Panic: method not found | Check method name spelling and receiver type |
| Wrong type in Set | Ensure the value type matches the field type |
| Performance degradation | Profile with `go test -bench` and optimize hot paths |

## Summary

- `reflect.TypeOf` and `reflect.ValueOf` inspect types and values at runtime
- Struct field inspection reads tags, names, and values dynamically
- Dynamic method calls invoke methods by name at runtime
- Reflection is 50-100x slower than direct access
- Go generics provide type-safe alternatives for many use cases
- `unsafe` package enables low-level memory manipulation

## Next Steps

- [Unsafe & CGo](./unsafe-cgo.md) — Explore low-level memory and C interop
- [Code Generation](./code-generation.md) — Generate code instead of reflecting at runtime
- [Performance Profiling](../production/performance.md) — Measure reflection overhead
