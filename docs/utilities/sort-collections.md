# Sort & Collections

Go provides powerful sorting and collection utilities through the `sort`, `slices`, `maps`, and `heap` packages. Understanding these tools is essential for working with ordered data efficiently.

## What You Will Learn

- Sort slices with `sort.Slice` and `sort.Interface`
- Search within sorted data with `sort.Search`
- Use the modern `slices` package (Go 1.21+)
- Work with maps using the `maps` package
- Implement priority queues with `heap`
- Use specialized containers like `container/list` and `ring`
- Choose the right collection for your use case

## Prerequisites

- Basic Go syntax and data types
- Understanding of slices and maps
- Familiarity with interfaces

---

## Sorting with sort.Slice

The `sort.Slice` function sorts a slice using a provided less function.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sort"
    )

    func main() {
        // Sort integers
        numbers := []int{5, 2, 8, 1, 9, 3}
        sort.Slice(numbers, func(i, j int) bool {
            return numbers[i] < numbers[j]
        })
        fmt.Println("Sorted numbers:", numbers)

        // Sort strings
        fruits := []string{"banana", "apple", "cherry", "date"}
        sort.Slice(fruits, func(i, j int) bool {
            return fruits[i] < fruits[j]
        })
        fmt.Println("Sorted fruits:", fruits)

        // Sort structs by field
        type Person struct {
            Name string
            Age  int
        }

        people := []Person{
            {"Alice", 30},
            {"Bob", 25},
            {"Charlie", 35},
            {"David", 28},
        }

        sort.Slice(people, func(i, j int) bool {
            return people[i].Age < people[j].Age
        })

        fmt.Println("\nPeople sorted by age:")
        for _, p := range people {
            fmt.Printf("  %s: %d\n", p.Name, p.Age)
        }

        // Sort in reverse
        sort.Slice(numbers, func(i, j int) bool {
            return numbers[i] > numbers[j]
        })
        fmt.Println("\nReverse sorted:", numbers)
    }
    ```

=== "The Explanation"

    - **sort.Slice**: Sorts slice with custom comparison function
    - **Less function**: Returns true if element at i should come before j
    - **In-place sorting**: Modifies the original slice
    - **Stable**: Preserves relative order of equal elements

=== "The Terminal Output"

    ```
    Sorted numbers: [1 2 3 5 8 9]
    Sorted fruits: [apple banana cherry date]

    People sorted by age:
      Bob: 25
      David: 28
      Alice: 30
      Charlie: 35

    Reverse sorted: [9 8 5 3 2 1]
    ```

## Sorting with sort.Interface

The `sort.Interface` provides a type-safe way to sort custom types.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sort"
    )

    // UserList implements sort.Interface
    type UserList struct {
        users []User
    }

    type User struct {
        Name  string
        Email string
        Age   int
    }

    func (ul UserList) Len() int { return len(ul.users) }

    func (ul UserList) Less(i, j int) bool {
        return ul.users[i].Age < ul.users[j].Age
    }

    func (ul UserList) Swap(i, j int) {
        ul.users[i], ul.users[j] = ul.users[j], ul.users[i]
    }

    // EmailList implements sort.Interface for email sorting
    type EmailList struct {
        users []User
    }

    func (el EmailList) Len() int { return len(el.users) }

    func (el EmailList) Less(i, j int) bool {
        return el.users[i].Email < el.users[j].Email
    }

    func (el EmailList) Swap(i, j int) {
        el.users[i], el.users[j] = el.users[j], el.users[i]
    }

    func main() {
        users := []User{
            {"Alice", "alice@example.com", 30},
            {"Bob", "bob@example.com", 25},
            {"Charlie", "charlie@example.com", 35},
            {"David", "david@example.com", 28},
        }

        // Sort by age
        userList := UserList{users}
        sort.Sort(userList)

        fmt.Println("Users sorted by age:")
        for _, u := range userList.users {
            fmt.Printf("  %s: %d\n", u.Name, u.Age)
        }

        // Sort by email
        emailList := EmailList{users}
        sort.Sort(emailList)

        fmt.Println("\nUsers sorted by email:")
        for _, u := range emailList.users {
            fmt.Printf("  %s: %s\n", u.Name, u.Email)
        }

        // Check if sorted
        fmt.Println("\nIs sorted by email?", sort.IsSorted(emailList))
    }
    ```

=== "The Explanation"

    - **sort.Interface**: Requires Len, Less, Swap methods
    - **sort.Sort**: Sorts using the interface
    - **sort.IsSorted**: Checks if already sorted
    - **Type-safe**: Compile-time type checking

=== "The Terminal Output"

    ```
    Users sorted by age:
      Bob: 25
      David: 28
      Alice: 30
      Charlie: 35

    Users sorted by email:
      Alice: alice@example.com
      Bob: bob@example.com
      Charlie: charlie@example.com
      David: david@example.com

    Is sorted by email? true
    ```

## Searching with sort.Search

The `sort.Search` function uses binary search on sorted data.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sort"
    )

    func main() {
        // Binary search on sorted slice
        numbers := []int{1, 3, 5, 7, 9, 11, 13, 15}

        // Search for value
        index := sort.Search(len(numbers), func(i int) bool {
            return numbers[i] >= 7
        })

        if index < len(numbers) && numbers[index] == 7 {
            fmt.Printf("Found 7 at index %d\n", index)
        } else {
            fmt.Println("7 not found")
        }

        // Search for non-existent value
        index = sort.Search(len(numbers), func(i int) bool {
            return numbers[i] >= 10
        })

        if index < len(numbers) {
            fmt.Printf("First value >= 10: %d at index %d\n", numbers[index], index)
        } else {
            fmt.Println("No value >= 10")
        }

        // Search strings
        fruits := []string{"apple", "banana", "cherry", "date", "elderberry"}
        index = sort.SearchStrings(fruits, "cherry")
        fmt.Printf("Found 'cherry' at index %d\n", index)

        // Search with custom comparison
        type Product struct {
            Name  string
            Price float64
        }

        products := []Product{
            {"Laptop", 999.99},
            {"Phone", 699.99},
            {"Tablet", 499.99},
            {"Watch", 299.99},
        }

        // Sort by price first
        sort.Slice(products, func(i, j int) bool {
            return products[i].Price < products[j].Price
        })

        // Find first product > $500
        index = sort.Search(len(products), func(i int) bool {
            return products[i].Price > 500
        })

        if index < len(products) {
            fmt.Printf("First product > $500: %s ($%.2f)\n",
                products[index].Name, products[index].Price)
        }
    }
    ```

=== "The Explanation"

    - **sort.Search**: Binary search with custom comparison
    - **sort.SearchStrings**: Optimized for string slices
    - **Return value**: Index where value would be inserted
    - **Complexity**: O(log n) performance

=== "The Terminal Output"

    ```
    Found 7 at index 3
    First value >= 10: 11 at index 5
    Found 'cherry' at index 2
    First product > $500: Phone ($699.99)
    ```

!!! go "Binary Search Requirements"
The slice must be sorted according to the same comparison function used in search. If not sorted, the search result is undefined.

## Slices Package (Go 1.21+)

The `slices` package provides generic slice operations.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "slices"
    )

    func main() {
        // Sort integers
        numbers := []int{5, 2, 8, 1, 9, 3}
        slices.Sort(numbers)
        fmt.Println("Sorted:", numbers)

        // Sort strings
        fruits := []string{"banana", "apple", "cherry", "date"}
        slices.Sort(fruits)
        fmt.Println("Sorted fruits:", fruits)

        // Binary search (must be sorted)
        index, found := slices.BinarySearch(numbers, 5)
        fmt.Printf("BinarySearch(5): index=%d, found=%v\n", index, found)

        // Contains
        fmt.Println("Contains apple:", slices.Contains(fruits, "apple"))
        fmt.Println("Contains grape:", slices.Contains(fruits, "grape"))

        // Index
        idx := slices.Index(fruits, "cherry")
        fmt.Println("Index of cherry:", idx)

        // Compact (remove consecutive duplicates)
        dupes := []int{1, 1, 2, 2, 3, 3, 4, 4}
        compacted := slices.Compact(dupes)
        fmt.Println("Compacted:", compacted)

        // Delete
        del := []int{1, 2, 3, 4, 5}
        del = slices.Delete(del, 1, 3) // Remove elements at index 1 and 2
        fmt.Println("After delete:", del)

        // Insert
        ins := []int{1, 2, 3}
        ins = slices.Insert(ins, 1, 10, 20) // Insert at index 1
        fmt.Println("After insert:", ins)

        // Reverse
        rev := []int{1, 2, 3, 4, 5}
        slices.Reverse(rev)
        fmt.Println("Reversed:", rev)

        // Min and Max
        nums := []int{3, 1, 4, 1, 5, 9, 2, 6}
        fmt.Println("Min:", slices.Min(nums))
        fmt.Println("Max:", slices.Max(nums))
    }
    ```

=== "The Explanation"

    - **slices.Sort**: Sorts slice in place
    - **slices.BinarySearch**: Binary search on sorted slice
    - **slices.Contains**: Checks if element exists
    - **slices.Index**: Finds index of element
    - **slices.Compact**: Removes consecutive duplicates
    - **slices.Delete**: Removes elements by range
    - **slices.Insert**: Inserts elements at index

=== "The Terminal Output"

    ```
    Sorted: [1 2 3 5 8 9]
    Sorted fruits: [apple banana cherry date]
    BinarySearch(5): index=3, found=true
    Contains apple: true
    Contains grape: false
    Index of cherry: 2
    Compacted: [1 2 3 4]
    After delete: [1 4 5]
    After insert: [1 10 20 2 3]
    Reversed: [5 4 3 2 1]
    Min: 1
    Max: 9
    ```

## Maps Package (Go 1.21+)

The `maps` package provides generic map operations.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "maps"
        "sort"
    )

    func main() {
        // Create map
        scores := map[string]int{
            "Alice":   95,
            "Bob":     87,
            "Charlie": 92,
        }

        // Copy map
        copied := maps.Clone(scores)
        fmt.Println("Original:", scores)
        fmt.Println("Copied:", copied)

        // Delete function
        maps.DeleteFunc(copied, func(key string, value int) bool {
            return value < 90
        })
        fmt.Println("After delete (score < 90):", copied)

        // Equal
        fmt.Println("Equal:", maps.Equal(scores, copied))

        // Keys and Values
        keys := make([]string, 0, len(scores))
        for k := range scores {
            keys = append(keys, k)
        }
        sort.Strings(keys)
        fmt.Println("Keys:", keys)

        values := make([]int, 0, len(scores))
        for _, v := range scores {
            values = append(values, v)
        }
        sort.Ints(values)
        fmt.Println("Values:", values)

        // Rebuild map (equivalent to collecting an iterator)
        collected := make(map[string]int, len(scores))
        for k, v := range scores {
            collected[k] = v
        }
        fmt.Println("Collected:", collected)
    }
    ```

=== "The Explanation"

    - **maps.Clone**: Creates a shallow copy
    - **maps.DeleteFunc**: Deletes entries matching predicate
    - **maps.Equal**: Compares two maps
    - **maps.Keys**: Returns iterator over keys
    - **maps.Values**: Returns iterator over values
    - **maps.Collect**: Collects iterator into map

=== "The Terminal Output"

    ```
    Original: map[Alice:95 Bob:87 Charlie:92]
    Copied: map[Alice:95 Bob:87 Charlie:92]
    After delete (score < 90): map[Alice:95 Charlie:92]
    Equal: false
    Keys: [Alice Bob Charlie]
    Values: [87 92 95]
    Collected: map[Alice:95 Bob:87 Charlie:92]
    ```

## Heap Package

The `heap` package provides heap operations for priority queues.

=== "The Code"

    ```go
    package main

    import (
        "container/heap"
        "fmt"
    )

    // PriorityQueue implements heap.Interface
    type PriorityQueue struct {
        items    []Item
        priority map[string]int
    }

    type Item struct {
        Name     string
        Priority int
        index    int
    }

    func NewPriorityQueue() *PriorityQueue {
        return &PriorityQueue{
            items:    make([]Item, 0),
            priority: make(map[string]int),
        }
    }

    func (pq *PriorityQueue) Len() int { return len(pq.items) }

    func (pq *PriorityQueue) Less(i, j int) bool {
        return pq.items[i].Priority > pq.items[j].Priority // Max heap
    }

    func (pq *PriorityQueue) Swap(i, j int) {
        pq.items[i], pq.items[j] = pq.items[j], pq.items[i]
        pq.items[i].index = i
        pq.items[j].index = j
    }

    func (pq *PriorityQueue) Push(x interface{}) {
        item := x.(Item)
        item.index = len(pq.items)
        pq.items = append(pq.items, item)
    }

    func (pq *PriorityQueue) Pop() interface{} {
        old := pq.items
        n := len(old)
        item := old[n-1]
        item.index = -1
        pq.items = old[0 : n-1]
        return item
    }

    // Update updates the priority of an item
    func (pq *PriorityQueue) Update(name string, priority int) {
        if idx, exists := pq.priority[name]; exists {
            pq.items[idx].Priority = priority
            heap.Fix(pq, idx)
        } else {
            heap.Push(pq, Item{Name: name, Priority: priority})
            pq.priority[name] = priority
        }
    }

    func main() {
        pq := NewPriorityQueue()
        heap.Init(pq)

        // Add items
        heap.Push(pq, Item{Name: "Task1", Priority: 3})
        heap.Push(pq, Item{Name: "Task2", Priority: 1})
        heap.Push(pq, Item{Name: "Task3", Priority: 2})
        heap.Push(pq, Item{Name: "Task4", Priority: 5})
        heap.Push(pq, Item{Name: "Task5", Priority: 4})

        // Process items by priority
        fmt.Println("Processing tasks by priority:")
        for pq.Len() > 0 {
            item := heap.Pop(pq).(Item)
            fmt.Printf("  %s (priority: %d)\n", item.Name, item.Priority)
        }
    }
    ```

=== "The Explanation"

    - **heap.Interface**: Requires Len, Less, Swap, Push, Pop
    - **heap.Init**: Initializes the heap
    - **heap.Push**: Adds element to heap
    - **heap.Pop**: Removes and returns highest priority element
    - **Priority queue**: Use heap for efficient priority queue

=== "The Terminal Output"

    ```
    Processing tasks by priority:
      Task4 (priority: 5)
      Task5 (priority: 4)
      Task1 (priority: 3)
      Task3 (priority: 2)
      Task2 (priority: 1)
    ```

## Container List

The `container/list` package provides a doubly linked list.

=== "The Code"

    ```go
    package main

    import (
        "container/list"
        "fmt"
    )

    func main() {
        // Create new list
        l := list.New()

        // Add elements
        l.PushBack(1)
        l.PushBack(2)
        l.PushBack(3)
        l.PushFront(0)

        // Iterate forward
        fmt.Print("Forward: ")
        for e := l.Front(); e != nil; e = e.Next() {
            fmt.Print(e.Value, " ")
        }
        fmt.Println()

        // Iterate backward
        fmt.Print("Backward: ")
        for e := l.Back(); e != nil; e = e.Prev() {
            fmt.Print(e.Value, " ")
        }
        fmt.Println()

        // Insert after
        l.InsertAfter(10, l.Front())

        // Remove element
        l.Remove(l.Back())

        fmt.Println("After modifications:")
        for e := l.Front(); e != nil; e = e.Next() {
            fmt.Print(e.Value, " ")
        }
        fmt.Println()

        // List length
        fmt.Println("Length:", l.Len())

        // Move to front
        l.MoveToFront(l.Back())
        fmt.Print("After move to front: ")
        for e := l.Front(); e != nil; e = e.Next() {
            fmt.Print(e.Value, " ")
        }
        fmt.Println()
    }
    ```

=== "The Explanation"

    - **list.New**: Creates a new doubly linked list
    - **PushBack/PushFront**: Adds elements to ends
    - **InsertAfter/InsertBefore**: Inserts relative to element
    - **Remove**: Removes element from list
    - **Front/Back**: Returns first/last elements
    - **Next/Prev**: Traverses the list

=== "The Terminal Output"

    ```
    Forward: 0 1 2 3 
    Backward: 3 2 1 0 
    After modifications:
    0 10 1 2 
    Length: 4
    After move to front: 2 0 10 1 
    ```

## Container Ring

The `container/ring` package provides a circular linked list.

=== "The Code"

    ```go
    package main

    import (
        "container/ring"
        "fmt"
    )

    func main() {
        // Create ring with 5 elements
        r := ring.New(5)

        // Fill with values
        for i := 0; i < r.Len(); i++ {
            r.Value = i
            r = r.Next()
        }

        // Iterate once around the ring
        fmt.Print("Ring values: ")
        r.Do(func(x interface{}) {
            fmt.Print(x, " ")
        })
        fmt.Println()

        // Move forward 2 positions
        r = r.Move(2)
        fmt.Println("After moving 2 positions:", r.Value)

        // Link rings
        r1 := ring.New(3)
        r2 := ring.New(3)

        for i := 0; i < 3; i++ {
            r1.Value = i
            r1 = r1.Next()
            r2.Value = i + 10
            r2 = r2.Next()
        }

        // Link creates a single ring
        linked := r1.Link(r2)

        fmt.Print("Linked ring: ")
        linked.Do(func(x interface{}) {
            fmt.Print(x, " ")
        })
        fmt.Println()
    }
    ```

=== "The Explanation"

    - **ring.New**: Creates a new ring with n elements
    - **Next/Prev**: Moves around the ring
    - **Move**: Moves n positions
    - **Link**: Links two rings together
    - **Do**: Iterates over all elements

=== "The Terminal Output"

    ```
    Ring values: 0 1 2 3 4 
    After moving 2 positions: 2
    Linked ring: 0 1 2 10 11 12 
    ```

## Best Practices

| Practice | Recommendation |
|----------|----------------|
| Sort slices | Use `slices.Sort` (Go 1.21+) for new code |
| Custom types | Implement `sort.Interface` for type safety |
| Search | Ensure slice is sorted before binary search |
| Priority queues | Use `heap` package for efficient implementation |
| Linked lists | Use `container/list` for O(1) insert/delete |
| Maps | Use `maps` package for generic operations |

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Wrong sort order | Incorrect Less function | Verify comparison logic |
| Binary search fails | Slice not sorted | Sort before searching |
| Heap panic | Missing Init call | Call heap.Init before operations |
| Nil pointer | Empty list/ring | Check Len before accessing |

## Summary

- `sort.Slice` sorts with custom comparison functions
- `sort.Interface` provides type-safe sorting
- `sort.Search` performs binary search on sorted data
- `slices` package (Go 1.21+) provides generic slice operations
- `maps` package provides generic map operations
- `heap` package enables priority queue implementation
- `container/list` provides doubly linked list
- `container/ring` provides circular linked list

## Next Steps

- Learn about [Embed & FS](embed-fs.md)
- Explore [Hashing & Crypto](hashing-crypto.md)
- Understand [String Processing](string-processing.md)
- Discover [Time & Dates](time-dates.md)
