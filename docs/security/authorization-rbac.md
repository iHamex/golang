# Authorization & RBAC

Authorization determines what an authenticated user can access. Role-Based Access Control (RBAC) is the most common authorization model, assigning permissions to roles rather than individual users. This guide covers RBAC implementation, middleware patterns, and policy enforcement in Go.

## What You Will Learn

- Design and implement RBAC systems in Go
- Build authorization middleware for HTTP handlers
- Use the Casbin library for policy management
- Implement resource-level permissions
- Create admin vs user role hierarchies
- Test authorization logic effectively

## Prerequisites

- Understanding of HTTP middleware
- Familiarity with authentication concepts (see [Authentication & JWT](authentication-jwt.md))
- Basic knowledge of access control models

---

## RBAC Fundamentals

RBAC assigns permissions to roles, then assigns roles to users. This simplifies permission management and provides clear audit trails.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sync"
    )

    type Role struct {
        Name        string
        Permissions []string
        ParentRole  *Role
    }

    type User struct {
        ID    string
        Name  string
        Roles []*Role
    }

    type RBACSystem struct {
        roles  map[string]*Role
        users  map[string]*User
        mu     sync.RWMutex
    }

    func NewRBACSystem() *RBACSystem {
        return &RBACSystem{
            roles: make(map[string]*Role),
            users: make(map[string]*User),
        }
    }

    func (rbac *RBACSystem) CreateRole(name string, permissions []string) *Role {
        rbac.mu.Lock()
        defer rbac.mu.Unlock()

        role := &Role{
            Name:        name,
            Permissions: permissions,
        }
        rbac.roles[name] = role
        return role
    }

    func (rbac *RBACSystem) SetRoleParent(child, parent *Role) {
        rbac.mu.Lock()
        defer rbac.mu.Unlock()
        child.ParentRole = parent
    }

    func (rbac *RBACSystem) AssignRole(userID string, role *Role) error {
        rbac.mu.Lock()
        defer rbac.mu.Unlock()

        user, exists := rbac.users[userID]
        if !exists {
            return fmt.Errorf("user not found")
        }

        user.Roles = append(user.Roles, role)
        return nil
    }

    func (rbac *RBACSystem) CheckPermission(userID, permission string) bool {
        rbac.mu.RLock()
        defer rbac.mu.RUnlock()

        user, exists := rbac.users[userID]
        if !exists {
            return false
        }

        for _, role := range user.Roles {
            if rbac.roleHasPermission(role, permission) {
                return true
            }
        }

        return false
    }

    func (rbac *RBACSystem) roleHasPermission(role *Role, permission string) bool {
        for _, p := range role.Permissions {
            if p == permission || p == "*" {
                return true
            }
        }

        // Check parent role (role hierarchy)
        if role.ParentRole != nil {
            return rbac.roleHasPermission(role.ParentRole, permission)
        }

        return false
    }

    func main() {
        rbac := NewRBACSystem()

        // Create roles
        adminRole := rbac.CreateRole("admin", []string{"*"})
        editorRole := rbac.CreateRole("editor", []string{
            "read", "write", "edit",
        })
        viewerRole := rbac.CreateRole("viewer", []string{"read"})

        // Set role hierarchy
        rbac.SetRoleParent(editorRole, viewerRole)
        rbac.SetRoleParent(adminRole, editorRole)

        // Create users
        rbac.mu.Lock()
        rbac.users["user1"] = &User{ID: "user1", Name: "Alice"}
        rbac.users["user2"] = &User{ID: "user2", Name: "Bob"}
        rbac.users["user3"] = &User{ID: "user3", Name: "Charlie"}
        rbac.mu.Unlock()

        // Assign roles
        rbac.AssignRole("user1", adminRole)
        rbac.AssignRole("user2", editorRole)
        rbac.AssignRole("user3", viewerRole)

        // Check permissions
        fmt.Println("Alice (admin) can delete:", rbac.CheckPermission("user1", "delete"))
        fmt.Println("Bob (editor) can edit:", rbac.CheckPermission("user2", "edit"))
        fmt.Println("Charlie (viewer) can write:", rbac.CheckPermission("user3", "write"))
        fmt.Println("Charlie (viewer) can read:", rbac.CheckPermission("user3", "read"))
    }
    ```

=== "The Explanation"

    - **Role hierarchy**: Child roles inherit parent permissions
    - **Wildcard permissions**: `*` grants all permissions
    - **Thread-safe storage**: RWMutex protects concurrent access
    - **Permission checking**: Traverse role hierarchy for inherited permissions

=== "The Terminal Output"

    ```
    Alice (admin) can delete: true
    Bob (editor) can edit: true
    Charlie (viewer) can write: false
    Charlie (viewer) can read: true
    ```

!!! go "RBAC Design Principles"

    - Assign permissions to roles, not users directly
    - Use the principle of least privilege
    - Implement role hierarchy for permission inheritance
    - Audit role assignments regularly

## Authorization Middleware

=== "The Code"

    ```go
    package middleware

    import (
        "context"
        "net/http"
        "strings"
    )

    type PermissionChecker interface {
        CheckPermission(userID, permission string) bool
    }

    type AuthorizationMiddleware struct {
        checker PermissionChecker
    }

    func NewAuthorizationMiddleware(checker PermissionChecker) *AuthorizationMiddleware {
        return &AuthorizationMiddleware{checker: checker}
    }

    func (m *AuthorizationMiddleware) RequirePermission(permission string,
        next http.Handler) http.Handler {

        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            userID := GetUserIDFromContext(r.Context())
            if userID == "" {
                http.Error(w, "Unauthorized", http.StatusUnauthorized)
                return
            }

            if !m.checker.CheckPermission(userID, permission) {
                http.Error(w, "Forbidden: insufficient permissions",
                    http.StatusForbidden)
                return
            }

            next.ServeHTTP(w, r)
        })
    }

    func (m *AuthorizationMiddleware) RequireAnyPermission(permissions []string,
        next http.Handler) http.Handler {

        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            userID := GetUserIDFromContext(r.Context())
            if userID == "" {
                http.Error(w, "Unauthorized", http.StatusUnauthorized)
                return
            }

            for _, perm := range permissions {
                if m.checker.CheckPermission(userID, perm) {
                    next.ServeHTTP(w, r)
                    return
                }
            }

            http.Error(w, "Forbidden: insufficient permissions",
                http.StatusForbidden)
        })
    }

    func (m *AuthorizationMiddleware) RequireAllPermissions(permissions []string,
        next http.Handler) http.Handler {

        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            userID := GetUserIDFromContext(r.Context())
            if userID == "" {
                http.Error(w, "Unauthorized", http.StatusUnauthorized)
                return
            }

            for _, perm := range permissions {
                if !m.checker.CheckPermission(userID, perm) {
                    http.Error(w, "Forbidden: insufficient permissions",
                        http.StatusForbidden)
                    return
                }
            }

            next.ServeHTTP(w, r)
        })
    }

    // Helper to extract user ID from context
    func GetUserIDFromContext(ctx context.Context) string {
        if userID, ok := ctx.Value("userID").(string); ok {
            return userID
        }
        return ""
    }
    ```

=== "The Explanation"

    - **Interface-based design**: Swap permission implementations easily
    - **RequirePermission**: Single permission check
    - **RequireAnyPermission**: User needs at least one of the permissions
    - **RequireAllPermissions**: User needs all specified permissions

=== "The Terminal Output"

    ```
    Authorization middleware initialized
    Permission check: read - ALLOWED
    Permission check: delete - DENIED
    ```

## Casbin Integration

Casbin is a powerful authorization library supporting multiple access control models.

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "log"

        "github.com/casbin/casbin/v2"
        gormadapter "github.com/casbin/gorm-adapter/v3"
        "gorm.io/driver/postgres"
        "gorm.io/gorm"
    )

    // CasbinRBAC provides RBAC authorization using Casbin
    type CasbinRBAC struct {
        enforcer *casbin.CachedEnforcer
    }

    func NewCasbinRBAC(dsn string) (*CasbinRBAC, error) {
        // Initialize database adapter
        db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
        if err != nil {
            return nil, err
        }

        adapter, err := gormadapter.NewAdapterByDB(db)
        if err != nil {
            return nil, err
        }

        // Create enforcer with RBAC model
        enforcer, err := casbin.NewCachedEnforcer(
            "rbac_model.conf",
            adapter,
        )
        if err != nil {
            return nil, err
        }

        // Load policy
        if err := enforcer.LoadPolicy(); err != nil {
            return nil, err
        }

        return &CasbinRBAC{enforcer: enforcer}, nil
    }

    func (c *CasbinRBAC) AddRoleForUser(userID, role string) error {
        _, err := c.enforcer.AddRoleForUser(userID, role)
        return err
    }

    func (c *CasbinRBAC) AddPolicy(role, resource, action string) error {
        _, err := c.enforcer.AddPolicy(role, resource, action)
        return err
    }

    func (c *CasbinRBAC) CheckAccess(userID, resource, action string) bool {
        ok, err := c.enforcer.Enforce(userID, resource, action)
        if err != nil {
            log.Printf("Authorization error: %v", err)
            return false
        }
        return ok
    }

    func (c *CasbinRBAC) RemoveRoleForUser(userID, role string) error {
        _, err := c.enforcer.DeleteRoleForUser(userID, role)
        return err
    }

    func (c *CasbinRBAC) GetRolesForUser(userID []string) ([]string, error) {
        return c.enforcer.GetRolesForUser(userID)
    }

    // RBAC model configuration (rbac_model.conf)
    const rbacModelConf = `
    [request_definition]
    r = sub, obj, act

    [policy_definition]
    p = sub, obj, act

    [role_definition]
    g = _, _

    [policy_effect]
    e = some(where (p.eft == allow))

    [matchers]
    m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
    `

    func main() {
        // Example usage (without database)
        enforcer, err := casbin.NewEnforcer(
            casbin.NewModel(rbacModelConf),
            [][]string{
                {"admin", "articles", "read"},
                {"admin", "articles", "write"},
                {"admin", "articles", "delete"},
                {"editor", "articles", "read"},
                {"editor", "articles", "write"},
                {"viewer", "articles", "read"},
            },
        )
        if err != nil {
            fmt.Println("Error:", err)
            return
        }

        // Add role assignments
        enforcer.AddRoleForUser("alice", "admin")
        enforcer.AddRoleForUser("bob", "editor")
        enforcer.AddRoleForUser("charlie", "viewer")

        // Check access
        tests := []struct {
            user   string
            object string
            action string
        }{
            {"alice", "articles", "delete"},
            {"bob", "articles", "write"},
            {"bob", "articles", "delete"},
            {"charlie", "articles", "read"},
            {"charlie", "articles", "write"},
        }

        for _, test := range tests {
            ok, _ := enforcer.Enforce(test.user, test.object, test.action)
            fmt.Printf("%s -> %s %s: %v\n", test.user, test.action,
                test.object, ok)
        }
    }
    ```

=== "The Explanation"

    - **RBAC model**: Users are assigned roles, roles have permissions
    - **Policy storage**: Persist policies in database for production
    - **CachedEnforcer**: Cache policies for better performance
    - **Flexible matchers**: Customize access control logic

=== "The Terminal Output"

    ```
    alice -> delete articles: true
    bob -> write articles: true
    bob -> delete articles: false
    charlie -> read articles: true
    charlie -> write articles: false
    ```

!!! note "Casbin Models"

    Casbin supports multiple access control models:

    - **RBAC**: Role-based access control (most common)
    - **ABAC**: Attribute-based access control
    - **ACL**: Access control lists
    - **Deny-allow**: Explicit deny rules

## Resource-Level Permissions

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "sync"
    )

    type ResourcePermission struct {
        ResourceType string
        ResourceID   string
        UserID       string
        Permissions  []string
    }

    type ResourceAuth struct {
        permissions []ResourcePermission
        mu          sync.RWMutex
    }

    func NewResourceAuth() *ResourceAuth {
        return &ResourceAuth{
            permissions: make([]ResourcePermission, 0),
        }
    }

    func (ra *ResourceAuth) GrantPermission(resourceType, resourceID,
        userID string, permissions []string) {

        ra.mu.Lock()
        defer ra.mu.Unlock()

        ra.permissions = append(ra.permissions, ResourcePermission{
            ResourceType: resourceType,
            ResourceID:   resourceID,
            UserID:       userID,
            Permissions:  permissions,
        })
    }

    func (ra *ResourceAuth) RevokePermission(resourceType, resourceID,
        userID string) {

        ra.mu.Lock()
        defer ra.mu.Unlock()

        for i, p := range ra.permissions {
            if p.ResourceType == resourceType &&
                p.ResourceID == resourceID &&
                p.UserID == userID {

                ra.permissions = append(
                    ra.permissions[:i],
                    ra.permissions[i+1:]...,
                )
                break
            }
        }
    }

    func (ra *ResourceAuth) CheckPermission(resourceType, resourceID,
        userID, permission string) bool {

        ra.mu.RLock()
        defer ra.mu.RUnlock()

        for _, p := range ra.permissions {
            if p.ResourceType == resourceType &&
                p.ResourceID == resourceID &&
                p.UserID == userID {

                for _, perm := range p.Permissions {
                    if perm == permission || perm == "*" {
                        return true
                    }
                }
            }
        }

        return false
    }

    func main() {
        auth := NewResourceAuth()

        // Grant permissions
        auth.GrantPermission("document", "doc123", "user1", []string{"read", "write"})
        auth.GrantPermission("document", "doc123", "user2", []string{"read"})
        auth.GrantPermission("document", "doc456", "user1", []string{"read", "write", "delete"})

        // Check permissions
        fmt.Println("User1 can write doc123:",
            auth.CheckPermission("document", "doc123", "user1", "write"))
        fmt.Println("User2 can write doc123:",
            auth.CheckPermission("document", "doc123", "user2", "write"))
        fmt.Println("User1 can delete doc456:",
            auth.CheckPermission("document", "doc456", "user1", "delete"))

        // Revoke permissions
        auth.RevokePermission("document", "doc123", "user2")
        fmt.Println("After revoke - User2 can read doc123:",
            auth.CheckPermission("document", "doc123", "user2", "read"))
    }
    ```

=== "The Explanation"

    - **Resource-specific**: Permissions tied to specific resources
    - **Granular control**: Per-user, per-resource permissions
    - **Dynamic grants**: Add or revoke permissions at runtime
    - **Type-safe**: Resource types provide additional grouping

=== "The Terminal Output"

    ```
    User1 can write doc123: true
    User2 can write doc123: false
    User1 can delete doc456: true
    After revoke - User2 can read doc123: false
    ```

## Admin vs User Roles

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "strings"
    )

    type UserRole int

    const (
        RoleGuest UserRole = iota
        RoleViewer
        RoleEditor
        RoleAdmin
        RoleSuperAdmin
    )

    func (r UserRole) String() string {
        return [...]string{
            "guest",
            "viewer",
            "editor",
            "admin",
            "super_admin",
        }[r]
    }

    type UserWithRole struct {
        ID       string
        Username string
        Role     UserRole
    }

    func (u *UserWithRole) HasPermission(required UserRole) bool {
        return u.Role >= required
    }

    func (u *UserWithRole) CanAccessResource(resourceOwnerID string) bool {
        // SuperAdmin can access everything
        if u.Role == RoleSuperAdmin {
            return true
        }

        // Admin can access non-admin resources
        if u.Role == RoleAdmin && resourceOwnerID != "admin_system" {
            return true
        }

        // Users can only access their own resources
        return u.ID == resourceOwnerID
    }

    type RolePermissions struct {
        Role        UserRole
        Permissions []string
    }

    var rolePermissions = []RolePermissions{
        {
            Role:        RoleGuest,
            Permissions: []string{},
        },
        {
            Role:        RoleViewer,
            Permissions: []string{"read:own"},
        },
        {
            Role:        RoleEditor,
            Permissions: []string{"read:own", "write:own", "delete:own"},
        },
        {
            Role:        RoleAdmin,
            Permissions: []string{
                "read:any",
                "write:any",
                "delete:any",
                "manage:users",
            },
        },
        {
            Role:        RoleSuperAdmin,
            Permissions: []string{"*"},
        },
    }

    func HasPermission(userRole UserRole, requiredPerm string) bool {
        for _, rp := range rolePermissions {
            if rp.Role == userRole {
                for _, perm := range rp.Permissions {
                    if perm == requiredPerm || perm == "*" {
                        return true
                    }
                    // Check wildcard patterns
                    if strings.HasSuffix(perm, ":*") {
                        prefix := strings.TrimSuffix(perm, ":*")
                        if strings.HasPrefix(requiredPerm, prefix) {
                            return true
                        }
                    }
                }
            }
        }
        return false
    }

    func main() {
        users := []*UserWithRole{
            {ID: "1", Username: "guest_user", Role: RoleGuest},
            {ID: "2", Username: "viewer_user", Role: RoleViewer},
            {ID: "3", Username: "editor_user", Role: RoleEditor},
            {ID: "4", Username: "admin_user", Role: RoleAdmin},
            {ID: "5", Username: "superadmin", Role: RoleSuperAdmin},
        }

        for _, user := range users {
            fmt.Printf("\n%s (%s):\n", user.Username, user.Role)
            fmt.Printf("  Can read own: %v\n",
                HasPermission(user.Role, "read:own"))
            fmt.Printf("  Can write any: %v\n",
                HasPermission(user.Role, "write:any"))
            fmt.Printf("  Can manage users: %v\n",
                HasPermission(user.Role, "manage:users"))
        }
    }
    ```

=== "The Explanation"

    - **Role hierarchy**: Numerical comparison for role levels
    - **Pattern matching**: Support wildcard permissions
    - **Resource ownership**: Users access only their own resources
    - **Admin separation**: Special handling for admin operations

=== "The Terminal Output"

    ```
    guest_user (guest):
      Can read own: false
      Can write any: false
      Can manage users: false

    viewer_user (viewer):
      Can read own: true
      Can write any: false
      Can manage users: false

    editor_user (editor):
      Can read own: true
      Can write any: false
      Can manage users: false

    admin_user (admin):
      Can read own: true
      Can write any: true
      Can manage users: true

    superadmin (super_admin):
      Can read own: true
      Can write any: true
      Can manage users: true
    ```

!!! danger "Admin Role Security"

    Admin roles require special protection:

    - Require MFA for admin accounts
    - Log all admin actions for audit
    - Implement admin approval workflows
    - Separate admin and user data stores
    - Use break-glass procedures for emergencies

## Authorization Testing

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "testing"
    )

    type AuthTest struct {
        Name        string
        UserID      string
        Resource    string
        Action      string
        Expected    bool
    }

    func TestRBACPermissions(t *testing.T) {
        rbac := NewRBACSystem()

        // Setup test data
        adminRole := rbac.CreateRole("admin", []string{"*"})
        editorRole := rbac.CreateRole("editor", []string{"read", "write"})
        viewerRole := rbac.CreateRole("viewer", []string{"read"})

        rbac.SetRoleParent(editorRole, viewerRole)

        rbac.mu.Lock()
        rbac.users["admin1"] = &User{ID: "admin1", Name: "Admin"}
        rbac.users["editor1"] = &User{ID: "editor1", Name: "Editor"}
        rbac.users["viewer1"] = &User{ID: "viewer1", Name: "Viewer"}
        rbac.mu.Unlock()

        rbac.AssignRole("admin1", adminRole)
        rbac.AssignRole("editor1", editorRole)
        rbac.AssignRole("viewer1", viewerRole)

        tests := []AuthTest{
            {"Admin can delete", "admin1", "document", "delete", true},
            {"Editor can write", "editor1", "document", "write", true},
            {"Editor cannot delete", "editor1", "document", "delete", false},
            {"Viewer can read", "viewer1", "document", "read", true},
            {"Viewer cannot write", "viewer1", "document", "write", false},
        }

        for _, tt := range tests {
            t.Run(tt.Name, func(t *testing.T) {
                result := rbac.CheckPermission(tt.UserID, tt.Action)
                if result != tt.Expected {
                    t.Errorf("Expected %v, got %v", tt.Expected, result)
                }
            })
        }
    }

    // Table-driven test for comprehensive coverage
    func TestRBACComprehensive(t *testing.T) {
        rbac := NewRBACSystem()

        // Define roles
        roles := map[string][]string{
            "super_admin": {"*"},
            "admin":       {"manage:users", "read:any", "write:any", "delete:any"},
            "editor":      {"read:own", "write:own", "delete:own"},
            "viewer":      {"read:own"},
            "guest":       {},
        }

        for name, perms := range roles {
            rbac.CreateRole(name, perms)
        }

        // Assign users
        testCases := []struct {
            userID   string
            role     string
            resource string
            action   string
            expected bool
        }{
            {"user1", "super_admin", "system", "delete", true},
            {"user2", "admin", "user3_data", "read", true},
            {"user3", "editor", "own_data", "write", true},
            {"user4", "viewer", "own_data", "read", true},
            {"user5", "guest", "public", "read", false},
        }

        for _, tc := range testCases {
            rbac.mu.Lock()
            rbac.users[tc.userID] = &User{ID: tc.userID}
            rbac.mu.Unlock()

            rbac.AssignRole(tc.userID, rbac.roles[tc.role])

            got := rbac.CheckPermission(tc.userID, tc.action)
            if got != tc.expected {
                fmt.Printf("FAIL: %s with role %s: expected %v, got %v\n",
                    tc.userID, tc.role, tc.expected, got)
            } else {
                fmt.Printf("PASS: %s with role %s: %v\n",
                    tc.userID, tc.role, got)
            }
        }
    }
    ```

=== "The Explanation"

    - **Table-driven tests**: Structured test cases for easy maintenance
    - **Comprehensive coverage**: Test all role combinations
    - **Clear assertions**: Descriptive test names and error messages
    - **Edge cases**: Test boundary conditions and negative cases

=== "The Terminal Output"

    ```
    PASS: user1 with role super_admin: true
    PASS: user2 with role admin: true
    PASS: user3 with role editor: true
    PASS: user4 with role viewer: true
    PASS: user5 with role guest: false
    --- PASS: TestRBACPermissions (0.00s)
    --- PASS: TestRBACComprehensive (0.00s)
    PASS
    ```

## Best Practices

| Practice | Description | Priority |
|----------|-------------|----------|
| Principle of least privilege | Grant minimum required permissions | Critical |
| Role hierarchy | Use inheritance for role management | High |
| Audit logging | Log all authorization decisions | High |
| Deny by default | Deny access unless explicitly granted | Critical |
| Regular review | Audit role assignments periodically | Medium |
| Separate duties | Split admin responsibilities | High |
| Test authorization | Comprehensive permission testing | High |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Permission denied unexpectedly | Check role inheritance and policy rules |
| Circular role hierarchy | Validate no circular dependencies |
| Policy not loading | Check policy file format and database connection |
| Performance issues | Use cached enforcer and optimize matchers |
| Debug authorization | Enable Casbin logging for detailed output |

## Summary

- RBAC simplifies permission management by grouping permissions into roles
- Authorization middleware provides clean separation of concerns
- Casbin offers flexible policy management with multiple access control models
- Resource-level permissions enable granular access control
- Admin roles require additional security measures
- Test authorization logic thoroughly with table-driven tests

## Next Steps

- [Authentication & JWT](authentication-jwt.md) - Implement user authentication
- [HTTPS & TLS](https-tls.md) - Secure communication channels
- [Security Hardening](hardening.md) - Production security configuration