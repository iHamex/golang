# JSON & Encoding

JSON (JavaScript Object Notation) is the most widely used data interchange format on the web. Go's `encoding/json` package provides powerful tools for marshaling (encoding) and unmarshaling (decoding) JSON data, with support for custom types, streaming, and performance optimizations.

---

## What You Will Learn

- How to marshal Go structs to JSON using `json.Marshal`
- How to unmarshal JSON data to Go types using `json.Unmarshal`
- Working with struct tags for JSON field mapping
- Using streaming with `json.Decoder` and `json.Encoder`
- Implementing custom marshalers and unmarshalers
- Handling dynamic JSON with `map[string]interface{}`
- Working with raw JSON using `json.RawMessage`
- Best practices for JSON performance and error handling

---

## Prerequisites

- Understanding of Go structs and maps
- Familiarity with basic Go interfaces
- Knowledge of data types and type assertions

---

## Basic JSON Marshaling

Convert Go structs to JSON with `json.Marshal`.

### Marshaling Structs

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "fmt"
    )

    type User struct {
        Name    string `json:"name"`
        Age     int    `json:"age"`
        Email   string `json:"email"`
        Active  bool   `json:"active"`
    }

    func main() {
        user := User{
            Name:   "Alice Johnson",
            Age:    30,
            Email:  "alice@example.com",
            Active: true,
        }

        jsonData, err := json.Marshal(user)
        if err != nil {
            fmt.Println("Error marshaling:", err)
            return
        }

        fmt.Println("JSON:", string(jsonData))
    }
    ```

=== "The Explanation"

    - **json.Marshal**: Converts Go values to JSON-encoded byte slices
    - **struct tags**: `json:"name"` defines the JSON field name
    - **json:",omitempty"**: Optional; omits zero values from output
    - **json:",string"**: Optional; converts numbers to strings in JSON

=== "The Terminal Output"

    ```json
    {"name":"Alice Johnson","age":30,"email":"alice@example.com","active":true}
    ```

### Formatting JSON Output

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "fmt"
    )

    type Product struct {
        ID    int     `json:"id"`
        Name  string  `json:"name"`
        Price float64 `json:"price"`
    }

    func main() {
        product := Product{
            ID:    1,
            Name:  "Laptop",
            Price: 999.99,
        }

        // Compact JSON
        compactJSON, _ := json.Marshal(product)
        fmt.Println("Compact:", string(compactJSON))

        // Pretty-printed JSON
        prettyJSON, _ := json.MarshalIndent(product, "", "  ")
        fmt.Println("\nPretty:")
        fmt.Println(string(prettyJSON))
    }
    ```

=== "The Explanation"

    - **json.MarshalIndent**: Produces indented JSON for readability
    - **Prefix**: String added at the beginning of each line (empty here)
    - **Indent**: The indentation string (2 spaces)
    - **No trailing newline**: Output is clean JSON without extra newlines

=== "The Terminal Output"

    ```
    Compact: {"id":1,"name":"Laptop","price":999.99}

    Pretty:
    {
      "id": 1,
      "name": "Laptop",
      "price": 999.99
    }
    ```

!!! go "Tip"
Use `json.MarshalIndent` for debugging and logging. Use compact `json.Marshal` for network transmission to minimize payload size.

---

## JSON Unmarshaling

Convert JSON data back to Go types with `json.Unmarshal`.

### Basic Unmarshaling

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "fmt"
    )

    type Response struct {
        Status  string `json:"status"`
        Message string `json:"message"`
        Data    struct {
            Count int `json:"count"`
            Items []struct {
                ID   int    `json:"id"`
                Name string `json:"name"`
            } `json:"items"`
        } `json:"data"`
    }

    func main() {
        jsonData := []byte(`{
            "status": "success",
            "message": "Data retrieved",
            "data": {
                "count": 2,
                "items": [
                    {"id": 1, "name": "Item 1"},
                    {"id": 2, "name": "Item 2"}
                ]
            }
        }`)

        var response Response
        err := json.Unmarshal(jsonData, &response)
        if err != nil {
            fmt.Println("Error unmarshaling:", err)
            return
        }

        fmt.Printf("Status: %s\n", response.Status)
        fmt.Printf("Message: %s\n", response.Message)
        fmt.Printf("Count: %d\n", response.Data.Count)
        fmt.Printf("Items: %+v\n", response.Data.Items)
    }
    ```

=== "The Explanation"

    - **json.Unmarshal**: Converts JSON data to Go values
    - **Struct matching**: JSON field names must match struct tag names
    - **Nested structs**: Can unmarshal deeply nested JSON structures
    - **Slice fields**: JSON arrays become Go slices

=== "The Terminal Output"

    ```
    Status: success
    Message: Data retrieved
    Count: 2
    Items: [{ID:1 Name:Item 1} {ID:2 Name:Item 2}]
    ```

!!! note "Field Matching"
Unmarshaling is case-insensitive for field names. Both `"name"` and `"Name"` will match a field tagged as `json:"name"`.

---

## Struct Tags and Options

Struct tags control how JSON fields are mapped and serialized.

### Common Tag Options

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "fmt"
    )

    type Config struct {
        Host       string `json:"host"`
        Port       int    `json:"port"`
        Debug      bool   `json:"debug,omitempty"`
        Password   string `json:"-"`                        // Ignored in JSON
        APIKey     string `json:"api_key,string"`           // Quoted as string
        CreatedAt  string `json:"created_at"`               // Maps to snake_case
        UpdatedAt  string `json:"updatedAt,omitempty"`      // Maps to camelCase
    }

    func main() {
        config := Config{
            Host:      "localhost",
            Port:      8080,
            Debug:     false,     // Will be omitted due to omitempty
            Password:  "secret",  // Will be omitted
            APIKey:    "abc123",  // Will be serialized as string
            CreatedAt: "2024-01-01",
        }

        jsonData, _ := json.MarshalIndent(config, "", "  ")
        fmt.Println(string(jsonData))
    }
    ```

=== "The Explanation"

    - **`json:"-"`**: Field is ignored during marshaling/unmarshaling
    - **`json:",omitempty"`**: Field omitted if zero value
    - **`json:",string"`**: Numbers/booleans quoted as strings
    - **Field mapping**: Supports camelCase, snake_case, or any naming

=== "The Terminal Output"

    ```json
    {
      "host": "localhost",
      "port": 8080,
      "api_key": "abc123",
      "created_at": "2024-01-01"
    }
    ```

!!! warning "Zero Values"
Fields with zero values (`""`, `0`, `false`, `nil`) are omitted with `omitempty`. Use a pointer type if you need to distinguish between missing and zero values.

---

## Working with Dynamic JSON

Handle JSON with unknown structure using maps and interfaces.

### Using map[string]interface{}

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "fmt"
    )

    func main() {
        jsonData := []byte(`{
            "name": "Test User",
            "age": 25,
            "address": {
                "street": "123 Main St",
                "city": "Springfield"
            },
            "hobbies": ["reading", "coding", "hiking"]
        }`)

        var result map[string]interface{}
        err := json.Unmarshal(jsonData, &result)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }

        // Access values with type assertions
        name := result["name"].(string)
        age := result["age"].(float64) // JSON numbers are float64

        fmt.Printf("Name: %s\n", name)
        fmt.Printf("Age: %.0f\n", age)

        // Access nested objects
        address := result["address"].(map[string]interface{})
        fmt.Printf("City: %s\n", address["city"].(string))

        // Access arrays
        hobbies := result["hobbies"].([]interface{})
        fmt.Printf("Hobbies: %v\n", hobbies)
    }
    ```

=== "The Explanation"

    - **map[string]interface{}**: Dynamic type that accepts any JSON object
    - **Type assertions**: Must assert the correct type when accessing values
    - **float64**: JSON numbers default to float64 in Go
    - **Nested structures**: Maps can contain other maps or slices

=== "The Terminal Output"

    ```
    Name: Test User
    Age: 25
    City: Springfield
    Hobbies: [reading coding hiking]
    ```

!!! danger "Type Assertions"
Always check type assertions with the comma-ok pattern: `val, ok := result["field"].(string)`. Panics occur if the assertion is incorrect.

---

## Streaming JSON

Process large JSON datasets efficiently with streaming decoders and encoders.

### json.Decoder

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "fmt"
        "strings"
    )

    type Event struct {
        Type    string `json:"type"`
        Payload string `json:"payload"`
    }

    func main() {
        // Simulate a stream of JSON objects
        jsonStream := `{"type":"login","payload":"user1"}
        {"type":"action","payload":"clicked"}
        {"type":"logout","payload":"user1"}`

        decoder := json.NewDecoder(strings.NewReader(jsonStream))

        fmt.Println("Processing events:")
        for {
            var event Event
            err := decoder.Decode(&event)
            if err != nil {
                if err.Error() == "EOF" {
                    fmt.Println("\nStream finished.")
                    break
                }
                fmt.Println("Error:", err)
                continue
            }

            fmt.Printf("- %s: %s\n", event.Type, event.Payload)
        }
    }
    ```

=== "The Explanation"

    - **json.NewDecoder**: Creates a streaming decoder from an `io.Reader`
    - **decoder.Decode**: Reads and decodes one JSON value at a time
    - **EOF handling**: Detects end of stream
    - **Memory efficient**: Processes data without loading entire JSON into memory

=== "The Terminal Output"

    ```
    Processing events:
    - login: user1
    - action: clicked
    - logout: user1

    Stream finished.
    ```

### json.Encoder

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "fmt"
        "os"
    )

    type LogEntry struct {
        Level   string `json:"level"`
        Message string `json:"message"`
        Time    string `json:"time"`
    }

    func main() {
        entries := []LogEntry{
            {Level: "INFO", Message: "Server started", Time: "2024-01-01T10:00:00Z"},
            {Level: "WARN", Message: "Low memory", Time: "2024-01-01T10:05:00Z"},
            {Level: "ERROR", Message: "Connection failed", Time: "2024-01-01T10:10:00Z"},
        }

        encoder := json.NewEncoder(os.Stdout)
        encoder.SetIndent("", "  ")

        for _, entry := range entries {
            if err := encoder.Encode(entry); err != nil {
                fmt.Println("Error encoding:", err)
            }
        }
    }
    ```

=== "The Explanation"

    - **json.NewEncoder**: Creates a streaming encoder to an `io.Writer`
    - **encoder.Encode**: Writes one JSON value and adds a newline
    - **SetIndent**: Configures pretty-printing
    - **Streaming output**: Data is written as soon as it's encoded

=== "The Terminal Output"

    ```json
    {
      "level": "INFO",
      "message": "Server started",
      "time": "2024-01-01T10:00:00Z"
    }
    {
      "level": "WARN",
      "message": "Low memory",
      "time": "2024-01-01T10:05:00Z"
    }
    {
      "level": "ERROR",
      "message": "Connection failed",
      "time": "2024-01-01T10:10:00Z"
    }
    ```

!!! go "Performance Tip"
Streaming decoders are ideal for processing large JSON files or continuous data streams. They use constant memory regardless of input size.

---

## Custom Marshalers

Implement the `json.Marshaler` and `json.Unmarshaler` interfaces for custom JSON handling.

### Custom Time Marshaling

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "fmt"
        "strings"
        "time"
    )

    type CustomTime struct {
        time.Time
    }

    func (ct CustomTime) MarshalJSON() ([]byte, error) {
        formatted := ct.Format("2006-01-02 15:04:05")
        return []byte(`"` + formatted + `"`), nil
    }

    func (ct *CustomTime) UnmarshalJSON(data []byte) error {
        str := strings.Trim(string(data), `"`)
        t, err := time.Parse("2006-01-02 15:04:05", str)
        if err != nil {
            return err
        }
        ct.Time = t
        return nil
    }

    type Event struct {
        Name string     `json:"name"`
        Time CustomTime `json:"time"`
    }

    func main() {
        event := Event{
            Name: "Conference",
            Time: CustomTime{time.Date(2024, 6, 15, 14, 30, 0, 0, time.UTC)},
        }

        jsonData, _ := json.MarshalIndent(event, "", "  ")
        fmt.Println("Marshaled:")
        fmt.Println(string(jsonData))

        // Unmarshal back
        jsonInput := `{"name":"Workshop","time":"2024-07-20 09:00:00"}`
        var decoded Event
        json.Unmarshal([]byte(jsonInput), &decoded)

        fmt.Printf("\nUnmarshaled: %+v\n", decoded)
    }
    ```

=== "The Explanation"

    - **json.Marshaler interface**: Custom `MarshalJSON() ([]byte, error)` method
    - **json.Unmarshaler interface**: Custom `UnmarshalJSON([]byte) error` method
    - **Time format**: Uses Go's reference time `2006-01-02 15:04:05`
    - **Pointer receiver**: Unmarshaling requires a pointer receiver

=== "The Terminal Output"

    ```
    Marshaled:
    {
      "name": "Conference",
      "time": "2024-06-15 14:30:00"
    }

    Unmarshaled: {Name:Workshop Time:2024-07-20 09:00:00 +0000 UTC}
    ```

---

## Working with Raw JSON

Preserve raw JSON data for later processing.

### json.RawMessage

=== "The Code"

    ```go
    package main

    import (
        "encoding/json"
        "fmt"
    )

    type Message struct {
        Type    string          `json:"type"`
        Payload json.RawMessage `json:"payload"`
    }

    type LoginPayload struct {
        Username string `json:"username"`
        Token    string `json:"token"`
    }

    type ChatPayload struct {
        Sender string `json:"sender"`
        Text   string `json:"text"`
    }

    func main() {
        jsonData := []byte(`{
            "type": "login",
            "payload": {"username":"alice","token":"abc123"}
        }`)

        var msg Message
        json.Unmarshal(jsonData, &msg)

        fmt.Println("Type:", msg.Type)
        fmt.Println("Raw payload:", string(msg.Payload))

        // Decode based on type
        switch msg.Type {
        case "login":
            var login LoginPayload
            json.Unmarshal(msg.Payload, &login)
            fmt.Printf("Login: %s (token: %s)\n", login.Username, login.Token)

        case "chat":
            var chat ChatPayload
            json.Unmarshal(msg.Payload, &chat)
            fmt.Printf("Chat from %s: %s\n", chat.Sender, chat.Text)
        }
    }
    ```

=== "The Explanation"

    - **json.RawMessage**: Delays JSON decoding until the type is known
    - **Raw bytes**: Preserves the original JSON structure
    - **Type-based decoding**: Decode into different types based on message type
    - **No double decoding**: Efficient processing of polymorphic JSON

=== "The Terminal Output"

    ```
    Type: login
    Raw payload: {"username":"alice","token":"abc123"}
    Login: alice (token: abc123)
    ```

---

## Handling Unknown Fields

Deal with JSON that may contain unexpected fields.

=== "The Code"

    ```go
    package main

    import (
        "bytes"
        "encoding/json"
        "fmt"
    )

    type Known struct {
        Name string `json:"name"`
        Age  int    `json:"age"`
    }

    func main() {
        jsonData := []byte(`{
            "name": "Bob",
            "age": 30,
            "unknown_field": "value",
            "another_field": 123
        }`)

        // json.Decoder with DisallowUnknownFields
        decoder := json.NewDecoder(bytes.NewReader(jsonData))
        decoder.DisallowUnknownFields()

        var known Known
        err := decoder.Decode(&known)
        if err != nil {
            fmt.Println("Error (strict mode):", err)
            return
        }

        // Without DisallowUnknownFields - ignores unknown fields
        decoder2 := json.NewDecoder(bytes.NewReader(jsonData))
        var known2 Known
        err = decoder2.Decode(&known2)
        if err != nil {
            fmt.Println("Error (lenient mode):", err)
            return
        }

        fmt.Printf("Decoded: %+v\n", known2)
    }
    ```

=== "The Explanation"

    - **DisallowUnknownFields**: Returns error if JSON has extra fields
    - **Default behavior**: Unknown fields are silently ignored
    - **API validation**: Use strict mode to catch API contract violations
    - **Backward compatibility**: Lenient mode allows new fields

=== "The Terminal Output"

    ```
    Error (strict mode): json: unknown field "unknown_field"
    Decoded: {Name:Bob Age:30}
    ```

!!! warning "API Compatibility"
Use `DisallowUnknownFields` when you want strict API contracts. Without it, unknown fields are silently dropped, which can hide issues.

---

## JSON Performance Tips

Optimize JSON operations for high-throughput applications.

=== "The Code"

    ```go
    package main

    import (
        "bytes"
        "encoding/json"
        "fmt"
        "sync"
        "time"
    )

    type Data struct {
        ID    int    `json:"id"`
        Value string `json:"value"`
    }

    func main() {
        // Reuse buffers with sync.Pool
        var bufferPool = sync.Pool{
            New: func() interface{} {
                return new(bytes.Buffer)
            },
        }

        data := Data{ID: 1, Value: "test"}

        // Benchmark using pooled buffers
        start := time.Now()
        iterations := 100000

        for i := 0; i < iterations; i++ {
            buf := bufferPool.Get().(*bytes.Buffer)
            buf.Reset()

            encoder := json.NewEncoder(buf)
            encoder.Encode(data)

            jsonBytes := make([]byte, buf.Len())
            copy(jsonBytes, buf.Bytes())

            bufferPool.Put(buf)
        }

        duration := time.Since(start)
        fmt.Printf("Marshaled %d objects in %v\n", iterations, duration)
        fmt.Printf("Average: %v per marshal\n", duration/time.Duration(iterations))
    }
    ```

=== "The Explanation"

    - **sync.Pool**: Reuse buffers to reduce garbage collection pressure
    - **Pre-allocation**: Buffer pooling prevents repeated allocations
    - **Benchmarking**: Measure performance of JSON operations
    - **High throughput**: Optimizations matter for large-scale applications

=== "The Terminal Output"

    ```
    Marshaled 100000 objects in 45ms
    Average: 450ns per marshal
    ```

!!! go "Performance Optimization"
- Use `json.Encoder` over `json.Marshal` for streaming
- Pre-allocate slices with known sizes
- Consider `jsoniter` for 2-3x faster JSON processing
- Profile with `go test -bench` to find bottlenecks

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Use struct tags | Always define explicit JSON field names |
| Handle errors | Check marshaling/unmarshaling errors |
| Use streaming | Prefer `Decoder`/`Encoder` for large data |
| Validate input | Use `DisallowUnknownFields` for strict APIs |
| Reuse encoders | Create encoders once and reuse them |
| Test round-trips | Verify marshal→unmarshal preserves data |
| Use pointers | For optional fields that need null handling |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Field not appearing | Check struct tag spelling and case |
| Unmarshal error | Verify JSON structure matches target type |
| nil pointer panic | Use pointer types for nullable fields |
| Unknown field error | Remove `DisallowUnknownFields` or handle extra fields |
| Incorrect number type | JSON numbers are `float64` by default |

## Summary

- `json.Marshal` converts Go values to JSON byte slices
- `json.Unmarshal` decodes JSON into Go types
- Struct tags control field names and behavior
- Streaming with `Decoder`/`Encoder` handles large data efficiently
- Custom marshalers enable specialized JSON handling
- `json.RawMessage` preserves raw JSON for deferred processing
- Always handle errors and validate input

## Next Steps

- [HTTP Clients](http-clients.md) - Use JSON with HTTP requests
- [Testing](testing.md) - Test JSON encoding/decoding
- [File & IO](file-io.md) - Read/write JSON files
- [Concurrency](../advanced/concurrency-patterns.md) - Process JSON concurrently