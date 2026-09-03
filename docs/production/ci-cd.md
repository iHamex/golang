# CI/CD

Continuous Integration and Continuous Deployment pipelines ensure code quality, security, and reliability throughout the development lifecycle. Go's fast compilation, built-in testing, and tooling ecosystem make it well-suited for automated pipelines.

## What You Will Learn

- Building GitHub Actions workflows for Go projects
- Configuring GitLab CI pipelines
- Running `go test` and `go build` in CI environments
- Linting with golangci-lint
- Scanning for vulnerabilities with govulncheck
- Measuring and enforcing code coverage
- Automating releases with GoReleaser
- Implementing semantic versioning

## Prerequisites

- Familiarity with [Go modules](/docs/fundamentals/modules.md)
- Basic knowledge of Git and version control
- Understanding of [testing in Go](/docs/fundamentals/testing.md)

---

## GitHub Actions Workflow

=== "The Code"

    ```yaml
    # .github/workflows/ci.yml
    name: CI

    on:
      push:
        branches: [main]
      pull_request:
        branches: [main]

    env:
      GO_VERSION: "1.22"

    jobs:
      test:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4

          - name: Set up Go
            uses: actions/setup-go@v5
            with:
              go-version: ${{ env.GO_VERSION }}
              cache: true

          - name: Download dependencies
            run: go mod download

          - name: Verify dependencies
            run: go mod verify

          - name: Run unit tests
            run: go test -v -race -coverprofile=coverage.out ./...

          - name: Upload coverage
            uses: codecov/codecov-action@v4
            with:
              files: ./coverage.out

      lint:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4

          - name: Set up Go
            uses: actions/setup-go@v5
            with:
              go-version: ${{ env.GO_VERSION }}

          - name: Run golangci-lint
            uses: golangci/golangci-lint-action@v4
            with:
              version: latest

      security:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4

          - name: Set up Go
            uses: actions/setup-go@v5
            with:
              go-version: ${{ env.GO_VERSION }}

          - name: Install govulncheck
            run: go install golang.org/x/vuln/cmd/govulncheck@latest

          - name: Run govulncheck
            run: govulncheck ./...

      build:
        runs-on: ubuntu-latest
        needs: [test, lint, security]
        steps:
          - uses: actions/checkout@v4

          - name: Set up Go
            uses: actions/setup-go@v5
            with:
              go-version: ${{ env.GO_VERSION }}

          - name: Build binary
            run: |
              CGO_ENABLED=0 go build \
                -ldflags="-s -w" \
                -o bin/server .

          - name: Upload binary artifact
            uses: actions/upload-artifact@v4
            with:
              name: server-linux-amd64
              path: bin/server
    ```

=== "The Explanation"

    - **`cache: true`**: Caches Go modules to speed up subsequent builds
    - **`go test -race`**: Detects race conditions during testing
    - **`-coverprofile`**: Generates coverage data for reporting
    - **`needs: [test, lint, security]`**: Build only runs after all checks pass
    - **`golangci-lint-action`**: Installs and runs the linter automatically

=== "The Terminal Output"

    ```
    ✓ Set up Go 1.22
    ✓ Download dependencies
    ✓ Verify dependencies
    ✓ Run unit tests (123 passed, 0 failed)
    ✓ Coverage: 87.3%
    ✓ golangci-lint: no issues found
    ✓ govulncheck: no vulnerabilities found
    ✓ Build binary
    ```

---

## GitLab CI Pipeline

=== "The Code"

    ```yaml
    # .gitlab-ci.yml
    image: golang:1.22-alpine

    stages:
      - test
      - lint
      - security
      - build
      - deploy

    variables:
      GOFLAGS: "-mod=readonly"

    cache:
      key: ${CI_COMMIT_REF_SLUG}
      paths:
        - .go-cache/

    test:
      stage: test
      script:
        - go mod download
        - go mod verify
        - go test -v -race -coverprofile=coverage.out ./...
        - go tool cover -func=coverage.out
      artifacts:
        reports:
          coverage_report:
            coverage_format: cobertura
            path: coverage.out

    lint:
      stage: lint
      image: golangci/golangci-lint:latest
      script:
        - golangci-lint run

    security:
      stage: security
      script:
        - go install golang.org/x/vuln/cmd/govulncheck@latest
        - govulncheck ./...

    build:
      stage: build
      script:
        - CGO_ENABLED=0 GOOS=linux GOARCH=amd64
          go build -ldflags="-s -w -X main.version=${CI_COMMIT_TAG}"
          -o bin/server .
      artifacts:
        paths:
          - bin/
        expire_in: 1 week
      only:
        - tags

    deploy:
      stage: deploy
      script:
        - echo "Deploying version ${CI_COMMIT_TAG}"
      only:
        - tags
      when: manual
    ```

=== "The Explanation"

    - **Stages**: Run sequentially — test, lint, security, build, deploy
    - **Cache**: Go modules cached per branch to speed up builds
    - **Artifacts**: Binary and coverage reports stored for download
    - **`only: tags`**: Build and deploy only run on tagged commits
    - **`when: manual`**: Deploy requires manual trigger

### GitHub Actions vs GitLab CI

| Feature | GitHub Actions | GitLab CI |
|---|---|---|
| **Config file** | `.github/workflows/` | `.gitlab-ci.yml` |
| **Runner OS** | ubuntu, windows, macos | docker, shell, kubernetes |
| **Caching** | `actions/cache` | Built-in `cache` |
| **Secrets** | Repository/Environment secrets | CI/CD Variables |
| **Artifacts** | `actions/upload-artifact` | `artifacts` keyword |
| **Matrix builds** | `strategy.matrix` | `parallel: matrix` |

---

## Linting with golangci-lint

=== "The Code"

    ```yaml
    # .golangci.yml
    run:
      timeout: 5m
      go: "1.22"

    linters:
      enable:
        - errcheck
        - gosimple
        - govet
        - ineffassign
        - staticcheck
        - unused
        - gocritic
        - gofmt
        - goimports
        - misspell
        - unconvert
        - unparam
        - bodyclose
        - contextcheck
        - errname
        - errorlint
        - exhaustive
        - goconst
        - gocognit
        - gosec
        - prealloc
        - revive
        - stylecheck

    linters-settings:
      errcheck:
        check-type-assertions: true
      gocritic:
        enabled-tags:
          - diagnostic
          - performance
          - style
      revive:
        rules:
          - name: exported
            arguments:
              - "checkPrivateReceivers"

    issues:
      exclude-rules:
        - path: _test\.go
          linters:
            - gosec
            - unparam
    ```

=== "The Explanation"

    - **`errcheck`**: Detects unchecked errors
    - **`govet`**: Reports suspicious constructs (shadow variables, struct tags)
    - **`staticcheck`**: Comprehensive static analysis
    - **`gocritic`**: Opinionated linter with diagnostic, performance, and style checks
    - **`gosec`**: Security-related issues
    - **Test exclusions**: Some linters are less useful in test files

=== "The Terminal Output"

    ```bash
    $ golangci-lint run ./...
    main.go:15:2: error return value of `fmt.Fprintf` is not checked (errcheck)
    main.go:23:9: receiver name should not be an underscore, omit the name if it is unused (revive)
    main.go:45:2: should use `errors.Is(err, target)` instead of `err == target` (errorlint)

    $ golangci-lint run ./...
    level=info msg="No issues found"
    ```

!!! note "Pre-commit Hook"

    Add golangci-lint as a pre-commit hook to catch issues before committing:

    ```yaml
    # .pre-commit-config.yaml
    repos:
      - repo: https://github.com/golangci/golangci-lint
        rev: v1.59.0
        hooks:
          - id: golangci-lint
    ```

---

## Security Scanning

=== "The Code"

    ```bash
    # Check for known vulnerabilities in dependencies
    $ govulncheck ./...

    # Scan with verbose output
    $ govulncheck -v ./...

    # Scan specific package
    $ govulncheck ./cmd/server/...

    # Output as JSON for CI integration
    $ govulncheck -json ./... > vuln-report.json
    ```

=== "The Explanation"

    - **`govulncheck`**: Official Go vulnerability checker using the Go vulnerability database
    - **Binary analysis**: Checks compiled binaries, not just source code
    - **Call analysis**: Only reports vulnerabilities in code paths that actually call vulnerable functions
    - **Zero false positives**: Only reports exploitable vulnerabilities

=== "The Terminal Output"

    ```bash
    $ govulncheck ./...
    Vulnerability #1: GO-2024-1234
      Module: golang.org/x/net
      Package: golang.org/x/net/html
      Affected versions: <0.23.0
      Patched versions: >=0.23.0

      Your code is not affected. The vulnerable function is not called.

    $ govulncheck ./...
    No vulnerabilities found.
    ```

---

## Code Coverage

=== "The Code"

    ```bash
    # Generate coverage report
    $ go test -coverprofile=coverage.out ./...

    # View coverage by function
    $ go tool cover -func=coverage.out

    # Generate HTML report
    $ go tool cover -html=coverage.out -o coverage.html

    # View coverage in terminal
    $ go test -cover ./...
    ok  example.com/myapp      0.234s  coverage: 87.3% of statements
    ok  example.com/myapp/api  0.156s  coverage: 92.1% of statements
    ok  example.com/myapp/db   0.089s  coverage: 78.5% of statements
    ```

=== "The Explanation"

    - **`-coverprofile`**: Outputs coverage data to a file
    - **`-func`**: Shows coverage percentage per function
    - **`-html`**: Generates an interactive HTML report
    - **Coverage threshold**: Enforce minimum coverage in CI with a threshold check

=== "The Terminal Output"

    ```bash
    $ go tool cover -func=coverage.out
    total:  (statements)  87.3%

    example.com/myapp/main.go:10:    main            100.0%
    example.com/myapp/api/handler.go:20:  GetUser      95.0%
    example.com/myapp/db/query.go:15: QueryUser      78.5%
    ```

### Coverage Enforcement in CI

=== "The Code"

    ```yaml
    # In GitHub Actions workflow
    - name: Check coverage threshold
      run: |
        go test -coverprofile=coverage.out ./...
        COVERAGE=$(go tool cover -func=coverage.out | tail -1 | awk '{print $3}' | tr -d '%')
        echo "Coverage: ${COVERAGE}%"
        if (( $(echo "$COVERAGE < 80" | bc -l) )); then
          echo "Coverage ${COVERAGE}% is below 80% threshold"
          exit 1
        fi
    ```

=== "The Explanation"

    - **Extract coverage**: Parse the total coverage percentage from `go tool cover`
    - **Threshold check**: Fail the build if coverage drops below 80%
    - **`bc -l`**: Bash calculator for floating-point comparison

---

## Release Automation with GoReleaser

=== "The Code"

    ```yaml
    # .goreleaser.yml
    project_name: myapp

    before:
      hooks:
        - go mod tidy
        - go generate ./...

    builds:
      - id: server
        main: ./cmd/server
        binary: server
        env:
          - CGO_ENABLED=0
        goos:
          - linux
          - darwin
          - windows
        goarch:
          - amd64
          - arm64
        ldflags:
          - -s -w
          - -X main.version={{.Version}}
          - -X main.commit={{.Commit}}
          - -X main.buildDate={{.Date}}

    archives:
      - id: default
        format: tar.gz
        format_overrides:
          - goos: windows
            format: zip
        name_template: "{{.ProjectName}}_{{.Version}}_{{.Os}}_{{.Arch}}"

    checksum:
      name_template: "checksums.txt"
      algorithm: sha256

    snapshot:
      name_template: "{{ incpatch .Version }}-next"

    changelog:
      sort: asc
      filters:
        exclude:
          - "^docs:"
          - "^test:"
          - "^ci:"

    dockers:
      - image_templates:
          - "ghcr.io/myorg/myapp:{{ .Version }}-amd64"
        use: buildx
        build_flag_templates:
          - "--platform=linux/amd64"
        dockerfile: Dockerfile.goreleaser

    release:
      github:
        owner: myorg
        name: myapp
      draft: false
      prerelease: auto
    ```

=== "The Explanation"

    - **`before.hooks`**: Runs commands before building (tidy modules, generate code)
    - **`builds`**: Cross-compiles for multiple OS/architecture combinations
    - **`ldflags`**: Embeds version, commit, and build date at compile time
    - **`archives`**: Creates platform-specific archives (tar.gz for Unix, zip for Windows)
    - **`dockers`**: Builds Docker images for each platform
    - **`release`**: Publishes to GitHub Releases with auto-generated changelog

=== "The Terminal Output"

    ```bash
    $ goreleaser release --clean

    • dry running...
    • building binaries...
       • amd64 > dist/server_linux_amd64_v1/server
       • arm64 > dist/server_linux_arm64/server
       • amd64 > dist/server_darwin_amd64/server
       • arm64 > dist/server_darwin_arm64_v1/server
    • generating archives...
    • generating checksums...
    • docker images...
    • releasing...
       • created release v1.2.3 on GitHub
    ```

---

## Semantic Versioning

=== "The Code"

    ```bash
    # Create a new version tag
    $ git tag -a v1.2.3 -m "Release v1.2.3"
    $ git push origin v1.2.3

    # Create a pre-release tag
    $ git tag -a v1.3.0-rc1 -m "Release candidate 1"
    $ git push origin v1.3.0-rc1

    # GoReleaser snapshot (no tag required)
    $ goreleaser release --snapshot --clean
    ```

=== "The Explanation"

    - **`MAJOR.MINOR.PATCH`**: Semantic version format
    - **MAJOR**: Breaking changes
    - **MINOR**: New features (backward-compatible)
    - **PATCH**: Bug fixes (backward-compatible)
    - **Pre-release**: `-rc1`, `-beta.1`, `-alpha.2`

### Version Tagging Strategy

| Tag | Trigger | Use Case |
|---|---|---|
| `v1.2.3` | Release | Production deployment |
| `v1.2.3-rc1` | Pre-release | Testing phase |
| `v1.2.3-beta.1` | Beta | Early adopter testing |
| `v0.1.0` | Initial | First release |

=== "The Code"

    ```go
    package main

    import (
        "fmt"
        "os"
        "runtime"
    )

    var (
        version   = "dev"
        commit    = "none"
        buildDate = "unknown"
    )

    func main() {
        if len(os.Args) > 1 && os.Args[1] == "version" {
            fmt.Printf("Version:    %s\n", version)
            fmt.Printf("Commit:     %s\n", commit)
            fmt.Printf("Built:      %s\n", buildDate)
            fmt.Printf("Go Version: %s\n", runtime.Version())
            fmt.Printf("OS/Arch:    %s/%s\n", runtime.GOOS, runtime.GOARCH)
            return
        }

        fmt.Println("Server starting...")
    }
    ```

=== "The Explanation"

    - **`-ldflags -X`**: Injects version variables at build time
    - **GoReleaser variables**: `{{.Version}}`, `{{.Commit}}`, `{{.Date}}` are replaced automatically
    - **`dev` default**: Used during local development without tags

=== "The Terminal Output"

    ```bash
    $ ./server version
    Version:    1.2.3
    Commit:     a1b2c3d
    Built:      2026-09-03T10:00:00Z
    Go Version: go1.22.5
    OS/Arch:    linux/amd64
    ```

---

## Full CI/CD Pipeline

=== "The Code"

    ```yaml
    # .github/workflows/release.yml
    name: Release

    on:
      push:
        tags:
          - "v*"

    permissions:
      contents: write
      packages: write

    jobs:
      test:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-go@v5
            with:
              go-version: "1.22"
          - run: go test -race -coverprofile=coverage.out ./...
          - uses: codecov/codecov-action@v4
            with:
              files: ./coverage.out

      lint:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-go@v5
            with:
              go-version: "1.22"
          - uses: golangci/golangci-lint-action@v4

      security:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-go@v5
            with:
              go-version: "1.22"
          - run: go install golang.org/x/vuln/cmd/govulncheck@latest
          - run: govulncheck ./...

      release:
        needs: [test, lint, security]
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
            with:
              fetch-depth: 0
          - uses: actions/setup-go@v5
            with:
              go-version: "1.22"

          - name: Login to GHCR
            uses: docker/login-action@v3
            with:
              registry: ghcr.io
              username: ${{ github.actor }}
              password: ${{ secrets.GITHUB_TOKEN }}

          - name: Run GoReleaser
            uses: goreleaser/goreleaser-action@v5
            with:
              version: latest
              args: release --clean
            env:
              GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    ```

=== "The Explanation"

    - **Tag-triggered**: Release workflow runs only on version tags
    - **Permissions**: Explicitly requests write access for releases and packages
    - **GHCR login**: Pushes Docker images to GitHub Container Registry
    - **GoReleaser action**: Builds, archives, and publishes to GitHub Releases

=== "The Terminal Output"

    ```bash
    $ git tag -a v1.2.3 -m "Release v1.2.3"
    $ git push origin v1.2.3

    # GitHub Actions automatically:
    # 1. Runs tests
    # 2. Lints code
    # 3. Scans for vulnerabilities
    # 4. Builds binaries for linux/darwin/windows (amd64/arm64)
    # 5. Creates GitHub Release with binaries
    # 6. Pushes Docker image to GHCR
    ```

---

## Best Practices

| Practice | Description | Priority |
|---|---|---|
| Run tests on every PR | Block merges with failing tests | Critical |
| Enforce coverage threshold | Fail builds below minimum coverage | High |
| Lint in CI | Use golangci-lint with comprehensive config | High |
| Scan for vulnerabilities | Run govulncheck in every pipeline | Critical |
| Cache Go modules | Speed up builds with module caching | Medium |
| Tag-based releases | Trigger releases from version tags | High |
| GoReleaser | Automate cross-compilation and publishing | High |
| Semantic versioning | Follow MAJOR.MINOR.PATCH format | High |

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Tests fail in CI but pass locally | Missing environment variables | Use CI secrets and env vars |
| Build cache not working | Cache key too broad | Use `go.sum` hash as cache key |
| govulncheck finds vulnerabilities | Outdated dependencies | Run `go get -u ./...` and test |
| GoReleaser fails on tags | Missing permissions | Add `contents: write` permission |
| Docker build fails in CI | Multi-platform build issues | Use `docker/setup-buildx-action` |
| Coverage drops unexpectedly | New code without tests | Add tests before merging |

## Summary

- GitHub Actions and GitLab CI provide robust Go project pipelines
- `go test -race -coverprofile` detects races and measures coverage
- golangci-lint catches common issues and enforces code style
- govulncheck identifies exploitable vulnerabilities in dependencies
- GoReleaser automates cross-compilation, archiving, and GitHub Releases
- Semantic versioning with tags triggers automated release workflows
- CI caching and dependency verification improve build speed and reliability

## Next Steps

- [Deployment](/docs/production/deployment.md) — Deploying release artifacts
- [Containerization](/docs/production/containerization.md) — Building container images in CI
- [Observability](/docs/production/observability.md) — Monitoring deployed releases
- [Performance](/docs/production/performance.md) — Benchmarking in CI pipelines
