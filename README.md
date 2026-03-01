# Layered Architecture Engine

A professional, high-performance execution engine designed for strictly layered software construction.

## Architecture

The system adheres to a strict layered structure:

- **src/domain**: Pure business logic and core type definitions.
- **src/infrastructure**: Adapters, AI Engine, persistence logic, and external services.
- **src/plumbing**: High-fidelity engineering utilities (FS, Shell, Concurrency).
- **src/ui**: Presentation layer and CLI adapters.

## Core Mandates

1. **Entropy Suppression**: Every architectural pass must reduce system complexity.
2. **Dependency Cleanliness**: Directional dependencies are strictly enforced (Domain -> Infrastructure -> Plumbing).
3. **Deterministic Output**: Multi-file, structured generation via specialized AI protocols.

## Installation

```bash
npm install
npm run build
```

## Usage

Start the engine CLI:

```bash
npm start
```

## Configuration

The engine stores configuration and telemetry in `~/.engine/`.

---

*Architectural Integrity Verified. Execution Active.*
