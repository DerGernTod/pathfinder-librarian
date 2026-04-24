---
name: testing
description: Use whenever writing or running tests
---

Whenever you run tests, pipe the test output into a text file in ./temp. This saves context and enables you to grep important info from it.

Whenever you write tests,

- consolidate tests with the same GIVEN and WHEN, and only a differing THEN
- always test production code, never implement code inside a test that is then tested
- never change production code just so you can test more easily (e.g. never export internal functionality that is not supposed to be used externally)
