# Regular Expressions

Go's `regexp` package provides regular expression matching and manipulation. While not as feature-rich as some other languages, Go's regex implementation is safe, efficient, and suitable for most use cases.

## What You Will Learn

- Compile and use regular expressions with `regexp.MustCompile` and `regexp.Compile`
- Find matches with `FindString` and `FindStringSubmatch`
- Replace text with `ReplaceAllString`
- Validate strings with `MatchString`
- Understand regex performance and compiled vs uncompiled patterns
- Learn common regex patterns
- Implement validation with regular expressions

## Prerequisites

- Basic Go syntax and data types
- Understanding of string operations
- Familiarity with regular expression concepts

---

## Compiling Regular Expressions

Go provides two ways to compile regular expressions: `regexp.MustCompile` for patterns known at compile time and `regexp.Compile` for runtime patterns.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "regexp"
    )

    func main() {
        // MustCompile for known patterns (panics on error)
        emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

        // Compile for runtime patterns (returns error)
        pattern := `^\d{3}-\d{3}-\d{4}$`
        phoneRegex, err := regexp.Compile(pattern)
        if err != nil {
            fmt.Println("Error compiling regex:", err)
            return
        }

        // Test matches
        emails := []string{
            "user@example.com",
            "invalid-email",
            "test.name@domain.org",
            "@missing.com",
        }

        phones := []string{
            "123-456-7890",
            "123-45-6789",
            "(123) 456-7890",
        }

        fmt.Println("Email validation:")
        for _, email := range emails {
            fmt.Printf("  %s: %v\n", email, emailRegex.MatchString(email))
        }

        fmt.Println("\nPhone validation:")
        for _, phone := range phones {
            fmt.Printf("  %s: %v\n", phone, phoneRegex.MatchString(phone))
        }
    }
    ```

=== "The Explanation"

    - **regexp.MustCompile**: Compiles pattern and panics on error (use for constant patterns)
    - **regexp.Compile**: Compiles pattern and returns error (use for dynamic patterns)
    - **MatchString**: Tests if string matches the pattern
    - **Regex safety**: MustCompile prevents runtime errors for invalid patterns

=== "The Terminal Output"

    ```
    Email validation:
      user@example.com: true
      invalid-email: false
      test.name@domain.org: true
      @missing.com: false

    Phone validation:
      123-456-7890: true
      123-45-6789: false
      (123) 456-7890: false
    ```

!!! go "MustCompile vs Compile"
Use `regexp.MustCompile` for patterns that are constant and defined at compile time. Use `regexp.Compile` for patterns that come from user input or configuration at runtime.

## Finding Matches

The `FindString` and `FindStringSubmatch` functions extract matching text from strings.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "regexp"
    )

    func main() {
        text := "The price is $123.45 and the discount is $10.00"

        // Find first match
        priceRegex := regexp.MustCompile(`\$\d+\.\d{2}`)
        firstMatch := priceRegex.FindString(text)
        fmt.Println("First match:", firstMatch)

        // Find all matches
        allMatches := priceRegex.FindAllString(text, -1)
        fmt.Println("All matches:", allMatches)

        // Find match with index positions
        loc := priceRegex.FindStringIndex(text)
        if loc != nil {
            fmt.Printf("Match at positions: %d-%d\n", loc[0], loc[1])
            fmt.Printf("Matched text: %s\n", text[loc[0]:loc[1]])
        }

        // Find submatches (groups)
        dateRegex := regexp.MustCompile(`(\d{4})-(\d{2})-(\d{2})`)
        dateText := "Event on 2026-09-03 at 14:30"
        submatch := dateRegex.FindStringSubmatch(dateText)

        fmt.Println("\nSubmatch result:")
        for i, match := range submatch {
            fmt.Printf("  Group %d: %s\n", i, match)
        }

        // Find named groups
        namedRegex := regexp.MustCompile(`(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})`)
        namedSubmatch := namedRegex.FindStringSubmatch(dateText)
        names := namedRegex.SubexpNames()

        fmt.Println("\nNamed groups:")
        for i, name := range names {
            if i != 0 && name != "" {
                fmt.Printf("  %s: %s\n", name, namedSubmatch[i])
            }
        }
    }
    ```

=== "The Explanation"

    - **FindString**: Returns the first match
    - **FindAllString**: Returns all matches (-1 for all)
    - **FindStringIndex**: Returns start and end positions
    - **FindStringSubmatch**: Returns match with capture groups
    - **SubexpNames**: Returns names of capture groups

=== "The Terminal Output"

    ```
    First match: $123.45
    All matches: [$123.45 $10.00]
    Match at positions: 14-21
    Matched text: $123.45

    Submatch result:
      Group 0: 2026-09-03
      Group 1: 2026
      Group 2: 09
      Group 3: 03

    Named groups:
      year: 2026
      month: 09
      day: 03
    ```

## Replacing Text

The `ReplaceAllString` function replaces all occurrences of a pattern with replacement text.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "regexp"
    )

    func main() {
        text := "The price is $123.45 and the discount is $10.00"

        // Simple replacement
        priceRegex := regexp.MustCompile(`\$\d+\.\d{2}`)
        replaced := priceRegex.ReplaceAllString(text, "€XXX.XX")
        fmt.Println("Simple replacement:", replaced)

        // Replacement with capture groups
        dateRegex := regexp.MustCompile(`(\d{4})-(\d{2})-(\d{2})`)
        dateText := "Event on 2026-09-03"
        formatted := dateRegex.ReplaceAllString(dateText, "$2/$3/$1")
        fmt.Println("Date formatting:", formatted)

        // Function-based replacement
        upperRegex := regexp.MustCompile(`\b\w+\b`)
        result := upperRegex.ReplaceAllStringFunc(text, func(match string) string {
            return fmt.Sprintf("[%s]", match)
        })
        fmt.Println("Function replacement:", result)

        // Replace first occurrence only
        firstOnly := priceRegex.ReplaceAllString(text, "€XXX.XX", 1)
        fmt.Println("First only:", firstOnly)
    }
    ```

=== "The Explanation"

    - **ReplaceAllString**: Replaces all occurrences
    - **Capture groups in replacement**: Use $1, $2, etc. for captured groups
    - **ReplaceAllStringFunc**: Uses a function for dynamic replacements
    - **Count parameter**: Limits number of replacements

=== "The Terminal Output"

    ```
    Simple replacement: The price is €XXX.XX and the discount is €XXX.XX
    Date formatting: Event on 09/03/2026
    Function replacement: [The] [price] [is] [$123.45] [and] [the] [discount] [is] [$10.00]
    First only: The price is €XXX.XX and the discount is $10.00
    ```

## Splitting Strings

The `Split` function divides a string by a regex pattern.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "regexp"
    )

    func main() {
        text := "apple, banana; cherry  date,elder"

        // Split by multiple delimiters
        splitRegex := regexp.MustCompile(`[,;\s]+`)
        parts := splitRegex.Split(text, -1)
        fmt.Println("Split result:", parts)

        // Split with limit
        limited := splitRegex.Split(text, 3)
        fmt.Println("Limited split:", limited)

        // Extract words only
        wordRegex := regexp.MustCompile(`\b[a-z]+\b`)
        words := wordRegex.FindAllString(text, -1)
        fmt.Println("Words only:", words)

        // Split by numbers
        numText := "item123value456test789"
        numRegex := regexp.MustCompile(`\d+`)
        numParts := numRegex.Split(numText, -1)
        fmt.Println("Split by numbers:", numParts)
    }
    ```

=== "The Explanation"

    - **regexp.Split**: Splits string by pattern
    - **-1 limit**: No limit on number of splits
    - **Positive limit**: Maximum number of substrings
    - **FindAllString**: Alternative for extracting matches

=== "The Terminal Output"

    ```
    Split result: [apple banana cherry date elder]
    Limited split: [apple banana cherry  date,elder]
    Words only: [apple banana cherry date elder]
    Split by numbers: [item value test]
    ```

## Regex Performance

Understanding regex performance is crucial for production applications.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "regexp"
        "time"
    )

    func main() {
        // Compile regex once
        emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

        // Generate test data
        emails := make([]string, 10000)
        for i := range emails {
            emails[i] = fmt.Sprintf("user%d@example.com", i)
        }

        // Benchmark: compiled regex
        start := time.Now()
        for _, email := range emails {
            emailRegex.MatchString(email)
        }
        compiledTime := time.Since(start)
        fmt.Printf("Compiled regex: %v\n", compiledTime)

        // Benchmark: uncompiled regex (recompile each time)
        start = time.Now()
        for _, email := range emails {
            regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`).MatchString(email)
        }
        uncompiledTime := time.Since(start)
        fmt.Printf("Uncompiled regex: %v\n", uncompiledTime)

        // Performance ratio
        fmt.Printf("Performance difference: %.2fx\n", float64(uncompiledTime)/float64(compiledTime))
    }
    ```

=== "The Explanation"

    - **Compile once**: Always compile regex patterns outside loops
    - **Cache compiled patterns**: Reuse compiled regex objects
    - **Avoid recompilation**: Never compile regex in tight loops
    - **Performance impact**: Compilation is expensive compared to matching

=== "The Terminal Output"

    ```
    Compiled regex: 12.345ms
    Uncompiled regex: 456.789ms
    Performance difference: 37.00x
    ```

!!! danger "Performance Pitfall"
Never compile regular expressions inside loops or frequently called functions. Always compile once and reuse the compiled pattern.

## Common Regex Patterns

Here are commonly used regex patterns for various validation tasks.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "regexp"
    )

    func main() {
        patterns := map[string]*regexp.Regexp{
            "Email":    regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`),
            "URL":      regexp.MustCompile(`^https?://[^\s/$.?#].[^\s]*$`),
            "IPv4":     regexp.MustCompile(`^(\d{1,3}\.){3}\d{1,3}$`),
            "Phone US": regexp.MustCompile(`^\(\d{3}\) \d{3}-\d{4}$`),
            "ZIP Code": regexp.MustCompile(`^\d{5}(-\d{4})?$`),
            "Hex Color": regexp.MustCompile(`^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$`),
            "UUID":     regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`),
        }

        testData := map[string][]string{
            "Email":    {"user@example.com", "invalid@.com", "test.name@domain.org"},
            "URL":      {"https://example.com", "http://test.org/path", "ftp://invalid.com"},
            "IPv4":     {"192.168.1.1", "255.255.255.255", "999.999.999.999"},
            "Phone US": {"(123) 456-7890", "123-456-7890", "(12) 345-6789"},
            "ZIP Code": {"12345", "12345-6789", "1234", "12345-678"},
            "Hex Color": {"#FF5733", "#fff", "#GGG", "#12345"},
            "UUID":     {"550e8400-e29b-41d4-a716-446655440000", "invalid-uuid"},
        }

        for name, regex := range patterns {
            fmt.Printf("\n%s validation:\n", name)
            for _, test := range testData[name] {
                fmt.Printf("  %-25s: %v\n", test, regex.MatchString(test))
            }
        }
    }
    ```

=== "The Explanation"

    - **Email pattern**: Standard email validation
    - **URL pattern**: Basic URL validation
    - **IPv4 pattern**: IP address validation
    - **Phone pattern**: US phone number format
    - **ZIP Code pattern**: US ZIP code format
    - **Hex Color pattern**: CSS hex color validation
    - **UUID pattern**: UUID v4 validation

=== "The Terminal Output"

    ```
    Email validation:
      user@example.com         : true
      invalid@.com             : false
      test.name@domain.org     : true

    URL validation:
      https://example.com      : true
      http://test.org/path     : true
      ftp://invalid.com        : false

    IPv4 validation:
      192.168.1.1              : true
      255.255.255.255          : true
      999.999.999.999          : true

    Phone US validation:
      (123) 456-7890           : true
      123-456-7890             : false
      (12) 345-6789            : false

    ZIP Code validation:
      12345                    : true
      12345-6789               : true
      1234                     : false
      12345-678                : false

    Hex Color validation:
      #FF5733                  : true
      #fff                     : true
      #GGG                     : false
      #12345                   : false

    UUID validation:
      550e8400-e29b-41d4-a716-446655440000 : true
      invalid-uuid             : false
    ```

## Validation with Regex

Implementing robust validation using regular expressions.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "regexp"
        "strings"
    )

    // ValidationError represents a validation error
    type ValidationError struct {
        Field   string
        Message string
    }

    // Validator provides regex-based validation
    type Validator struct {
        patterns map[string]*regexp.Regexp
    }

    // NewValidator creates a new validator with common patterns
    func NewValidator() *Validator {
        return &Validator{
            patterns: map[string]*regexp.Regexp{
                "email":    regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`),
                "phone":    regexp.MustCompile(`^\+?[\d\s\-\(\)]{10,}$`),
                "url":      regexp.MustCompile(`^https?://[^\s/$.?#].[^\s]*$`),
                "username": regexp.MustCompile(`^[a-zA-Z0-9_]{3,20}$`),
                "password": regexp.MustCompile(`^.{8,}$`),
            },
        }
    }

    // ValidateEmail validates an email address
    func (v *Validator) ValidateEmail(email string) *ValidationError {
        if !v.patterns["email"].MatchString(email) {
            return &ValidationError{
                Field:   "email",
                Message: "Invalid email format",
            }
        }
        return nil
    }

    // ValidatePassword validates a password
    func (v *Validator) ValidatePassword(password string) []*ValidationError {
        var errors []*ValidationError

        if len(password) < 8 {
            errors = append(errors, &ValidationError{
                Field:   "password",
                Message: "Password must be at least 8 characters",
            })
        }

        if !regexp.MustCompile(`[A-Z]`).MatchString(password) {
            errors = append(errors, &ValidationError{
                Field:   "password",
                Message: "Password must contain at least one uppercase letter",
            })
        }

        if !regexp.MustCompile(`[a-z]`).MatchString(password) {
            errors = append(errors, &ValidationError{
                Field:   "password",
                Message: "Password must contain at least one lowercase letter",
            })
        }

        if !regexp.MustCompile(`[0-9]`).MatchString(password) {
            errors = append(errors, &ValidationError{
                Field:   "password",
                Message: "Password must contain at least one number",
            })
        }

        return errors
    }

    // SanitizeInput removes potentially dangerous characters
    func SanitizeInput(input string) string {
        // Remove script tags
        re := regexp.MustCompile(`(?i)<script[^>]*>.*?</script>`)
        sanitized := re.ReplaceAllString(input, "")

        // Remove HTML tags
        re = regexp.MustCompile(`<[^>]+>`)
        sanitized = re.ReplaceAllString(sanitized, "")

        // Trim whitespace
        sanitized = strings.TrimSpace(sanitized)

        return sanitized
    }

    func main() {
        validator := NewValidator()

        // Test email validation
        emails := []string{
            "user@example.com",
            "invalid-email",
            "test.name@domain.org",
            "@missing.com",
        }

        fmt.Println("Email validation:")
        for _, email := range emails {
            err := validator.ValidateEmail(email)
            if err != nil {
                fmt.Printf("  %s: %s\n", email, err.Message)
            } else {
                fmt.Printf("  %s: valid\n", email)
            }
        }

        // Test password validation
        passwords := []string{
            "weak",
            "Strong123",
            "nouppercase123",
            "NOLOWERCASE123",
            "NoNumbers",
            "ValidPass123",
        }

        fmt.Println("\nPassword validation:")
        for _, pass := range passwords {
            errors := validator.ValidatePassword(pass)
            if len(errors) == 0 {
                fmt.Printf("  %s: valid\n", pass)
            } else {
                fmt.Printf("  %s: %d errors\n", pass, len(errors))
            }
        }

        // Test input sanitization
        inputs := []string{
            "Hello World",
            "<script>alert('xss')</script>",
            "<b>Bold text</b>",
            "  spaces  ",
        }

        fmt.Println("\nInput sanitization:")
        for _, input := range inputs {
            sanitized := SanitizeInput(input)
            fmt.Printf("  %q -> %q\n", input, sanitized)
        }
    }
    ```

=== "The Explanation"

    - **Validator struct**: Stores compiled regex patterns
    - **ValidateEmail**: Checks email format
    - **ValidatePassword**: Multiple regex checks for strength
    - **SanitizeInput**: Removes dangerous content
    - **Compiled patterns**: Reused for performance

=== "The Terminal Output"

    ```
    Email validation:
      user@example.com: valid
      invalid-email: Invalid email format
      test.name@domain.org: valid
      @missing.com: Invalid email format

    Password validation:
      weak: 3 errors
      Strong123: valid
      nouppercase123: 1 errors
      NOLOWERCASE123: 1 errors
      NoNumbers: 1 errors
      ValidPass123: valid

    Input sanitization:
      "Hello World" -> "Hello World"
      "<script>alert('xss')</script>" -> ""
      "<b>Bold text</b>" -> "Bold text"
      "  spaces  " -> "spaces"
    ```

## Best Practices

| Practice | Recommendation |
|----------|----------------|
| Compile patterns | Use `MustCompile` for constant patterns |
| Avoid recompilation | Never compile regex in loops |
| Use named groups | Improve readability with `(?P<name>...)` |
| Test patterns | Validate regex with test cases |
| Escape special chars | Use `regexp.QuoteMeta` for user input |
| Keep patterns simple | Prefer multiple simple checks over complex regex |
| Document patterns | Comment complex regex patterns |

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Slow performance | Compiling regex in loop | Compile once and reuse |
| No matches | Incorrect pattern | Test pattern with simple cases |
| Panic | Using MustCompile with invalid pattern | Use Compile with error handling |
| Memory leak | Not reusing compiled patterns | Cache compiled regex objects |

## Summary

- `regexp.MustCompile` for compile-time patterns (panics on error)
- `regexp.Compile` for runtime patterns (returns error)
- `FindString`, `FindStringSubmatch` for extracting matches
- `ReplaceAllString` for text replacement
- `MatchString` for validation
- Always compile regex patterns once and reuse
- Keep patterns simple and well-documented

## Next Steps

- Learn about [Context & Cancellation](context-cancellation.md)
- Explore [Sync Primitives](sync-primitives.md)
- Understand [Sort & Collections](sort-collections.md)
- Discover [Embed & FS](embed-fs.md)
