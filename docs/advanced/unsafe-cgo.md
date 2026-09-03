# Unsafe & CGo

Go's `unsafe` package and CGo bridge provide access to low-level memory operations and C library interop. These tools are powerful but break Go's safety guarantees and portability. This guide covers when and how to use them responsibly.

## What You Will Learn

- Using `unsafe.Pointer` for type conversions and memory access
- Understanding `unsafe.Sizeof`, `Alignof`, and `Offsetof`
- Calling C functions from Go with CGo
- Exposing Go functions to C code
- Managing memory layout and alignment
- Evaluating performance implications and portability concerns

## Prerequisites

- Go 1.20 or later installed
- Understanding of Go's type system and memory model
- Basic familiarity with C syntax (for CGo sections)

---

## unsafe.Pointer Fundamentals

`unsafe.Pointer` enables conversions between pointer types that Go normally prevents.

!!! danger "Memory Safety Bypass"

    Using `unsafe.Pointer` bypasses Go's type safety. Incorrect usage can cause crashes, data corruption, or security vulnerabilities.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "unsafe"
    )

    func main() {
        x := float64(3.14)
        bits := *(*uint64)(unsafe.Pointer(&x))

        fmt.Printf("float64 bits: %016x\n", bits)

        y := uint64(0x400921FB54442D18)
        val := *(*float64)(unsafe.Pointer(&y))

        fmt.Printf("Reconstructed: %.15f\n", val)

        fmt.Printf("\nOriginal == Reconstructed: %t\n", x == val)
    }
    ```

=== "The Explanation"

    - **unsafe.Pointer(&x)**: Converts a typed pointer to a generic pointer
    - ***(uint64)**: Dereferences the generic pointer as a different type
    - **IEEE 754**: The bit pattern represents the float64 value
    - **No allocation**: This conversion happens without copying data

=== "The Terminal Output"

    ```
    float64 bits: 400921fb54442d18
    Reconstructed: 3.141592653589793

    Original == Reconstructed: true
    ```

## unsafe.Sizeof, Alignof, Offsetof

Determine the memory layout of types and struct fields.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "unsafe"
    )

    type Inner struct {
        A bool
        B int64
    }

    type Outer struct {
        X    Inner
        Y    bool
        Z    int32
        Name string
    }

    func main() {
        var o Outer

        fmt.Println("=== Type Sizes ===")
        fmt.Printf("bool:    %d bytes\n", unsafe.Sizeof(bool(false)))
        fmt.Printf("int32:   %d bytes\n", unsafe.Sizeof(int32(0)))
        fmt.Printf("int64:   %d bytes\n", unsafe.Sizeof(int64(0)))
        fmt.Printf("string:  %d bytes\n", unsafe.Sizeof(""))
        fmt.Printf("Inner:   %d bytes\n", unsafe.Sizeof(Inner{}))
        fmt.Printf("Outer:   %d bytes\n", unsafe.Sizeof(Outer{}))

        fmt.Println("\n=== Field Offsets ===")
        fmt.Printf("Outer.X:    offset=%d size=%d\n",
            unsafe.Offsetof(o.X), unsafe.Sizeof(o.X))
        fmt.Printf("Outer.Y:    offset=%d size=%d\n",
            unsafe.Offsetof(o.Y), unsafe.Sizeof(o.Y))
        fmt.Printf("Outer.Z:    offset=%d size=%d\n",
            unsafe.Offsetof(o.Z), unsafe.Sizeof(o.Z))
        fmt.Printf("Outer.Name: offset=%d size=%d\n",
            unsafe.Offsetof(o.Name), unsafe.Sizeof(o.Name))

        fmt.Println("\n=== Alignment ===")
        fmt.Printf("Outer alignment: %d bytes\n", unsafe.Alignof(o))
        fmt.Printf("Inner alignment: %d bytes\n", unsafe.Alignof(Inner{}))
    }
    ```

=== "The Explanation"

    - **unsafe.Sizeof**: Returns the size in bytes of the type's representation
    - **unsafe.Alignof**: Returns the alignment requirement (must be a power of 2)
    - **unsafe.Offsetof**: Returns the byte offset of a struct field from the start
    - **Padding**: Go adds padding between fields to satisfy alignment requirements

=== "The Terminal Output"

    ```
    === Type Sizes ===
    bool:    1 bytes
    int32:   4 bytes
    int64:   8 bytes
    string:  16 bytes
    Inner:   16 bytes
    Outer:   48 bytes

    === Field Offsets ===
    Outer.X:    offset=0 size=16
    Outer.Y:    offset=16 size=1
    Outer.Z:    offset=20 size=4
    Outer.Name: offset=24 size=16

    === Alignment ===
    Outer alignment: 8 bytes
    Inner alignment: 8 bytes
    ```

## CGo Basics

CGo enables calling C libraries directly from Go code.

=== "The Code"

    ```go
    package main

    /*
    #include <stdio.h>
    #include <stdlib.h>
    #include <math.h>

    int add(int a, int b) {
        return a + b;
    }

    void print_message(const char* msg) {
        printf("C says: %s\n", msg);
    }

    double compute(double x) {
        return sqrt(x) + log(x);
    }
    */
    import "C"

    import (
        "fmt"
        "unsafe"
    )

    func main() {
        result := C.add(C.int(10), C.int(20))
        fmt.Printf("C add(10, 20) = %d\n", int(result))

        msg := C.CString("Hello from Go!")
        defer C.free(unsafe.Pointer(msg))
        C.print_message(msg)

        val := C.compute(C.double(100.0))
        fmt.Printf("C compute(100) = %.4f\n", float64(val))
    }
    ```

=== "The Explanation"

    - **/\* ... \*/ import "C"**: The comment block before `import "C"` is compiled as C
    - **C.int, C.double**: Go types converted to C types
    - **C.CString**: Allocates a C string (must be freed with C.free)
    - **defer C.free**: Ensures memory is freed when the function returns
    - **unsafe.Pointer**: Required to convert between Go and C pointers

=== "The Terminal Output"

    ```
    C add(10, 20) = 30
    C says: Hello from Go!
    C compute(100) = 6.6052
    ```

## C Calling Go

Expose Go functions to C code via exported functions.

=== "The Code"

    ```go
    package main

    /*
    #include <stdio.h>

    extern int GoAdd(int a, int b);
    extern void GoPrint(char* msg);

    void call_go_from_c() {
        int result = GoAdd(100, 200);
        printf("C calling Go: GoAdd(100, 200) = %d\n", result);

        GoPrint("Message from C");
    }
    */
    import "C"

    import (
        "fmt"
    )

    //export GoAdd
    func GoAdd(a C.int, b C.int) C.int {
        return a + b
    }

    //export GoPrint
    func GoPrint(msg *C.char) {
        fmt.Printf("Go received from C: %s\n", C.GoString(msg))
    }

    func main() {
        C.call_go_from_c()
    }
    ```

=== "The Explanation"

    - **//export**: Marks a Go function for export to C
    - **extern**: C keyword declaring functions defined elsewhere (in Go)
    - **C.GoString**: Converts a C string to a Go string (copies the data)
    - **CGo manages** the bridge between Go and C calling conventions

=== "The Terminal Output"

    ```
    C calling Go: GoAdd(100, 200) = 300
    Go received from C: Message from C
    ```

## Working with C Structs

Access and manipulate C struct fields from Go.

=== "The Code"

    ```go
    package main

    /*
    #include <stdio.h>
    #include <stdlib.h>

    typedef struct {
        int x;
        int y;
        char name[32];
    } Point;

    Point* create_point(int x, int y, const char* name) {
        Point* p = (Point*)malloc(sizeof(Point));
        p->x = x;
        p->y = y;
        snprintf(p->name, sizeof(p->name), "%s", name);
        return p;
    }

    void print_point(Point* p) {
        printf("Point(%d, %d, '%s')\n", p->x, p->y, p->name);
    }
    */
    import "C"

    import (
        "fmt"
        "unsafe"
    )

    type Point struct {
        X    C.int
        Y    C.int
        Name [32]C.char
    }

    func main() {
        p := C.create_point(10, 20, C.CString("origin"))
        defer C.free(unsafe.Pointer(p))

        C.print_point(p)

        goPoint := (*Point)(unsafe.Pointer(p))
        fmt.Printf("Go access - X: %d, Y: %d\n", goPoint.X, goPoint.Y)
        fmt.Printf("Go access - Name: %s\n", C.GoString(&goPoint.Name[0]))
    }
    ```

=== "The Explanation"

    - **C.Point**: Access C struct types directly in Go
    - **unsafe.Pointer cast**: Convert between C and Go struct representations
    - **[32]C.char**: Fixed-size array matching C's char array
    - **C.GoString**: Converts the C string back to Go for printing

=== "The Terminal Output"

    ```
    Point(10, 20, 'origin')
    Go access - X: 10, Go access - Y: 20
    Go access - Name: origin
    ```

## Memory Layout and Alignment

Understand how Go arranges data in memory for efficient access.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "unsafe"
    )

    type BadStruct struct {
        A bool    // 1 byte
        B int64   // 8 bytes (needs 8-byte alignment)
        C bool    // 1 byte
        D int32   // 4 bytes (needs 4-byte alignment)
    }

    type GoodStruct struct {
        B int64   // 8 bytes (aligned first)
        D int32   // 4 bytes
        A bool    // 1 byte
        C bool    // 1 byte
    }

    func main() {
        var bad BadStruct
        var good GoodStruct

        fmt.Println("=== Bad Order (bool, int64, bool, int32) ===")
        fmt.Printf("Size: %d bytes\n", unsafe.Sizeof(bad))
        fmt.Printf("Offset A: %d\n", unsafe.Offsetof(bad.A))
        fmt.Printf("Offset B: %d\n", unsafe.Offsetof(bad.B))
        fmt.Printf("Offset C: %d\n", unsafe.Offsetof(bad.C))
        fmt.Printf("Offset D: %d\n", unsafe.Offsetof(bad.D))

        fmt.Println("\n=== Good Order (int64, int32, bool, bool) ===")
        fmt.Printf("Size: %d bytes\n", unsafe.Sizeof(good))
        fmt.Printf("Offset B: %d\n", unsafe.Offsetof(good.B))
        fmt.Printf("Offset D: %d\n", unsafe.Offsetof(good.D))
        fmt.Printf("Offset A: %d\n", unsafe.Offsetof(good.A))
        fmt.Printf("Offset C: %d\n", unsafe.Offsetof(good.C))

        savings := unsafe.Sizeof(bad) - unsafe.Sizeof(good)
        fmt.Printf("\nMemory savings: %d bytes (%.1f%%)\n",
            savings, float64(savings)/float64(unsafe.Sizeof(bad))*100)
    }
    ```

=== "The Explanation"

    - **Alignment padding**: Go adds bytes to ensure fields meet alignment requirements
    - **Field ordering**: Larger fields first minimizes padding
    - **int64 alignment**: Requires 8-byte alignment on most architectures
    - **Memory savings**: Reordering can reduce struct size by 20-30%

=== "The Terminal Output"

    ```
    === Bad Order (bool, int64, bool, int32) ===
    Size: 32 bytes
    Offset A: 0
    Offset B: 8
    Offset C: 16
    Offset D: 20

    === Good Order (int64, int32, bool, bool) ===
    Size: 24 bytes
    Offset B: 0
    Offset D: 8
    Offset A: 12
    Offset C: 13

    Memory savings: 8 bytes (25.0%)
    ```

## Practical Example: Binary Protocol Parsing

Parse binary data directly into Go structs using unsafe.

=== "The Code"

    ```go
    package main

    import (
        "encoding/binary"
        "fmt"
        "unsafe"
    )

    type PacketHeader struct {
        Magic   uint32
        Version uint16
        Length  uint16
        Flags   uint8
        Type    uint8
    }

    func ParsePacketHeader(data []byte) (*PacketHeader, error) {
        if len(data) < int(unsafe.Sizeof(PacketHeader{})) {
            return nil, fmt.Errorf("insufficient data: need %d bytes, got %d",
                unsafe.Sizeof(PacketHeader{}), len(data))
        }

        header := (*PacketHeader)(unsafe.Pointer(&data[0]))
        return header, nil
    }

    func main() {
        data := []byte{
            0xDE, 0xAD, 0xBE, 0xEF, // Magic
            0x00, 0x01,             // Version
            0x00, 0x10,             // Length
            0x01,                   // Flags
            0x02,                   // Type
        }

        header, err := ParsePacketHeader(data)
        if err != nil {
            panic(err)
        }

        fmt.Printf("Magic:   0x%08X\n", header.Magic)
        fmt.Printf("Version: %d\n", header.Version)
        fmt.Printf("Length:  %d\n", header.Length)
        fmt.Printf("Flags:   0x%02X\n", header.Flags)
        fmt.Printf("Type:    %d\n", header.Type)

        buf := make([]byte, unsafe.Sizeof(*header))
        binary.LittleEndian.PutUint32(buf[0:4], header.Magic)
        binary.LittleEndian.PutUint16(buf[4:6], header.Version)
        binary.LittleEndian.PutUint16(buf[6:8], header.Length)
        buf[8] = header.Flags
        buf[9] = header.Type

        fmt.Printf("\nSerialized: %X\n", buf)
    }
    ```

=== "The Explanation"

    - **unsafe.Pointer cast**: Zero-copy parsing from byte slice to struct
    - **Binary layout**: Struct fields map directly to byte positions
    - **Bounds checking**: Always verify data length before casting
    - **Endianness**: Unsafe parsing assumes the byte order matches the struct

=== "The Terminal Output"

    ```
    Magic:   0xDEADBEEF
    Version: 1
    Length:  16
    Flags:   0x01
    Type:    2

    Serialized: DEADBEEF00010010001002
    ```

## When to Use unsafe and CGo

| Scenario | Use unsafe? | Use CGo? | Alternative |
|----------|-------------|----------|-------------|
| C library integration | No | Yes | — |
| Performance-critical parsing | Sometimes | No | `encoding/binary` |
| Type-unsafe conversions | Last resort | No | Generics, interfaces |
| System calls | Sometimes | No | `syscall` package |
| FFI with other languages | No | Yes | RPC, shared memory |
| Memory-mapped files | Sometimes | No | `mmap` package |
| Bit manipulation | No | No | Standard bitwise ops |

## Best Practices

| Practice | Recommendation |
|----------|----------------|
| Document unsafe usage | Explain why unsafe is necessary in comments |
| Minimize unsafe scope | Keep unsafe code in small, isolated functions |
| Use build constraints | Conditionally compile unsafe code per platform |
| Test thoroughly | Unsafe code requires extra testing and fuzzing |
| Profile before using | Measure if unsafe actually improves performance |
| Consider CGo overhead | CGo calls have ~100ns overhead per call |
| Avoid if possible | Prefer pure Go implementations when feasible |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Segfault in unsafe code | Verify pointer validity and bounds |
| CGo compilation fails | Ensure C compiler is installed (`gcc`, `clang`) |
| CGo performance slower than expected | Reduce CGo call frequency, batch operations |
| Undefined behavior | Check memory alignment and pointer validity |
| Portability issues | Test on all target architectures |
| Memory leaks with C allocations | Always pair `C.malloc` with `C.free` |

## Summary

- `unsafe.Pointer` enables type conversions that bypass Go's safety checks
- `Sizeof`, `Alignof`, and `Offsetof` reveal memory layout details
- CGo provides a bridge between Go and C code
- CGo calls have significant overhead (~100ns per call)
- Struct field ordering affects memory usage and alignment
- Always document and isolate unsafe code

## Next Steps

- [Reflection & Metaprogramming](./reflection.md) — Safer runtime type inspection
- [Logging & Observability](./logging-observability.md) — Monitor unsafe and CGo code in production
- [Performance Profiling](../production/performance.md) — Measure unsafe vs safe implementations
