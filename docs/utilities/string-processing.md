# String Processing

Go's `strings` package provides efficient string manipulation functions, while `bytes` and `unicode/utf8` packages handle low-level operations and UTF-8 encoding. Understanding string processing is essential for building performant Go applications.

## What You Will Learn

- Build strings efficiently with `strings.Builder`
- Split and join strings with `strings.Split` and `strings.Join`
- Search within strings using `strings.Contains`, `HasPrefix`, and `HasSuffix`
- Replace substrings with `strings.Replace` and `strings.ReplaceAll`
- Trim whitespace with `strings.TrimSpace` and related functions
- Handle UTF-8 encoding with `unicode/utf8`
- Convert between `string` and `[]byte` efficiently
- Intern strings to reduce memory usage

## Prerequisites

- Basic Go syntax and data types
- Understanding of slices and arrays
- Familiarity with runes and Unicode concepts

---

## Building Strings with strings.Builder

The `strings.Builder` type provides an efficient way to build strings incrementally. It avoids the overhead of repeated string concatenation.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "strings"
    )

    func main() {
        var builder strings.Builder

        builder.WriteString("Hello")
        builder.WriteString(", ")
        builder.WriteString("World!")
        builder.WriteString("\n")
        builder.WriteString("Go is awesome!")

        result := builder.String()
        fmt.Println(result)
    }
    ```

=== "The Explanation"

    - **strings.Builder**: An efficient builder that minimizes memory allocations
    - **WriteString**: Appends a string to the builder
    - **String**: Returns the accumulated string

=== "The Terminal Output"

    ```
    Hello, World!
    Go is awesome!
    ```

!!! go "strings.Builder Best Practice"
Always use `strings.Builder` when building strings in loops. Direct concatenation with `+` creates a new string each time, which is inefficient for many operations.

## Splitting and Joining Strings

The `strings.Split` function divides a string by a delimiter, while `strings.Join` combines slice elements with a separator.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "strings"
    )

    func main() {
        // Splitting a CSV line
        csvLine := "apple,banana,cherry,date"
        fruits := strings.Split(csvLine, ",")
        fmt.Println("Split result:", fruits)

        // Joining with different separators
        joined := strings.Join(fruits, " | ")
        fmt.Println("Joined:", joined)

        // Split with limit
        data := "key=value=extra"
        parts := strings.SplitN(data, "=", 2)
        fmt.Println("SplitN result:", parts)

        // Split after a delimiter
        path := "/home/user/documents/file.txt"
        segments := strings.SplitAfter(path, "/")
        fmt.Println("SplitAfter result:", segments)
    }
    ```

=== "The Explanation"

    - **strings.Split**: Splits a string into a slice based on a separator
    - **strings.Join**: Joins slice elements with a specified separator
    - **strings.SplitN**: Splits with a maximum number of substrings
    - **strings.SplitAfter**: Splits and keeps the separator in the result

=== "The Terminal Output"

    ```
    Split result: [apple banana cherry date]
    Joined: apple | banana | cherry | date
    SplitN result: [key=value extra]
    SplitAfter result: [/ home/ user/ documents/ file.txt]
    ```

!!! note "Performance Tip"
For simple splitting, `strings.SplitN` is more efficient than `strings.Split` when you only need a limited number of parts.

## Searching Within Strings

The `strings` package provides functions to check for substrings, prefixes, and suffixes.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "strings"
    )

    func main() {
        text := "The quick brown fox jumps over the lazy dog"

        // Contains
        fmt.Println("Contains 'fox':", strings.Contains(text, "fox"))
        fmt.Println("Contains 'cat':", strings.Contains(text, "cat"))

        // HasPrefix and HasSuffix
        fmt.Println("Starts with 'The':", strings.HasPrefix(text, "The"))
        fmt.Println("Ends with 'dog':", strings.HasSuffix(text, "dog"))

        // IndexOf
        fmt.Println("Index of 'fox':", strings.Index(text, "fox"))
        fmt.Println("Index of 'cat':", strings.Index(text, "cat"))

        // Count occurrences
        fmt.Println("Count of 'the' (case-insensitive):", strings.Count(strings.ToLower(text), "the"))

        // Repeat
        separator := strings.Repeat("-", 20)
        fmt.Println(separator)
    }
    ```

=== "The Explanation"

    - **strings.Contains**: Checks if a string contains a substring
    - **strings.HasPrefix**: Checks if a string starts with a prefix
    - **strings.HasSuffix**: Checks if a string ends with a suffix
    - **strings.Index**: Returns the index of the first occurrence (-1 if not found)
    - **strings.Count**: Counts non-overlapping occurrences
    - **strings.Repeat**: Repeats a string n times

=== "The Terminal Output"

    ```
    Contains 'fox': true
    Contains 'cat': false
    Starts with 'The': true
    Ends with 'dog': true
    Index of 'fox': 16
    Index of 'cat': -1
    Count of 'the' (case-insensitive): 2
    --------------------
    ```

## Replacing and Trimming Strings

The `strings` package provides functions for replacing substrings and trimming whitespace.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "strings"
    )

    func main() {
        // ReplaceAll
        greeting := "Hello, World!"
        newGreeting := strings.ReplaceAll(greeting, "World", "Go")
        fmt.Println("ReplaceAll:", newGreeting)

        // Replace with count
        text := "aaa bbb aaa ccc aaa"
        replaced := strings.Replace(text, "aaa", "xxx", 2)
        fmt.Println("Replace (count=2):", replaced)

        // TrimSpace
        padded := "   Hello, World!   "
        fmt.Printf("Before trim: [%s]\n", padded)
        fmt.Printf("After trim: [%s]\n", strings.TrimSpace(padded))

        // TrimLeft and TrimRight
        leftTrimmed := strings.TrimLeft(padded, " ")
        fmt.Printf("TrimLeft: [%s]\n", leftTrimmed)

        rightTrimmed := strings.TrimRight(padded, " ")
        fmt.Printf("TrimRight: [%s]\n", rightTrimmed)

        // Trim specific characters
        special := "***Hello***"
        fmt.Println("Trim:", strings.Trim(special, "*"))
    }
    ```

=== "The Explanation"

    - **strings.ReplaceAll**: Replaces all occurrences of a substring
    - **strings.Replace**: Replaces up to n occurrences (-1 for all)
    - **strings.TrimSpace**: Removes leading and trailing whitespace
    - **strings.TrimLeft**: Removes leading characters
    - **strings.TrimRight**: Removes trailing characters
    - **strings.Trim**: Removes leading and trailing specified characters

=== "The Terminal Output"

    ```
    ReplaceAll: Hello, Go!
    Replace (count=2): xxx bbb xxx ccc aaa
    Before trim: [   Hello, World!   ]
    After trim: [Hello, World!]
    TrimLeft: [Hello, World!   ]
    TrimRight: [   Hello, World!]
    Trim: Hello
    ```

## Case Conversion and Comparison

The `strings` package provides functions for case conversion and case-insensitive comparisons.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "strings"
    )

    func main() {
        text := "Hello, World!"

        // Case conversion
        fmt.Println("ToUpper:", strings.ToUpper(text))
        fmt.Println("ToLower:", strings.ToLower(text))
        fmt.Println("ToTitle:", strings.ToTitle(text))

        // Case-insensitive comparison
        str1 := "Hello"
        str2 := "hello"
        fmt.Printf("EqualFold(%q, %q): %v\n", str1, str2, strings.EqualFold(str1, str2))

        // Compare
        fmt.Printf("Compare(%q, %q): %d\n", str1, str2, strings.Compare(str1, str2))
    }
    ```

=== "The Explanation"

    - **strings.ToUpper**: Converts to uppercase
    - **strings.ToLower**: Converts to lowercase
    - **strings.ToTitle**: Converts to title case
    - **strings.EqualFold**: Case-insensitive comparison
    - **strings.Compare**: Lexicographic comparison (deprecated in favor of == for most cases)

=== "The Terminal Output"

    ```
    ToUpper: HELLO, WORLD!
    ToLower: hello, world!
    ToTitle: HELLO, WORLD!
    EqualFold("Hello", "hello"): true
    Compare("Hello", "hello"): 1
    ```

## Working with Unicode and UTF-8

The `unicode/utf8` package provides functions for working with UTF-8 encoded strings.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "strings"
        "unicode/utf8"
    )

    func main() {
        text := "Hello, 世界! 🌍"

        // Rune count vs byte count
        fmt.Printf("Byte count: %d\n", len(text))
        fmt.Printf("Rune count: %d\n", utf8.RuneCountInString(text))

        // Iterate over runes
        fmt.Print("Runes: ")
        for i, r := range text {
            fmt.Printf("[%d:%c]", i, r)
        }
        fmt.Println()

        // Validate UTF-8
        valid := utf8.ValidString(text)
        fmt.Println("Valid UTF-8:", valid)

        // Count runes
        emojiCount := strings.Count(text, "🌍")
        fmt.Println("Emoji count:", emojiCount)
    }
    ```

=== "The Explanation"

    - **utf8.RuneCountInString**: Counts the number of runes (Unicode code points)
    - **len**: Returns the byte count (not rune count for non-ASCII)
    - **range**: Iterates over runes with their byte positions
    - **utf8.ValidString**: Validates UTF-8 encoding

=== "The Terminal Output"

    ```
    Byte count: 16
    Rune count: 12
    Runes: [0:H][1:e][2:l][3:l][4:o][5:,][6: ][7:世][10:界][13:!][14: ][15:🌍]
    Valid UTF-8: true
    Emoji count: 1
    ```

!!! warning "Byte vs Rune Count"
Always use `utf8.RuneCountInString` instead of `len` when you need the number of characters. `len` returns the number of bytes, which can be misleading for non-ASCII text.

## String Interning

String interning stores a single copy of each unique string, reducing memory usage when the same strings are repeated many times.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
    )

    // Simple string interning implementation
    type StringInterner struct {
        pool map[string]string
    }

    func NewStringInterner() *StringInterner {
        return &StringInterner{
            pool: make(map[string]string),
        }
    }

    func (si *StringInterner) Intern(s string) string {
        if interned, ok := si.pool[s]; ok {
            return interned
        }
        si.pool[s] = s
        return s
    }

    func main() {
        interner := NewStringInterner()

        // Create duplicate strings
        str1 := "hello world"
        str2 := "hello world"
        str3 := string([]byte("hello world"))

        // Intern them
        interned1 := interner.Intern(str1)
        interned2 := interner.Intern(str2)
        interned3 := interner.Intern(str3)

        // Check if they're the same pointer
        fmt.Printf("str1 == str2: %v\n", str1 == str2)
        fmt.Printf("&interned1 == &interned2: %v\n", &interned1 == &interned2)
        fmt.Printf("&interned1 == &interned3: %v\n", &interned1 == &interned3)
    }
    ```

=== "The Explanation"

    - **StringInterner**: A simple interning implementation using a map
    - **Intern**: Returns the interned version of a string
    - **Memory savings**: Interned strings share the same underlying memory

=== "The Terminal Output"

    ```
    str1 == str2: true
    &interned1 == &interned2: true
    &interned1 == &interned3: true
    ```

## Best Practices

| Practice | Recommendation |
|----------|----------------|
| Build strings | Use `strings.Builder` for incremental construction |
| Split strings | Use `strings.SplitN` when you need limited parts |
| Case-insensitive search | Use `strings.EqualFold` instead of converting case |
| Count characters | Use `utf8.RuneCountInString` instead of `len` |
| Trim whitespace | Use `strings.TrimSpace` for leading/trailing spaces |
| Memory optimization | Use string interning for repeated strings |
| Check substrings | Use `strings.Contains` for simple checks |

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Wrong character count | Using `len` on non-ASCII | Use `utf8.RuneCountInString` |
| Unexpected split behavior | Missing limit parameter | Use `strings.SplitN` with limit |
| Memory growth | Not using Builder | Use `strings.Builder` for loops |
| Case mismatch | Direct comparison | Use `strings.EqualFold` |

## Summary

- `strings.Builder` provides efficient string construction
- `strings.Split` and `strings.Join` handle string manipulation
- `strings.Contains`, `HasPrefix`, `HasSuffix` for searching
- `strings.Replace` and `strings.TrimSpace` for modification
- `unicode/utf8` handles UTF-8 encoding correctly
- `string` and `[]byte` conversions are necessary for low-level operations
- String interning reduces memory usage for repeated strings

## Next Steps

- Learn about [Time & Dates](time-dates.md)
- Explore [Regular Expressions](regular-expressions.md)
- Understand [Context & Cancellation](context-cancellation.md)
- Discover [Hashing & Crypto](hashing-crypto.md)
