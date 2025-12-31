# Contributing to Conductor

Thank you for your interest in contributing to Conductor! This project aims to provide a self-contained, offline-first mobile app for coordinating synchronized real-world actions.

## License

By contributing to this project, you agree that your contributions will be licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). See the [LICENSE](LICENSE) file for details.

## Getting Started

### Prerequisites

- **Android Development**:
  - Android Studio (or IntelliJ IDEA with Android plugin)
  - JDK 17+
  - Android SDK with API 34+

- **iOS Development** (requires macOS):
  - Xcode 15+
  - CocoaPods

### Building

```bash
cd conductor-mobile

# Android debug build
./gradlew assembleDebug

# Run tests
./gradlew test
```

## How to Contribute

### Reporting Issues

- Search existing issues before creating a new one
- Include steps to reproduce the problem
- Include device info and Android/iOS version
- Attach relevant logs if available

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run tests and ensure they pass
5. Commit with clear, descriptive messages
6. Push to your fork and submit a pull request

### Pull Request Guidelines

- Keep changes focused and atomic
- Update documentation if needed
- Add tests for new functionality
- Follow existing code style and conventions
- Ensure CI passes before requesting review

## Code Style

- **Kotlin**: Follow [Kotlin coding conventions](https://kotlinlang.org/docs/coding-conventions.html)
- **Swift**: Follow [Swift API Design Guidelines](https://swift.org/documentation/api-design-guidelines/)
- Use meaningful variable and function names
- Keep functions focused and reasonably sized
- Comment complex logic, but prefer self-documenting code

## Architecture Notes

Conductor uses Kotlin Multiplatform (KMP) to share core logic between Android and iOS:

- `shared/` - Multiplatform code (timing, encoding, models)
- `androidApp/` - Android-specific UI and platform code
- `iosApp/` - iOS-specific UI and platform code (future)

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

## Questions?

Open an issue for questions or discussion about potential changes.
