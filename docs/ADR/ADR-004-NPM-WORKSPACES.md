# ADR-004｜npm Workspaces

- Status：Accepted
- Date：2026-07-20

## Decision

使用 npm Workspaces，Commit `package-lock.json`，CI 使用 `npm ci`，MVP 不引入 Nx／Turborepo。

## Consequences

工具少、Windows 普遍；未來 Package／Build 大幅增加再評估。
