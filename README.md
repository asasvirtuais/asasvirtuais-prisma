# asasvirtuais-prisma

Prisma adapter for the `asasvirtuais` full-stack framework. It translates framework CRUD methods and query operators directly to your Prisma Client instance.

## Installation

```bash
pnpm add asasvirtuais-prisma
```

Ensure you have `@prisma/client` and `zod` installed in your project.

## Usage

### 1. Initialize Prisma Client

Create a utility file to instantiate and export the Prisma Client:

```typescript
// app/prisma.ts
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
```

### 2. Configure Database Interface

Import the database schema and the Prisma Client instance to configure your framework server actions:

```typescript
// app/actions.ts
'use server'

import { makeSchemaTableInterface } from 'asasvirtuais/interface'
import { prismaInterface } from 'asasvirtuais-prisma'
import { prisma } from './prisma'
import { schema } from './schema'

// Initialize adapter
const db = prismaInterface(schema, prisma)

export const { find, list, create, update, remove } = makeSchemaTableInterface(schema, null, {
  find: async (props) => db.find(props),
  list: async (props) => db.list(props),
  create: async (props) => db.create(props),
  update: async (props) => db.update(props),
  remove: async (props) => db.remove(props),
})!
```

---

## Aligning Table Names & Prisma Models

The adapter automatically aligns plural framework table names to singular/case-insensitive model keys on your Prisma Client:

* If your framework table is `'todos'`, it automatically matches `prisma.todo` or `prisma.Todo`.
* If your framework table is `'tags'`, it matches `prisma.tag` or `prisma.Tag`.

### Custom Model Mapping (`modelMap`)

For complex naming alignments that fall outside standard singularization, you can pass custom mapping rules through the `modelMap` option:

```typescript
const db = prismaInterface(schema, prisma, {
  modelMap: {
    // Override explicit mapping
    people: 'person'
  }
})
```
