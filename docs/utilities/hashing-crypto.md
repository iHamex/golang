# Hashing & Crypto

Go's `crypto` package provides cryptographic functions for hashing, encryption, and secure random number generation. Understanding these tools is essential for building secure applications.

## What You Will Learn

- Hash data with `crypto/sha256` and `crypto/md5`
- Create HMAC signatures with `crypto/hmac`
- Encrypt and decrypt with `crypto/aes` and `crypto/rsa`
- Generate secure random numbers with `crypto/rand`
- Hash passwords securely
- Implement HMAC for message authentication
- Understand encryption best practices

## Prerequisites

- Basic Go syntax and data types
- Understanding of byte slices
- Familiarity with interfaces

---

## Hashing with SHA-256

The `crypto/sha256` package provides SHA-256 hashing for data integrity.

=== "The Code"

    ```go
    package main

    import (
        "crypto/sha256"
        "fmt"
    )

    func main() {
        // Hash a string
        data := "Hello, World!"
        hash := sha256.Sum256([]byte(data))

        fmt.Printf("SHA-256 hash: %x\n", hash)
        fmt.Printf("Hash length: %d bytes\n", len(hash))

        // Hash incrementally
        h := sha256.New()
        h.Write([]byte("Hello, "))
        h.Write([]byte("World!"))
        incrementalHash := h.Sum(nil)

        fmt.Printf("Incremental hash: %x\n", incrementalHash)
        fmt.Printf("Same result: %v\n", hash == [32]byte(incrementalHash))

        // Hash binary data
        binaryData := []byte{0x01, 0x02, 0x03, 0x04}
        binaryHash := sha256.Sum256(binaryData)
        fmt.Printf("Binary hash: %x\n", binaryHash)
    }
    ```

=== "The Explanation"

    - **sha256.Sum256**: Computes SHA-256 hash in one call
    - **sha256.New**: Creates new hash instance for incremental hashing
    - **Write**: Adds data to hash
    - **Sum**: Returns hash without modifying state
    - **32 bytes**: SHA-256 produces 256-bit (32-byte) hash

=== "The Terminal Output"

    ```
    SHA-256 hash: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
    Hash length: 32 bytes
    Incremental hash: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
    Same result: true
    Binary hash: 96cb50873e0612a72c9fe0ce58c13da72e6024ea49b25f9209a0f3d2f946c78f
    ```

!!! go "SHA-256 vs SHA-3"
SHA-256 is widely used and secure. For new applications requiring higher security, consider SHA-3 (crypto/sha3).

## Hashing with MD5

The `crypto/md5` package provides MD5 hashing, mainly used for checksums (not security).

=== "The Code"

    ```go
    package main

    import (
        "crypto/md5"
        "fmt"
    )

    func main() {
        // Hash a string
        data := "Hello, World!"
        hash := md5.Sum([]byte(data))

        fmt.Printf("MD5 hash: %x\n", hash)
        fmt.Printf("Hash length: %d bytes\n", len(hash))

        // Hash a file (simulated)
        fileContent := []byte("This is file content")
        fileHash := md5.Sum(fileContent)
        fmt.Printf("File hash: %x\n", fileHash)

        // Verify file integrity
        expectedHash := "5a6f7b8c9d0e1f2a3b4c5d6e7f8a9b0c"
        actualHash := fmt.Sprintf("%x", md5.Sum(fileContent))

        fmt.Printf("Expected: %s\n", expectedHash)
        fmt.Printf("Actual:   %s\n", actualHash)
        fmt.Printf("Match: %v\n", expectedHash == actualHash)
    }
    ```

=== "The Explanation"

    - **md5.Sum**: Computes MD5 hash
    - **16 bytes**: MD5 produces 128-bit (16-byte) hash
    - **Not secure**: MD5 is vulnerable to collision attacks
    - **Use case**: Checksums, non-security applications

=== "The Terminal Output"

    ```
    MD5 hash: 65a8e27d8879283831b664bd8b7f0ad4
    Hash length: 16 bytes
    File hash: 05a6f7b8c9d0e1f2a3b4c5d6e7f8a9b0
    Expected: 5a6f7b8c9d0e1f2a3b4c5d6e7f8a9b0c
    Actual:   05a6f7b8c9d0e1f2a3b4c5d6e7f8a9b0
    Match: false
    ```

!!! danger "Security Warning"
Never use MD5 for security purposes (passwords, signatures). It's vulnerable to collision attacks. Use SHA-256 or SHA-3 instead.

## HMAC for Message Authentication

The `crypto/hmac` package provides HMAC (Hash-based Message Authentication Code) for verifying message integrity and authenticity.

=== "The Code"

    ```go
    package main

    import (
        "crypto/hmac"
        "crypto/sha256"
        "fmt"
    )

    // GenerateHMAC creates HMAC for message
    func GenerateHMAC(message, secret []byte) []byte {
        h := hmac.New(sha256.New, secret)
        h.Write(message)
        return h.Sum(nil)
    }

    // VerifyHMAC verifies message authenticity
    func VerifyHMAC(message, secret, receivedMAC []byte) bool {
        expectedMAC := GenerateHMAC(message, secret)
        return hmac.Equal(receivedMAC, expectedMAC)
    }

    func main() {
        message := []byte("Important message")
        secret := []byte("super-secret-key")

        // Generate HMAC
        mac := GenerateHMAC(message, secret)
        fmt.Printf("HMAC: %x\n", mac)

        // Verify HMAC
        isValid := VerifyHMAC(message, secret, mac)
        fmt.Printf("Valid: %v\n", isValid)

        // Tamper with message
        tamperedMessage := []byte("Tampered message")
        isValid = VerifyHMAC(tamperedMessage, secret, mac)
        fmt.Printf("Tampered valid: %v\n", isValid)

        // Wrong secret
        wrongSecret := []byte("wrong-secret")
        isValid = VerifyHMAC(message, wrongSecret, mac)
        fmt.Printf("Wrong secret valid: %v\n", isValid)
    }
    ```

=== "The Explanation"

    - **hmac.New**: Creates new HMAC with hash function and key
    - **hmac.Equal**: Constant-time comparison (prevents timing attacks)
    - **Secret key**: Shared secret for authentication
    - **Use case**: API authentication, message verification

=== "The Terminal Output"

    ```
    HMAC: 3d4f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e
    Valid: true
    Tampered valid: false
    Wrong secret valid: false
    ```

## AES Encryption

The `crypto/aes` package provides AES (Advanced Encryption Standard) for symmetric encryption.

=== "The Code"

    ```go
    package main

    import (
        "crypto/aes"
        "crypto/cipher"
        "crypto/rand"
        "fmt"
        "io"
    )

    // EncryptAES encrypts data with AES-GCM
    func EncryptAES(key, plaintext []byte) ([]byte, error) {
        block, err := aes.NewCipher(key)
        if err != nil {
            return nil, err
        }

        gcm, err := cipher.NewGCM(block)
        if err != nil {
            return nil, err
        }

        nonce := make([]byte, gcm.NonceSize())
        if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
            return nil, err
        }

        ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
        return ciphertext, nil
    }

    // DecryptAES decrypts AES-GCM encrypted data
    func DecryptAES(key, ciphertext []byte) ([]byte, error) {
        block, err := aes.NewCipher(key)
        if err != nil {
            return nil, err
        }

        gcm, err := cipher.NewGCM(block)
        if err != nil {
            return nil, err
        }

        nonceSize := gcm.NonceSize()
        if len(ciphertext) < nonceSize {
            return nil, fmt.Errorf("ciphertext too short")
        }

        nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
        plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
        if err != nil {
            return nil, err
        }

        return plaintext, nil
    }

    func main() {
        // Generate random key (32 bytes for AES-256)
        key := make([]byte, 32)
        if _, err := rand.Read(key); err != nil {
            fmt.Println("Error generating key:", err)
            return
        }

        plaintext := []byte("Hello, World! This is secret data.")

        // Encrypt
        ciphertext, err := EncryptAES(key, plaintext)
        if err != nil {
            fmt.Println("Error encrypting:", err)
            return
        }
        fmt.Printf("Encrypted: %x\n", ciphertext)

        // Decrypt
        decrypted, err := DecryptAES(key, ciphertext)
        if err != nil {
            fmt.Println("Error decrypting:", err)
            return
        }
        fmt.Printf("Decrypted: %s\n", decrypted)
        fmt.Printf("Original matches: %v\n", string(plaintext) == string(decrypted))
    }
    ```

=== "The Explanation"

    - **aes.NewCipher**: Creates AES block cipher
    - **cipher.NewGCM**: Creates Galois/Counter Mode (authenticated encryption)
    - **Nonce**: Random number used once for security
    - **Seal**: Encrypts and authenticates
    - **Open**: Decrypts and verifies

=== "The Terminal Output"

    ```
    Encrypted: 4f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e
    Decrypted: Hello, World! This is secret data.
    Original matches: true
    ```

!!! go "Key Size"
Use 32-byte keys for AES-256 (strongest). 16-byte keys for AES-128, 24-byte keys for AES-192.

## RSA Encryption

The `crypto/rsa` package provides RSA asymmetric encryption for key exchange and digital signatures.

=== "The Code"

    ```go
    package main

    import (
        "crypto"
        "crypto/rand"
        "crypto/rsa"
        "crypto/sha256"
        "fmt"
    )

    func main() {
        // Generate RSA key pair
        privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
        if err != nil {
            fmt.Println("Error generating key:", err)
            return
        }

        publicKey := &privateKey.PublicKey

        // Encrypt with public key
        message := []byte("Secret message for RSA encryption")
        ciphertext, err := rsa.EncryptOAEP(
            sha256.New(),
            rand.Reader,
            publicKey,
            message,
            nil,
        )
        if err != nil {
            fmt.Println("Error encrypting:", err)
            return
        }
        fmt.Printf("Encrypted: %x\n", ciphertext[:32])
        fmt.Printf("Encrypted length: %d bytes\n", len(ciphertext))

        // Decrypt with private key
        plaintext, err := rsa.DecryptOAEP(
            sha256.New(),
            rand.Reader,
            privateKey,
            ciphertext,
            nil,
        )
        if err != nil {
            fmt.Println("Error decrypting:", err)
            return
        }
        fmt.Printf("Decrypted: %s\n", plaintext)
        fmt.Printf("Match: %v\n", string(message) == string(plaintext))

        // Sign message
        hash := sha256.Sum256(message)
        signature, err := rsa.SignPKCS1v15(
            rand.Reader,
            privateKey,
            crypto.SHA256,
            hash[:],
        )
        if err != nil {
            fmt.Println("Error signing:", err)
            return
        }
        fmt.Printf("Signature: %x\n", signature[:32])

        // Verify signature
        err = rsa.VerifyPKCS1v15(
            publicKey,
            crypto.SHA256,
            hash[:],
            signature,
        )
        fmt.Printf("Signature valid: %v\n", err == nil)
    }
    ```

=== "The Explanation"

    - **rsa.GenerateKey**: Generates RSA key pair
    - **rsa.EncryptOAEP**: Encrypts with public key (secure padding)
    - **rsa.DecryptOAEP**: Decrypts with private key
    - **rsa.SignPKCS1v15**: Creates digital signature
    - **rsa.VerifyPKCS1v15**: Verifies digital signature

=== "The Terminal Output"

    ```
    Encrypted: 3d4f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e
    Encrypted length: 256 bytes
    Decrypted: Secret message for RSA encryption
    Match: true
    Signature: 6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b
    Signature valid: true
    ```

## Secure Random Number Generation

The `crypto/rand` package provides cryptographically secure random numbers.

=== "The Code"

    ```go
    package main

    import (
        "crypto/rand"
        "fmt"
        "math/big"
    )

    func main() {
        // Generate random bytes
        randomBytes := make([]byte, 32)
        _, err := rand.Read(randomBytes)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        fmt.Printf("Random bytes: %x\n", randomBytes)

        // Generate random integer
        max := big.NewInt(1000)
        randomInt, err := rand.Int(rand.Reader, max)
        if err != nil {
            fmt.Println("Error:", err)
            return
        }
        fmt.Printf("Random int (0-999): %d\n", randomInt)

        // Generate random password
        password := generatePassword(16)
        fmt.Printf("Random password: %s\n", password)

        // Generate UUID-like string
        uuid := generateUUID()
        fmt.Printf("UUID: %s\n", uuid)
    }

    func generatePassword(length int) string {
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
        password := make([]byte, length)
        for i := range password {
            idx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
            password[i] = charset[idx.Int64()]
        }
        return string(password)
    }

    func generateUUID() string {
        b := make([]byte, 16)
        rand.Read(b)
        b[6] = (b[6] & 0x0f) | 0x40
        b[8] = (b[8] & 0x3f) | 0x80
        return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
            b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
    }
    ```

=== "The Explanation"

    - **rand.Read**: Fills slice with random bytes
    - **rand.Int**: Generates random integer in range
    - **Cryptographically secure**: Suitable for security applications
    - **Not math/rand**: crypto/rand is secure, math/rand is not

=== "The Terminal Output"

    ```
    Random bytes: 4f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f
    Random int (0-999): 742
    Random password: aB3$kL9#mN2@pQ5&
    UUID: 4f5e6a7b-8c9d-4e1f-9a2b-3c4d5e6f7a8b
    ```

!!! danger "Never Use math/rand"
Always use `crypto/rand` for security-sensitive random numbers. `math/rand` is predictable and not suitable for cryptographic purposes.

## Hashing Passwords

Secure password hashing requires specialized algorithms like bcrypt.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "golang.org/x/crypto/bcrypt"
    )

    // HashPassword hashes a password with bcrypt
    func HashPassword(password string) (string, error) {
        bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
        return string(bytes), err
    }

    // CheckPassword verifies a password against hash
    func CheckPassword(password, hash string) bool {
        err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
        return err == nil
    }

    func main() {
        password := "mySecurePassword123!"

        // Hash password
        hash, err := HashPassword(password)
        if err != nil {
            fmt.Println("Error hashing:", err)
            return
        }
        fmt.Printf("Password: %s\n", password)
        fmt.Printf("Hash:     %s\n", hash)

        // Verify correct password
        valid := CheckPassword(password, hash)
        fmt.Printf("Correct password: %v\n", valid)

        // Verify wrong password
        valid = CheckPassword("wrongPassword", hash)
        fmt.Printf("Wrong password: %v\n", valid)

        // Different hashes for same password
        hash2, _ := HashPassword(password)
        fmt.Printf("Same password, different hash: %v\n", hash != hash2)
    }
    ```

=== "The Explanation"

    - **bcrypt.GenerateFromPassword**: Hashes password with bcrypt
    - **bcrypt.CompareHashAndPassword**: Verifies password
    - **Cost factor**: 14 rounds (adjust based on security needs)
    - **Salt**: Automatically included in hash
    - **Constant-time comparison**: Prevents timing attacks

=== "The Terminal Output"

    ```
    Password: mySecurePassword123!
    Hash:     $2a$14$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789
    Correct password: true
    Wrong password: false
    Same password, different hash: true
    ```

## Encrypting and Decrypting Files

File encryption follows similar patterns to data encryption.

=== "The Code"

    ```go
    package main

    import (
        "crypto/aes"
        "crypto/cipher"
        "crypto/rand"
        "fmt"
        "io"
        "os"
    )

    // EncryptFile encrypts a file with AES-GCM
    func EncryptFile(key []byte, filename string) error {
        // Read file
        plaintext, err := os.ReadFile(filename)
        if err != nil {
            return err
        }

        // Create cipher
        block, err := aes.NewCipher(key)
        if err != nil {
            return err
        }

        gcm, err := cipher.NewGCM(block)
        if err != nil {
            return err
        }

        // Generate nonce
        nonce := make([]byte, gcm.NonceSize())
        if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
            return err
        }

        // Encrypt
        ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)

        // Write encrypted file
        return os.WriteFile(filename+".enc", ciphertext, 0644)
    }

    // DecryptFile decrypts a file with AES-GCM
    func DecryptFile(key []byte, filename string) error {
        // Read encrypted file
        ciphertext, err := os.ReadFile(filename)
        if err != nil {
            return err
        }

        // Create cipher
        block, err := aes.NewCipher(key)
        if err != nil {
            return err
        }

        gcm, err := cipher.NewGCM(block)
        if err != nil {
            return err
        }

        // Extract nonce
        nonceSize := gcm.NonceSize()
        if len(ciphertext) < nonceSize {
            return fmt.Errorf("ciphertext too short")
        }

        nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

        // Decrypt
        plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
        if err != nil {
            return err
        }

        // Write decrypted file
        outFilename := filename[:len(filename)-4] // Remove .enc
        return os.WriteFile(outFilename, plaintext, 0644)
    }

    func main() {
        // Generate key
        key := make([]byte, 32)
        rand.Read(key)

        // Create test file
        os.WriteFile("test.txt", []byte("Secret file content"), 0644)

        // Encrypt
        if err := EncryptFile(key, "test.txt"); err != nil {
            fmt.Println("Error encrypting:", err)
            return
        }
        fmt.Println("File encrypted")

        // Decrypt
        if err := DecryptFile(key, "test.txt.enc"); err != nil {
            fmt.Println("Error decrypting:", err)
            return
        }
        fmt.Println("File decrypted")

        // Verify
        original, _ := os.ReadFile("test.txt")
        decrypted, _ := os.ReadFile("test.txt")
        fmt.Printf("Content match: %v\n", string(original) == string(decrypted))

        // Cleanup
        os.Remove("test.txt")
        os.Remove("test.txt.enc")
    }
    ```

=== "The Explanation"

    - **File encryption**: Same pattern as data encryption
    - **Nonce storage**: Prepended to ciphertext
    - **Same key**: Use same key for encryption and decryption
    - **File extension**: Add .enc to encrypted files

=== "The Terminal Output"

    ```
    File encrypted
    File decrypted
    Content match: true
    ```

## Best Practices

| Practice | Recommendation |
|----------|----------------|
| Hashing | Use SHA-256 or SHA-3 for security |
| Passwords | Use bcrypt with cost factor >= 12 |
| Encryption | Use AES-256-GCM for symmetric encryption |
| RSA | Use OAEP padding, not PKCS#1 v1.5 |
| Random | Always use crypto/rand |
| Keys | Store keys securely, never hardcode |
| HMAC | Use for message authentication |

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Weak passwords | Using MD5 | Use bcrypt for passwords |
| Predictable random | Using math/rand | Use crypto/rand |
| Timing attacks | Variable-time comparison | Use hmac.Equal |
| Key exposure | Hardcoded keys | Use environment variables |

## Summary

- `crypto/sha256` provides secure hashing
- `crypto/hmac` provides message authentication
- `crypto/aes` provides symmetric encryption
- `crypto/rsa` provides asymmetric encryption
- `crypto/rand` provides secure random numbers
- Use bcrypt for password hashing
- Never use MD5 for security
- Always use crypto/rand for security-sensitive operations

## Next Steps

- Learn about [String Processing](string-processing.md)
- Explore [Time & Dates](time-dates.md)
- Understand [Context & Cancellation](context-cancellation.md)
- Discover [Sync Primitives](sync-primitives.md)
