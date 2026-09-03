# Configuration & Viper

Well-structured configuration management separates code from environment-specific values. This guide covers Go's standard approaches for reading configuration, the popular Viper library for multi-format config files, and best practices for validating and merging configuration sources.

## What You Will Learn

- Reading environment variables with `os.Getenv` and the `envconfig` library
- Using the Viper library for YAML, JSON, and TOML configuration
- Implementing configuration merging from multiple sources
- Adding hot reloading for live configuration changes
- Validating configuration with struct tags
- Building type-safe configuration structs

## Prerequisites

- Go 1.20 or later installed
- Understanding of struct tags and JSON marshaling
- Basic familiarity with environment variables

---

## Reading Environment Variables

The simplest configuration approach uses environment variables directly.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
        "strconv"
    )

    type Config struct {
        DatabaseHost     string
        DatabasePort     int
        DatabaseUser     string
        DatabasePassword string
        ServerAddress    string
        DebugMode        bool
    }

    func LoadConfig() (*Config, error) {
        cfg := &Config{
            DatabaseHost:     getEnv("DATABASE_HOST", "localhost"),
            DatabasePort:     getEnvInt("DATABASE_PORT", 5432),
            DatabaseUser:     getEnv("DATABASE_USER", "postgres"),
            DatabasePassword: getEnv("DATABASE_PASSWORD", ""),
            ServerAddress:    getEnv("SERVER_ADDRESS", ":8080"),
            DebugMode:        getEnvBool("DEBUG_MODE", false),
        }

        if cfg.DatabasePassword == "" {
            return nil, fmt.Errorf("DATABASE_PASSWORD is required")
        }

        return cfg, nil
    }

    func getEnv(key, defaultValue string) string {
        if value := os.Getenv(key); value != "" {
            return value
        }
        return defaultValue
    }

    func getEnvInt(key string, defaultValue int) int {
        if value := os.Getenv(key); value != "" {
            if intVal, err := strconv.Atoi(value); err == nil {
                return intVal
            }
        }
        return defaultValue
    }

    func getEnvBool(key string, defaultValue bool) bool {
        if value := os.Getenv(key); value != "" {
            if boolVal, err := strconv.ParseBool(value); err == nil {
                return boolVal
            }
        }
        return defaultValue
    }

    func main() {
        cfg, err := LoadConfig()
        if err != nil {
            fmt.Fprintf(os.Stderr, "Failed to load config: %v\n", err)
            os.Exit(1)
        }

        fmt.Printf("Database: %s@%s:%d\n", cfg.DatabaseUser, cfg.DatabaseHost, cfg.DatabasePort)
        fmt.Printf("Server: %s\n", cfg.ServerAddress)
        fmt.Printf("Debug: %t\n", cfg.DebugMode)
    }
    ```

=== "The Explanation"

    - **getEnv**: Returns the environment variable value or a default
    - **strconv.Atoi**: Converts string environment variables to integers
    - **Required fields**: Check for empty values and return errors early
    - **Default values**: Provide sensible defaults for optional configuration

=== "The Terminal Output"

    ```
    Database: postgres@localhost:5432
    Server: :8080
    Debug: false
    ```

## Configuration with envconfig

The `envconfig` library automates environment variable binding using struct tags.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "time"

        "github.com/kelseyhightower/envconfig"
    )

    type DatabaseConfig struct {
        Host         string        `envconfig:"DB_HOST" default:"localhost" required:"true"`
        Port         int           `envconfig:"DB_PORT" default:"5432"`
        User         string        `envconfig:"DB_USER" default:"postgres"`
        Password     string        `envconfig:"DB_PASSWORD" required:"true"`
        MaxOpenConns int           `envconfig:"DB_MAX_OPEN_CONNS" default:"25"`
        MaxIdleConns int           `envconfig:"DB_MAX_IDLE_CONNS" default:"5"`
        ConnTimeout  time.Duration `envconfig:"DB_CONN_TIMEOUT" default:"5s"`
    }

    type ServerConfig struct {
        Address      string `envconfig:"SERVER_ADDRESS" default:":8080"`
        ReadTimeout  string `envconfig:"SERVER_READ_TIMEOUT" default:"15s"`
        WriteTimeout string `envconfig:"SERVER_WRITE_TIMEOUT" default:"15s"`
        DebugMode    bool   `envconfig:"DEBUG_MODE" default:"false"`
    }

    type AppConfig struct {
        Database DatabaseConfig
        Server   ServerConfig
    }

    func main() {
        var cfg AppConfig
        err := envconfig.Process("", &cfg)
        if err != nil {
            log.Fatalf("Failed to process config: %v", err)
        }

        fmt.Printf("Database: %s@%s:%d (max_open=%d)\n",
            cfg.Database.User, cfg.Database.Host,
            cfg.Database.Port, cfg.Database.MaxOpenConns)
        fmt.Printf("Server: %s (debug=%t)\n",
            cfg.Server.Address, cfg.Server.DebugMode)
    }
    ```

=== "The Explanation"

    - **envconfig.Process**: Automatically reads and populates struct fields from environment
    - **envconfig tag**: Maps struct fields to environment variable names
    - **default tag**: Provides fallback values when environment variables are unset
    - **required tag**: Causes `Process` to return an error if the variable is missing
    - **time.Duration**: Automatically parses duration strings like "5s", "1m"

## Viper Library

Viper is the most popular Go configuration library, supporting multiple formats and sources.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"

        "github.com/spf13/viper"
    )

    type Config struct {
        Server struct {
            Host string `mapstructure:"host" yaml:"host"`
            Port int    `mapstructure:"port" yaml:"port"`
        } `mapstructure:"server" yaml:"server"`
        Database struct {
            Driver     string `mapstructure:"driver" yaml:"driver"`
            Host       string `mapstructure:"host" yaml:"host"`
            Port       int    `mapstructure:"port" yaml:"port"`
            Name       string `mapstructure:"name" yaml:"name"`
            User       string `mapstructure:"user" yaml:"user"`
            Password   string `mapstructure:"password" yaml:"password"`
            MaxOpenConns int  `mapstructure:"max_open_conns" yaml:"max_open_conns"`
        } `mapstructure:"database" yaml:"database"`
        Log struct {
            Level  string `mapstructure:"level" yaml:"level"`
            Format string `mapstructure:"format" yaml:"format"`
        } `mapstructure:"log" yaml:"log"`
    }

    func LoadConfig(path string) (*Config, error) {
        viper.SetConfigFile(path)
        viper.SetConfigType("yaml")

        viper.SetDefault("server.host", "localhost")
        viper.SetDefault("server.port", 8080)
        viper.SetDefault("database.driver", "postgres")
        viper.SetDefault("database.max_open_conns", 25)
        viper.SetDefault("log.level", "info")
        viper.SetDefault("log.format", "json")

        viper.AutomaticEnv()
        viper.SetEnvPrefix("APP")

        if err := viper.ReadInConfig(); err != nil {
            if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
                return nil, fmt.Errorf("failed to read config: %w", err)
            }
            log.Println("No config file found, using defaults")
        }

        var cfg Config
        if err := viper.Unmarshal(&cfg); err != nil {
            return nil, fmt.Errorf("failed to unmarshal config: %w", err)
        }

        return &cfg, nil
    }

    func main() {
        cfg, err := LoadConfig("config.yaml")
        if err != nil {
            log.Fatal(err)
        }

        fmt.Printf("Server: %s:%d\n", cfg.Server.Host, cfg.Server.Port)
        fmt.Printf("Database: %s@%s:%d/%s\n",
            cfg.Database.User, cfg.Database.Host,
            cfg.Database.Port, cfg.Database.Name)
        fmt.Printf("Log level: %s\n", cfg.Log.Level)
    }
    ```

=== "The Explanation"

    - **SetConfigFile**: Specifies the path to the configuration file
    - **SetConfigType**: Sets the format (yaml, json, toml, etc.)
    - **SetDefault**: Provides fallback values for all configuration keys
    - **AutomaticEnv**: Reads environment variables with the configured prefix
    - **Unmarshal**: Converts Viper's internal map to a typed struct

## Config File Formats

Viper supports multiple configuration file formats.

=== "config.yaml"

    ```yaml
    server:
      host: "0.0.0.0"
      port: 8080

    database:
      driver: "postgres"
      host: "localhost"
      port: 5432
      name: "myapp"
      user: "postgres"
      password: "${DB_PASSWORD}"
      max_open_conns: 25

    log:
      level: "debug"
      format: "json"
    ```

=== "config.json"

    ```json
    {
      "server": {
        "host": "0.0.0.0",
        "port": 8080
      },
      "database": {
        "driver": "postgres",
        "host": "localhost",
        "port": 5432,
        "name": "myapp",
        "user": "postgres",
        "password": "",
        "max_open_conns": 25
      },
      "log": {
        "level": "debug",
        "format": "json"
      }
    }
    ```

=== "config.toml"

    ```toml
    [server]
    host = "0.0.0.0"
    port = 8080

    [database]
    driver = "postgres"
    host = "localhost"
    port = 5432
    name = "myapp"
    user = "postgres"
    password = ""
    max_open_conns = 25

    [log]
    level = "debug"
    format = "json"
    ```

## Environment Variable Override

Viper allows environment variables to override file-based configuration.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"

        "github.com/spf13/viper"
    )

    func main() {
        viper.SetConfigFile("config.yaml")
        viper.SetConfigType("yaml")

        viper.AutomaticEnv()
        viper.SetEnvPrefix("MYAPP")
        viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

        if err := viper.ReadInConfig(); err != nil {
            log.Printf("Warning: %v", err)
        }

        fmt.Println("Database Host:", viper.GetString("database.host"))
        fmt.Println("Database Port:", viper.GetInt("database.port"))
        fmt.Println("Server Port:", viper.GetInt("server.port"))
        fmt.Println("Log Level:", viper.GetString("log.level"))
    }
    ```

=== "The Explanation"

    - **SetEnvPrefix**: All environment variables must start with `MYAPP_`
    - **SetEnvKeyReplacer**: Converts dots to underscores for env var names
    - **MYAPP_DATABASE_HOST** overrides `database.host` in the config file
    - **MYAPP_SERVER_PORT** overrides `server.port` in the config file

## Config Merging

Viper can merge multiple configuration sources with clear precedence rules.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "strings"

        "github.com/spf13/viper"
    )

    func main() {
        base := viper.New()
        base.SetConfigFile("config-base.yaml")
        base.SetConfigType("yaml")
        if err := base.ReadInConfig(); err != nil {
            log.Printf("Base config: %v", err)
        }

        override := viper.New()
        override.SetConfigFile("config-override.yaml")
        override.SetConfigType("yaml")
        if err := override.ReadInConfig(); err != nil {
            log.Printf("Override config: %v", err)
        }

        merged := viper.New()
        merged.SetConfigType("yaml")
        merged.MergeConfigMap(base.AllSettings())

        if err := merged.MergeConfigMap(override.AllSettings()); err != nil {
            log.Fatal(err)
        }

        merged.AutomaticEnv()
        merged.SetEnvPrefix("APP")
        merged.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

        fmt.Println("Host:", merged.GetString("server.host"))
        fmt.Println("Port:", merged.GetInt("server.port"))
    }
    ```

=== "The Explanation"

    - **MergeConfigMap**: Combines configuration from multiple sources
    - **Precedence order**: Defaults → Base config → Override config → Environment variables
    - **AllSettings()**: Returns all key-value pairs from a Viper instance

## Hot Reloading

Watch for configuration changes and reload without restarting the application.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "sync"
        "time"

        "github.com/fsnotify/fsnotify"
        "github.com/spf13/viper"
    )

    type ConfigManager struct {
        mu   sync.RWMutex
        cfg  *AppConfig
        v    *viper.Viper
    }

    type AppConfig struct {
        DatabaseHost string
        DatabasePort int
        DebugMode    bool
    }

    func NewConfigManager(path string) (*ConfigManager, error) {
        v := viper.New()
        v.SetConfigFile(path)
        v.SetConfigType("yaml")

        if err := v.ReadInConfig(); err != nil {
            return nil, fmt.Errorf("failed to read config: %w", err)
        }

        cfg := &AppConfig{}
        if err := v.Unmarshal(cfg); err != nil {
            return nil, fmt.Errorf("failed to unmarshal config: %w", err)
        }

        cm := &ConfigManager{
            cfg: cfg,
            v:   v,
        }

        v.WatchConfig()
        v.OnConfigChange(func(e fsnotify.Event) {
            log.Printf("Config file changed: %s", e.Name)
            cm.mu.Lock()
            defer cm.mu.Unlock()

            if err := v.Unmarshal(cm.cfg); err != nil {
                log.Printf("Failed to reload config: %v", err)
                return
            }
            log.Println("Configuration reloaded successfully")
        })

        return cm, nil
    }

    func (cm *ConfigManager) Get() *AppConfig {
        cm.mu.RLock()
        defer cm.mu.RUnlock()
        return cm.cfg
    }

    func main() {
        cm, err := NewConfigManager("config.yaml")
        if err != nil {
            log.Fatal(err)
        }

        for i := 0; i < 5; i++ {
            cfg := cm.Get()
            fmt.Printf("Host: %s, Port: %d, Debug: %t\n",
                cfg.DatabaseHost, cfg.DatabasePort, cfg.DebugMode)
            time.Sleep(2 * time.Second)
        }
    }
    ```

=== "The Explanation"

    - **WatchConfig**: Enables file watching for changes
    - **OnConfigChange**: Callback triggered when the config file is modified
    - **sync.RWMutex**: Thread-safe access to the config struct during reloads
    - **Get()**: Safe accessor that holds the read lock

## Config Validation

Validate configuration values at startup to fail fast on errors.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "net"
        "net/url"
        "os"
        "strings"
    )

    type Config struct {
        ServerAddress  string `validate:"required"`
        DatabaseURL    string `validate:"required,url"`
        RedisURL       string `validate:"required"`
        LogLevel       string `validate:"required,oneof=debug info warn error"`
        MaxConnections int    `validate:"required,min=1,max=1000"`
        AllowedOrigins string `validate:"required"`
    }

    func (c *Config) Validate() error {
        var errs []string

        if c.ServerAddress == "" {
            errs = append(errs, "SERVER_ADDRESS is required")
        } else if _, _, err := net.SplitHostPort(c.ServerAddress); err != nil {
            errs = append(errs, fmt.Sprintf("invalid SERVER_ADDRESS: %v", err))
        }

        if c.DatabaseURL == "" {
            errs = append(errs, "DATABASE_URL is required")
        } else if _, err := url.Parse(c.DatabaseURL); err != nil {
            errs = append(errs, fmt.Sprintf("invalid DATABASE_URL: %v", err))
        }

        validLevels := map[string]bool{
            "debug": true, "info": true, "warn": true, "error": true,
        }
        if !validLevels[strings.ToLower(c.LogLevel)] {
            errs = append(errs, "LOG_LEVEL must be one of: debug, info, warn, error")
        }

        if c.MaxConnections < 1 || c.MaxConnections > 1000 {
            errs = append(errs, "MAX_CONNECTIONS must be between 1 and 1000")
        }

        if len(errs) > 0 {
            return fmt.Errorf("configuration errors:\n  - %s", strings.Join(errs, "\n  - "))
        }

        return nil
    }

    func LoadConfig() (*Config, error) {
        cfg := &Config{
            ServerAddress:  os.Getenv("SERVER_ADDRESS"),
            DatabaseURL:    os.Getenv("DATABASE_URL"),
            RedisURL:       os.Getenv("REDIS_URL"),
            LogLevel:       os.Getenv("LOG_LEVEL"),
            MaxConnections: 25,
            AllowedOrigins: os.Getenv("ALLOWED_ORIGINS"),
        }

        if err := cfg.Validate(); err != nil {
            return nil, err
        }

        return cfg, nil
    }

    func main() {
        cfg, err := LoadConfig()
        if err != nil {
            fmt.Fprintf(os.Stderr, "Configuration error: %v\n", err)
            os.Exit(1)
        }

        fmt.Printf("Server: %s\n", cfg.ServerAddress)
        fmt.Printf("Database: %s\n", cfg.DatabaseURL)
        fmt.Printf("Log Level: %s\n", cfg.LogLevel)
    }
    ```

=== "The Explanation"

    - **Validate method**: Centralizes all validation rules in one place
    - **net.SplitHostPort**: Validates the server address includes port
    - **url.Parse**: Ensures database URL is well-formed
    - **Validation tags**: Document expected format for each field

## Best Practices

| Practice | Recommendation |
|----------|----------------|
| Use typed structs | Never pass raw strings around your codebase |
| Provide defaults | Every optional field should have a sensible default |
| Fail fast | Validate configuration at startup, not at first use |
| Support environment variables | Allow overrides via env vars for container deployments |
| Never commit secrets | Use environment variables or secret managers for passwords |
| Use hierarchical config | Base config file with environment-specific overrides |
| Document all options | Maintain a sample config file with comments |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Config file not found | Check working directory and use absolute paths |
| Environment variable not read | Verify prefix and key name match exactly |
| Unmarshal fails | Ensure struct tags match config keys |
| Hot reload not working | Check file permissions and fsnotify support |
| Default values ignored | Call `SetDefault` before `ReadInConfig` |

## Summary

- `os.Getenv` provides basic environment variable access
- `envconfig` automates binding env vars to struct fields
- Viper supports YAML, JSON, TOML with environment variable overrides
- Merge multiple config files with clear precedence rules
- Hot reloading enables live configuration updates
- Always validate configuration at startup

## Next Steps

- [Logging & Observability](./logging-observability.md) — Configure structured logging
- [Code Generation](./code-generation.md) — Generate configuration code
- [CLI Tools & Flags](../basics/cli-applications.md) — Add command-line flags to configuration
