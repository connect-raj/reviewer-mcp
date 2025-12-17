# Code Review Instructions

This file contains custom instructions for the MCP code reviewer. The reviewer will analyze PRs and code against these guidelines.

## Security

- Check for hardcoded credentials, API keys, or secrets
- Ensure user inputs are validated and sanitized
- Verify SQL queries use parameterized statements
- Check for exposed sensitive data in logs or error messages
- Ensure authentication and authorization are properly implemented

## Performance

- Look for inefficient loops or nested iterations
- Check for unnecessary database queries (N+1 problems)
- Verify proper use of caching where applicable
- Flag synchronous operations that should be asynchronous
- Check for memory leaks or improper resource disposal

## Code Quality

- Functions should be under 50 lines when possible
- Maximum nesting depth of 3 levels
- Avoid duplicate code - suggest refactoring
- Variable and function names should be descriptive
- Prefer early returns over deep nesting

## Documentation

- All public functions must have JSDoc/docstring comments
- Complex logic should have inline comments explaining why, not what
- README should be updated if public API changes
- Breaking changes must be documented

## Testing

- New features must include unit tests
- Edge cases should be tested
- Critical paths need integration tests
- Test coverage should not decrease

## Style (Language-Specific)

### JavaScript/TypeScript
- Use `const` by default, `let` when reassignment needed, avoid `var`
- Prefer arrow functions for callbacks
- Use async/await over raw promises
- Prefer template literals over string concatenation

### Python
- Follow PEP 8 style guidelines
- Use type hints for function signatures
- Prefer list comprehensions for simple transformations
- Use context managers (`with`) for resource handling

## Team Conventions

- PR title should follow conventional commits format (feat:, fix:, docs:, etc.)
- Commits should be atomic and well-described
- No commented-out code in final PR
- Remove console.log/print statements before merging

## Review Tone

- Be constructive and polite
- Explain the "why" behind suggestions
- Acknowledge good patterns when you see them
- Suggest improvements, don't just criticize
