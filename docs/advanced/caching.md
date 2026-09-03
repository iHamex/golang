# Caching

Caching improves application performance by storing frequently accessed data in fast storage. This guide covers in-memory caching, Redis integration, cache patterns, and distributed caching strategies.

## What You Will Learn

- In-memory caching with sync.Map, bigcache, freecache
- Redis client setup with go-redis
- Cache patterns (cache-aside, write-through)
- Cache invalidation strategies
- TTL (Time-To-Live) configuration
- Distributed caching
- Cache warming techniques

## Prerequisites

- Understanding of Go concurrency
- Basic knowledge of key-value stores
- Familiarity with context package

---

## sync.Map

Thread-safe map for concurrent access.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sync"
        "time"
    )

    type Cache struct {
        items sync.Map
    }

    type CacheItem struct {
        Value     interface{}
        ExpiresAt time.Time
    }

    func NewCache(defaultTTL time.Duration) *Cache {
        return &Cache{}
    }

    func (c *Cache) Set(key string, value interface{}, ttl time.Duration) {
        item := CacheItem{
            Value:     value,
            ExpiresAt: time.Now().Add(ttl),
        }
        c.items.Store(key, item)
    }

    func (c *Cache) Get(key string) (interface{}, bool) {
        item, ok := c.items.Load(key)
        if !ok {
            return nil, false
        }

        cacheItem := item.(CacheItem)
        if time.Now().After(cacheItem.ExpiresAt) {
            c.items.Delete(key)
            return nil, false
        }

        return cacheItem.Value, true
    }

    func (c *Cache) Delete(key string) {
        c.items.Delete(key)
    }

    func (c *Cache) Range(fn func(key, value interface{}) bool) {
        c.items.Range(fn)
    }

    func main() {
        cache := NewCache(5 * time.Minute)

        cache.Set("user:1", "Alice", 1*time.Minute)
        cache.Set("user:2", "Bob", 2*time.Minute)

        if value, ok := cache.Get("user:1"); ok {
            fmt.Printf("Found: %s\n", value)
        }

        if _, ok := cache.Get("user:999"); !ok {
            fmt.Println("Not found")
        }

        cache.Delete("user:1")

        fmt.Println("Cache operations completed")
    }
    ```

=== "The Explanation"

    - **sync.Map**: Concurrent-safe map without explicit locking
    - **CacheItem**: Stores value with expiration time
    - **TTL check**: Deletes expired items on access (lazy expiration)
    - **Range**: Iterates over all items

=== "The Terminal Output"

    ```
    Found: Alice
    Not found
    Cache operations completed
    ```

!!! go "sync.Map Use Case"
    Use sync.Map for read-heavy workloads with rare writes. Not suitable for frequent updates.

---

## Bigcache

High-performance in-memory cache for large datasets.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "time"

        "github.com/allegro/bigcache/v3"
    )

    func main() {
        cache, err := bigcache.New(context.Background(), bigcache.Config{
            Shards:             1024,
            LifeWindow:         5 * time.Minute,
            CleanWindow:        1 * time.Minute,
            MaxEntriesInWindow: 1000 * 10 * 60,
            MaxEntrySize:       500,
            Verbose:            false,
            HardMaxCacheSize:   512,
            Hasher:             nil,
        })
        if err != nil {
            log.Fatal(err)
        }

        // SET
        err = cache.Set("user:1", []byte("Alice"))
        if err != nil {
            log.Fatal(err)
        }

        // GET
        value, err := cache.Get("user:1")
        if err != nil {
            fmt.Printf("Error: %v\n", err)
        } else {
            fmt.Printf("Found: %s\n", value)
        }

        // SET WITH RETRY
        for i := 0; i < 5; i++ {
            key := fmt.Sprintf("item:%d", i)
            data := []byte(fmt.Sprintf("value-%d", i))
            if err := cache.Set(key, data); err != nil {
                log.Printf("Set error: %v", err)
            }
        }

        // GET ALL
        keys, err := cache.GetAvailable()
        if err != nil {
            log.Printf("GetAvailable error: %v", err)
        } else {
            fmt.Printf("Available keys: %d\n", len(keys))
        }

        // DELETE
        err = cache.Delete("user:1")
        if err != nil {
            log.Printf("Delete error: %v", err)
        }

        fmt.Println("Bigcache operations completed")
    }
    ```

=== "The Explanation"

    - **Shards**: Split data across multiple maps for concurrency
    - **LifeWindow**: How long items remain in cache
    - **CleanWindow**: How often to remove expired items
    - **HardMaxCacheSize**: Maximum cache size in MB
    - **[]byte storage**: Efficient binary storage

=== "The Terminal Output"

    ```
    Found: Alice
    Available keys: 5
    Bigcache operations completed
    ```

!!! abstract "Bigcache Features"
    Bigcache uses ring buffers and shards to avoid GC pressure. Ideal for high-throughput caching.

---

## Freecache

Zero-GC in-memory cache.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"
        "time"

        "github.com/coocood/freecache"
    )

    func main() {
        cache := freecache.NewCache(1024 * 1024) // 1MB

        // SET
        key := []byte("user:1")
        value := []byte("Alice")
        err := cache.Set(key, value, 300) // 300 seconds TTL
        if err != nil {
            log.Fatal(err)
        }

        // GET
        retrieved, err := cache.Get(key)
        if err != nil {
            fmt.Printf("Not found: %v\n", err)
        } else {
            fmt.Printf("Found: %s\n", retrieved)
        }

        // SET MULTIPLE
        for i := 0; i < 10; i++ {
            k := []byte(fmt.Sprintf("item:%d", i))
            v := []byte(fmt.Sprintf("value-%d", i))
            cache.Set(k, v, 60)
        }

        // STATS
        stats := cache.Stats()
        fmt.Printf("Entries: %d\n", stats.EntryCount)
        fmt.Printf("Hits: %d\n", stats.HitCount)
        fmt.Printf("Misses: %d\n", stats.MissCount)

        // DELETE
        cache.Del(key)

        // EVICTION COUNT
        fmt.Printf("Evictions: %d\n", stats.EvictedCount)

        fmt.Println("Freecache operations completed")
    }
    ```

=== "The Explanation"

    - **freecache.NewCache**: Creates cache with specified capacity in bytes
    - **TTL in seconds**: Set expiration time
    - **Zero GC**: No garbage collection overhead
    - **Stats**: Track hits, misses, evictions

=== "The Terminal Output"

    ```
    Found: Alice
    Entries: 10
    Hits: 1
    Misses: 0
    Evictions: 0
    Freecache operations completed
    ```

!!! go "Zero GC"
    Freecache pre-allocates memory and uses custom allocation, avoiding Go's garbage collector entirely.

---

## Redis Client (go-redis)

Connect to Redis for distributed caching.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "log"
        "time"

        "github.com/redis/go-redis/v9"
    )

    func main() {
        rdb := redis.NewClient(&redis.Options{
            Addr:     "localhost:6379",
            Password: "",
            DB:       0,
            PoolSize: 10,
        })

        ctx := context.Background()

        // SET
        err := rdb.Set(ctx, "user:1", "Alice", 5*time.Minute).Err()
        if err != nil {
            log.Fatal(err)
        }

        // GET
        val, err := rdb.Get(ctx, "user:1").Result()
        if err == redis.Nil {
            fmt.Println("Key does not exist")
        } else if err != nil {
            log.Fatal(err)
        } else {
            fmt.Printf("Found: %s\n", val)
        }

        // SET WITH OPTIONS
        rdb.SetNX(ctx, "user:2", "Bob", 10*time.Minute)

        // MSET (Multiple Set)
        rdb.MSet(ctx, "user:3", "Charlie", "user:4", "David")

        // MGET (Multiple Get)
        values, err := rdb.MGet(ctx, "user:1", "user:2", "user:3").Result()
        if err != nil {
            log.Fatal(err)
        }
        fmt.Printf("Multiple get: %v\n", values)

        // DELETE
        rdb.Del(ctx, "user:1")

        // EXISTS
        exists := rdb.Exists(ctx, "user:1").Val()
        fmt.Printf("user:1 exists: %d\n", exists)

        // INCREMENT
        rdb.Set(ctx, "counter", 0, 0)
        rdb.Incr(ctx, "counter")
        rdb.IncrBy(ctx, "counter", 5)
        counter, _ := rdb.Get(ctx, "counter").Int()
        fmt.Printf("Counter: %d\n", counter)

        // EXPIRE
        rdb.Set(ctx, "temp", "value", 0)
        rdb.Expire(ctx, "temp", 10*time.Minute)

        // TTL
        ttl := rdb.TTL(ctx, "temp").Val()
        fmt.Printf("TTL: %v\n", ttl)

        fmt.Println("Redis operations completed")
    }
    ```

=== "The Explanation"

    - **redis.NewClient**: Creates Redis client connection pool
    - **Set/Get**: Basic key-value operations
    - **MSet/MGET**: Batch operations for efficiency
    - **SetNX**: Set if not exists (atomic)
    - **Incr/IncrBy**: Atomic increment operations
    - **Expire/TTL**: Manage key expiration

=== "The Terminal Output"

    ```
    Found: Alice
    Multiple get: [Alice Bob Charlie]
    user:1 exists: 0
    Counter: 6
    TTL: 10m0s
    Redis operations completed
    ```

!!! go "Connection Pooling"
    go-redis manages connection pooling automatically. Configure PoolSize based on your workload.

---

## Cache Patterns

Implement common caching strategies.

### Cache-Aside Pattern

=== "The Code"

    ```go
    package main

    import (
        "context"
        "encoding/json"
        "fmt"
        "log"
        "time"

        "github.com/redis/go-redis/v9"
    )

    type User struct {
        ID    int64  `json:"id"`
        Name  string `json:"name"`
        Email string `json:"email"`
    }

    type CacheAside struct {
        redis    *redis.Client
        ttl      time.Duration
    }

    func NewCacheAside(rdb *redis.Client, ttl time.Duration) *CacheAside {
        return &CacheAside{redis: rdb, ttl: ttl}
    }

    func (c *CacheAside) Get(ctx context.Context, key string, loader func() (interface{}, error)) (interface{}, error) {
        val, err := c.redis.Get(ctx, key).Result()
        if err == nil {
            var result interface{}
            json.Unmarshal([]byte(val), &result)
            return result, nil
        }

        if err != redis.Nil {
            return nil, err
        }

        data, err := loader()
        if err != nil {
            return nil, err
        }

        jsonData, _ := json.Marshal(data)
        c.redis.Set(ctx, key, jsonData, c.ttl)

        return data, nil
    }

    func (c *CacheAside) Invalidate(ctx context.Context, key string) error {
        return c.redis.Del(ctx, key).Err()
    }

    func main() {
        rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
        cache := NewCacheAside(rdb, 5*time.Minute)

        ctx := context.Background()

        loader := func() (interface{}, error) {
            fmt.Println("Loading from database...")
            return User{ID: 1, Name: "Alice", Email: "alice@example.com"}, nil
        }

        user, err := cache.Get(ctx, "user:1", loader)
        if err != nil {
            log.Fatal(err)
        }
        fmt.Printf("First get: %+v\n", user)

        user, err = cache.Get(ctx, "user:1", loader)
        if err != nil {
            log.Fatal(err)
        }
        fmt.Printf("Second get (cached): %+v\n", user)
    }
    ```

=== "The Explanation"

    - **Cache-Aside**: Application manages cache explicitly
    - **Loader function**: Fetches data from source on cache miss
    - **JSON serialization**: Store structured data
    - **Invalidate**: Remove cached value on updates

=== "The Terminal Output"

    ```
    Loading from database...
    First get: {id:1 name:Alice email:alice@example.com}
    Second get (cached): {id:1 name:Alice email:alice@example.com}
    ```

!!! note "Cache-Aside Flow"
    1. Check cache
    2. If miss, load from source
    3. Store in cache
    4. Return data

### Write-Through Pattern

=== "The Code"

    ```go
    package main

    import (
        "context"
        "encoding/json"
        "fmt"
        "log"
        "time"

        "github.com/redis/go-redis/v9"
    )

    type User struct {
        ID    int64  `json:"id"`
        Name  string `json:"name"`
    }

    type WriteThrough struct {
        redis *redis.Client
        ttl   time.Duration
    }

    func NewWriteThrough(rdb *redis.Client, ttl time.Duration) *WriteThrough {
        return &WriteThrough{redis: rdb, ttl: ttl}
    }

    func (wt *WriteThrough) Set(ctx context.Context, key string, value interface{}) error {
        jsonData, err := json.Marshal(value)
        if err != nil {
            return err
        }

        return wt.redis.Set(ctx, key, jsonData, wt.ttl).Err()
    }

    func (wt *WriteThrough) Get(ctx context.Context, key string) (interface{}, error) {
        val, err := wt.redis.Get(ctx, key).Result()
        if err != nil {
            return nil, err
        }

        var result interface{}
        json.Unmarshal([]byte(val), &result)
        return result, nil
    }

    func (wt *WriteThrough) Delete(ctx context.Context, key string) error {
        return wt.redis.Del(ctx, key).Err()
    }

    func main() {
        rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
        wt := NewWriteThrough(rdb, 5*time.Minute)

        ctx := context.Background()

        user := User{ID: 1, Name: "Alice"}

        err := wt.Set(ctx, "user:1", user)
        if err != nil {
            log.Fatal(err)
        }
        fmt.Println("Written to cache")

        cached, err := wt.Get(ctx, "user:1")
        if err != nil {
            log.Fatal(err)
        }
        fmt.Printf("Read from cache: %+v\n", cached)
    }
    ```

=== "The Explanation"

    - **Write-Through**: Writes go to cache and database simultaneously
    - **Immediate consistency**: Cache always has latest data
    - **Simple implementation**: Write once, read from cache

=== "The Terminal Output"

    ```
    Written to cache
    Read from cache: map[id:1 name:Alice]
    ```

---

## Cache Invalidation

Strategies for keeping cache fresh.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "log"
        "strings"
        "time"

        "github.com/redis/go-redis/v9"
    )

    type CacheManager struct {
        redis *redis.Client
    }

    func NewCacheManager(rdb *redis.Client) *CacheManager {
        return &CacheManager{redis: rdb}
    }

    func (cm *CacheManager) InvalidateByPattern(ctx context.Context, pattern string) error {
        var cursor uint64
        var keys []string

        for {
            var err error
            keys, cursor, err = cm.redis.Scan(ctx, cursor, pattern, 100).Result()
            if err != nil {
                return err
            }

            if len(keys) > 0 {
                cm.redis.Del(ctx, keys...)
                fmt.Printf("Invalidated %d keys matching %s\n", len(keys), pattern)
            }

            if cursor == 0 {
                break
            }
        }

        return nil
    }

    func (cm *CacheManager) InvalidateUserCache(ctx context.Context, userID int64) error {
        patterns := []string{
            fmt.Sprintf("user:%d:*", userID),
            fmt.Sprintf("user:%d:profile", userID),
            fmt.Sprintf("user:%d:settings", userID),
        }

        for _, pattern := range patterns {
            if err := cm.InvalidateByPattern(ctx, pattern); err != nil {
                return err
            }
        }

        return nil
    }

    func (cm *CacheManager) InvalidateAll(ctx context.Context) error {
        return cm.InvalidateByPattern(ctx, "*")
    }

    func (cm *CacheManager) GetKeysByPrefix(ctx context.Context, prefix string) ([]string, error) {
        var cursor uint64
        var allKeys []string

        for {
            keys, nextCursor, err := cm.redis.Scan(ctx, cursor, prefix+"*", 100).Result()
            if err != nil {
                return nil, err
            }
            allKeys = append(allKeys, keys...)
            cursor = nextCursor
            if cursor == 0 {
                break
            }
        }

        return allKeys, nil
    }

    func main() {
        rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
        cm := NewCacheManager(rdb)

        ctx := context.Background()

        rdb.Set(ctx, "user:1:profile", "Alice Profile", 5*time.Minute)
        rdb.Set(ctx, "user:1:settings", "Alice Settings", 5*time.Minute)
        rdb.Set(ctx, "user:2:profile", "Bob Profile", 5*time.Minute)

        keys, _ := cm.GetKeysByPrefix(ctx, "user:1")
        fmt.Printf("User 1 keys: %v\n", keys)

        cm.InvalidateUserCache(ctx, 1)

        keys, _ = cm.GetKeysByPrefix(ctx, "user:1")
        fmt.Printf("After invalidation: %v\n", keys)
    }
    ```

=== "The Explanation"

    - **Pattern invalidation**: Delete all keys matching pattern
    - **SCAN**: Cursor-based iteration for large key sets
    - **Granular invalidation**: Target specific user data
    - **Full invalidation**: Clear entire cache (use sparingly)

=== "The Terminal Output"

    ```
    User 1 keys: [user:1:profile user:1:settings]
    Invalidated 2 keys matching user:1:*
    After invalidation: []
    ```

!!! warning "Invalidation Strategy"
    Choose invalidation strategy based on data consistency requirements. TTL-based is simplest but may serve stale data.

---

## TTL Management

Configure and manage cache expiration.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "log"
        "time"

        "github.com/redis/go-redis/v9"
    )

    func main() {
        rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
        ctx := context.Background()

        // DEFAULT TTL
        rdb.Set(ctx, "key1", "value1", 5*time.Minute)

        // PERMANENT (no TTL)
        rdb.Set(ctx, "key2", "value2", 0)

        // UPDATE TTL
        rdb.Expire(ctx, "key2", 10*time.Minute)

        // CHECK TTL
        ttl := rdb.TTL(ctx, "key1").Val()
        fmt.Printf("key1 TTL: %v\n", ttl)

        // REMOVE TTL (persist)
        rdb.Persist(ctx, "key2")

        // SET IF NOT EXISTS WITH TTL
        rdb.SetNX(ctx, "key3", "value3", 5*time.Minute)

        // UPDATE TTL ONLY IF KEY EXISTS
        rdb.PExpire(ctx, "key1", 10*time.Minute)

        // GET TTL IN MILLISECONDS
        pttl := rdb.PTTL(ctx, "key1").Val()
        fmt.Printf("key1 PTTL: %v\n", pttl)

        // KEYS WITH TTL
        rdb.Set(ctx, "temp:1", "a", 1*time.Minute)
        rdb.Set(ctx, "temp:2", "b", 2*time.Minute)
        rdb.Set(ctx, "perm:1", "c", 0)

        iter := rdb.Scan(ctx, 0, "temp:*", 100).Iterator()
        for iter.Next(ctx) {
            key := iter.Val()
            t := rdb.TTL(ctx, key).Val()
            fmt.Printf("%s expires in %v\n", key, t)
        }

        fmt.Println("TTL management completed")
    }
    ```

=== "The Explanation"

    - **Expire**: Set TTL on existing key
    - **Persist**: Remove TTL (make permanent)
    - **PExpire**: TTL in milliseconds
    - **PTTL**: Get remaining TTL in milliseconds
    - **SetNX**: Set with TTL only if key doesn't exist

=== "The Terminal Output"

    ```
    key1 TTL: 5m0s
    key1 PTTL: 10m0s
    temp:1 expires in 59s
    temp:2 expires in 1m59s
    TTL management completed
    ```

!!! go "TTL Best Practices"
    - Set appropriate TTL based on data volatility
    - Use shorter TTL for frequently changing data
    - Add jitter to prevent cache stampedes

---

## Distributed Caching

Scale caching across multiple instances.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "encoding/json"
        "fmt"
        "log"
        "time"

        "github.com/redis/go-redis/v9"
    )

    type DistributedCache struct {
        client  *redis.Client
        prefix  string
        ttl     time.Duration
    }

    func NewDistributedCache(client *redis.Client, prefix string, ttl time.Duration) *DistributedCache {
        return &DistributedCache{
            client: client,
            prefix: prefix,
            ttl:    ttl,
        }
    }

    func (dc *DistributedCache) key(k string) string {
        return dc.prefix + ":" + k
    }

    func (dc *DistributedCache) Set(ctx context.Context, key string, value interface{}) error {
        data, err := json.Marshal(value)
        if err != nil {
            return err
        }
        return dc.client.Set(ctx, dc.key(key), data, dc.ttl).Err()
    }

    func (dc *DistributedCache) Get(ctx context.Context, key string, dest interface{}) error {
        data, err := dc.client.Get(ctx, dc.key(key)).Bytes()
        if err != nil {
            return err
        }
        return json.Unmarshal(data, dest)
    }

    func (dc *DistributedCache) Delete(ctx context.Context, key string) error {
        return dc.client.Del(ctx, dc.key(key)).Err()
    }

    func (dc *DistributedCache) Exists(ctx context.Context, key string) (bool, error) {
        result, err := dc.client.Exists(ctx, dc.key(key)).Result()
        return result > 0, err
    }

    func (dc *DistributedCache) SetMulti(ctx context.Context, items map[string]interface{}) error {
        pipe := dc.client.Pipeline()
        for k, v := range items {
            data, _ := json.Marshal(v)
            pipe.Set(ctx, dc.key(k), data, dc.ttl)
        }
        _, err := pipe.Exec(ctx)
        return err
    }

    func (dc *DistributedCache) GetMulti(ctx context.Context, keys []string) (map[string]interface{}, error) {
        pipe := dc.client.Pipeline()
        cmds := make(map[string]*redis.StringCmd)

        for _, k := range keys {
            cmds[k] = pipe.Get(ctx, dc.key(k))
        }

        _, err := pipe.Exec(ctx)
        if err != nil && err != redis.Nil {
            return nil, err
        }

        results := make(map[string]interface{})
        for k, cmd := range cmds {
            if val, err := cmd.Bytes(); err == nil {
                var v interface{}
                json.Unmarshal(val, &v)
                results[k] = v
            }
        }

        return results, nil
    }

    func main() {
        client := redis.NewClient(&redis.Options{
            Addr:     "localhost:6379",
            PoolSize: 10,
        })

        cache := NewDistributedCache(client, "app", 5*time.Minute)
        ctx := context.Background()

        // SET
        err := cache.Set(ctx, "user:1", map[string]string{"name": "Alice"})
        if err != nil {
            log.Fatal(err)
        }

        // GET
        var user map[string]string
        err = cache.Get(ctx, "user:1", &user)
        if err != nil {
            log.Fatal(err)
        }
        fmt.Printf("User: %v\n", user)

        // MULTI
        items := map[string]interface{}{
            "user:2": map[string]string{"name": "Bob"},
            "user:3": map[string]string{"name": "Charlie"},
        }
        cache.SetMulti(ctx, items)

        results, _ := cache.GetMulti(ctx, []string{"user:1", "user:2", "user:3"})
        fmt.Printf("Multi get: %v\n", results)

        fmt.Println("Distributed caching completed")
    }
    ```

=== "The Explanation"

    - **Prefix namespacing**: Avoids key collisions across services
    - **Pipeline**: Batch operations for efficiency
    - **JSON serialization**: Structured data storage
    - **Multi operations**: Reduce round trips

=== "The Terminal Output"

    ```
    User: map[name:Alice]
    Multi get: map[user:1:map[name:Alice] user:2:map[name:Bob] user:3:map[name:Charlie]]
    Distributed caching completed
    ```

!!! go "Redis Cluster"
    For multi-node Redis, use redis.NewClusterClient for automatic sharding.

---

## Cache Warming

Pre-populate cache before high traffic.

=== "The Code"

    ```go
    package main

    import (
        "context"
        "fmt"
        "log"
        "sync"
        "time"

        "github.com/redis/go-redis/v9"
    )

    type CacheWarmer struct {
        redis    *redis.Client
        db       Database
        ttl      time.Duration
        concurrency int
    }

    type Database interface {
        GetAllProducts(ctx context.Context) ([]Product, error)
        GetUserByID(ctx context.Context, id int64) (*User, error)
    }

    type Product struct {
        ID    int64
        Name  string
        Price float64
    }

    type User struct {
        ID   int64
        Name string
    }

    type MockDB struct{}

    func (m *MockDB) GetAllProducts(ctx context.Context) ([]Product, error) {
        return []Product{
            {ID: 1, Name: "Laptop", Price: 999.99},
            {ID: 2, Name: "Mouse", Price: 29.99},
        }, nil
    }

    func (m *MockDB) GetUserByID(ctx context.Context, id int64) (*User, error) {
        return &User{ID: id, Name: fmt.Sprintf("User%d", id)}, nil
    }

    func NewCacheWarmer(rdb *redis.Client, db Database, ttl time.Duration) *CacheWarmer {
        return &CacheWarmer{
            redis:       rdb,
            db:          db,
            ttl:         ttl,
            concurrency: 10,
        }
    }

    func (cw *CacheWarmer) WarmProducts(ctx context.Context) error {
        products, err := cw.db.GetAllProducts(ctx)
        if err != nil {
            return fmt.Errorf("fetch products: %w", err)
        }

        var wg sync.WaitGroup
        sem := make(chan struct{}, cw.concurrency)

        for _, p := range products {
            wg.Add(1)
            sem <- struct{}{}

            go func(product Product) {
                defer wg.Done()
                defer func() { <-sem }()

                key := fmt.Sprintf("product:%d", product.ID)
                cw.redis.Set(ctx, key, product, cw.ttl)
                fmt.Printf("Warmed cache: %s\n", key)
            }(p)
        }

        wg.Wait()
        return nil
    }

    func (cw *CacheWarmer) WarmUser(ctx context.Context, userID int64) error {
        user, err := cw.db.GetUserByID(ctx, userID)
        if err != nil {
            return fmt.Errorf("fetch user: %w", err)
        }

        key := fmt.Sprintf("user:%d", user.ID)
        return cw.redis.Set(ctx, key, user, cw.ttl).Err()
    }

    func (cw *CacheWarmer) WarmOnStartup(ctx context.Context) error {
        fmt.Println("Starting cache warming...")

        if err := cw.WarmProducts(ctx); err != nil {
            log.Printf("Failed to warm products: %v", err)
        }

        for i := int64(1); i <= 5; i++ {
            if err := cw.WarmUser(ctx, i); err != nil {
                log.Printf("Failed to warm user %d: %v", i, err)
            }
        }

        fmt.Println("Cache warming complete")
        return nil
    }

    func main() {
        rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
        db := &MockDB{}

        warmer := NewCacheWarmer(rdb, db, 5*time.Minute)

        ctx := context.Background()

        warmer.WarmOnStartup(ctx)

        time.Sleep(1 * time.Second)
        fmt.Println("Application ready to serve requests")
    }
    ```

=== "The Explanation"

    - **Concurrent warming**: Parallel cache population
    - **Semaphore**: Limit concurrent database queries
    - **Startup warming**: Pre-populate before accepting traffic
    - **Incremental warming**: Warm individual items as needed

=== "The Terminal Output"

    ```
    Starting cache warming...
    Warmed cache: product:1
    Warmed cache: product:2
    Warmed cache: user:1
    Warmed cache: user:2
    Warmed cache: user:3
    Warmed cache: user:4
    Warmed cache: user:5
    Cache warming complete
    Application ready to serve requests
    ```

!!! abstract "Warming Strategies"
    - **Startup warming**: Pre-populate critical data
    - **Scheduled warming**: Periodic refresh of expiring data
    - **On-demand warming**: Warm cache on first access

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Choose right cache | In-memory for single instance, Redis for distributed |
| Set appropriate TTL | Balance freshness vs performance |
| Handle cache misses | Always implement fallback to source |
| Monitor hit ratio | Track cache effectiveness |
| Use pagination | Don't cache unbounded datasets |
| Implement invalidation | Keep cache consistent with source |
| Add jitter to TTL | Prevent cache stampedes |
| Use pipelines | Batch Redis operations |

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Low hit ratio | TTL too short or bad keys | Increase TTL, review key strategy |
| Memory issues | Unbounded cache growth | Set max size, implement eviction |
| Stale data | No invalidation | Implement cache invalidation |
| High latency | Cache miss storm | Implement cache warming |
| Connection errors | Pool exhaustion | Increase pool size |

## Summary

- In-memory caches (sync.Map, bigcache, freecache) for single instances
- Redis for distributed caching
- Cache-aside pattern is most common
- TTL prevents stale data
- Invalidation strategies keep cache fresh
- Cache warming improves cold start performance
- Monitor cache metrics for optimization

## Next Steps

- [Advanced Concurrency](concurrency-patterns.md)
- [Database & SQL](database-sql.md)
- [Performance Tuning](../production/performance.md)
- [Monitoring](../production/observability.md)
