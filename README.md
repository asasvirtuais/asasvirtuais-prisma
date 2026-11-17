# asasvirtuais-prisma

Prisma adapter for the `asasvirtuais` full-stack framework. It translates framework CRUD methods and query operators directly to your Prisma Client instance.

## Installation

```bash
pnpm add asasvirtuais-prisma
```

Works with `asasvirtuais` v5 and v6. Ensure you have `@prisma/client` and `zod` (v4.6+) installed in your project.

## Usage

### 1. Initialize Prisma Client

Create a utility file to instantiate and export the Prisma Client:

```typescript
// app/prisma.ts
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
```

### 2. Create the raw database interface

The adapter is the raw interface over your database that `asasvirtuais` expects in `app/db.ts`:

```typescript
// app/db.ts
import { prismaInterface } from 'asasvirtuais-prisma'
import { prisma } from './prisma'
import { schema } from './schema'

export const db = prismaInterface(schema, prisma)
```

### 3. Expose it through the CRUD file

Until the table middleware is written, `app/actions.ts` passes straight to it:

```typescript
// app/actions.ts
'use server'
import { db } from './db'

export const { find, list, create, update, remove } = db
```

Each method receives the `table` it was called for, and the adapter routes it to the matching Prisma model.

### 4. Table middleware

When each table gets its authorization rules, wrap the same `db` with `asasvirtuaisInterface` (asasvirtuais v6), typed
by the table's schema:

```typescript
// packages/todos/middleware.ts
import { asasvirtuaisInterface } from 'asasvirtuais/interface'
import { db } from '@/app/db'
import { schema } from './schema'

export const todos = asasvirtuaisInterface(schema, {
  find: async (props) => { /* authorization */ return db.find(props) },
  list: async (props) => { /* authorization */ return db.list(props) },
  create: async (props) => { /* authorization */ return db.create(props) },
  update: async (props) => { /* authorization */ return db.update(props) },
  remove: async (props) => { /* authorization */ return db.remove(props) },
})
```

The middleware holds the table's authorization only. Writes to several tables at once go in a custom server action
with a transaction, which calls `db` directly.

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
