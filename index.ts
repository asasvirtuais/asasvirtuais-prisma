import { z } from 'zod'
import type { DatabaseSchema, TableInterface } from 'asasvirtuais/interface'

export interface PrismaInterfaceOptions {
    modelMap?: Record<string, string> | ((table: string) => string)
}

function buildOperators(value: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [op, opValue] of Object.entries(value)) {
        switch (op) {
            case '$ne':  result.not   = opValue; break
            case '$lt':  result.lt    = opValue; break
            case '$lte': result.lte   = opValue; break
            case '$gt':  result.gt    = opValue; break
            case '$gte': result.gte   = opValue; break
            case '$in':  result.in    = opValue; break
            case '$nin': result.notIn = opValue; break
        }
    }
    return result
}

function isOperatorObject(value: any): boolean {
    return (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).some(k => k.startsWith('$'))
    )
}

export function buildWhere(query: any): Record<string, any> | undefined {
    if (!query || typeof query !== 'object') return undefined

    const where: Record<string, any> = {}

    for (const [key, value] of Object.entries(query)) {
        if (key === '$limit' || key === '$skip' || key === '$sort' || key === '$select') {
            continue
        }

        if (key === '$or' && Array.isArray(value)) {
            where.OR = value.map(sub => buildWhere(sub))
            continue
        }
        if (key === '$and' && Array.isArray(value)) {
            where.AND = value.map(sub => buildWhere(sub))
            continue
        }

        if (isOperatorObject(value)) {
            where[key] = buildOperators(value as Record<string, any>)
            continue
        }

        where[key] = value
    }

    return Object.keys(where).length > 0 ? where : undefined
}

export function prismaInterface<Schema extends DatabaseSchema>(
    schema: Schema,
    prisma: Record<string, any>,
    options?: PrismaInterfaceOptions,
): TableInterface<z.infer<Schema[keyof Schema]['readable']>, z.infer<Schema[keyof Schema]['writable']>> {

    const getModel = (table: string) => {
        if (!table) throw new Error('Table name must be provided.')

        let modelName: string | undefined

        // 1. Try explicit user mapping first
        if (options?.modelMap) {
            if (typeof options.modelMap === 'function') {
                modelName = options.modelMap(table)
            } else if (typeof options.modelMap === 'object' && options.modelMap[table]) {
                modelName = options.modelMap[table]
            }
        }

        // 2. Try exact match on Prisma Client
        if (!modelName && prisma[table]) {
            modelName = table
        }

        // 3. Fallback to automatic singular/case mapping (e.g. "todos" -> "todo" or "Todo")
        if (!modelName) {
            const singular = table.endsWith('s') ? table.slice(0, -1) : table
            const candidates = [table, singular]
            
            // Search case-insensitively across Prisma Client model keys
            modelName = Object.keys(prisma).find(key =>
                candidates.some(c => c.toLowerCase() === key.toLowerCase())
            )
        }

        const finalModelName = modelName || table
        const model = prisma[finalModelName]
        if (!model) throw new Error(`Prisma model '${finalModelName}' (mapped from table '${table}') not found on prisma client.`)
        return model
    }

    type GenericReadable = z.infer<Schema[keyof Schema]['readable']>
    type GenericWritable = z.infer<Schema[keyof Schema]['writable']>

    const methods = {
        async find({ table, id }) {
            if (!table) throw new Error('Table name must be provided.')
            const record = await getModel(table).findUnique({ where: { id } })
            if (!record) throw new Error(`Record with id ${id} not found in ${table}`)
            return record as GenericReadable
        },

        async list({ table, query }) {
            if (!table) throw new Error('Table name must be provided.')
            const { $limit, $skip, $sort, $select, ...filters } = query ?? {}

            const args: Record<string, any> = {}

            const where = buildWhere(filters)
            if (where) args.where = where

            if ($sort && typeof $sort === 'object') {
                args.orderBy = Object.entries($sort).map(([key, dir]) => ({
                    [key]: dir === -1 ? 'desc' : 'asc'
                }))
            }

            if ($skip) {
                args.skip = $skip
            }
            if ($limit) {
                args.take = $limit
            }

            if ($select && Array.isArray($select)) {
                const select: Record<string, boolean> = {}
                for (const field of $select) select[field as string] = true
                args.select = select
            }

            const results = await getModel(table).findMany(args)
            return results as GenericReadable[]
        },

        async create({ table, data }) {
            if (!table) throw new Error('Table name must be provided.')
            const record = await getModel(table).create({ data })
            return record as GenericReadable
        },

        async update({ table, id, data }) {
            if (!table) throw new Error('Table name must be provided.')
            const record = await getModel(table).update({
                where: { id },
                data,
            })
            return record as GenericReadable
        },

        async remove({ table, id }) {
            if (!table) throw new Error('Table name must be provided.')
            const record = await getModel(table).delete({
                where: { id },
            })
            return record as GenericReadable
        },
    } as TableInterface<GenericReadable, GenericWritable>

    return methods
}

export default prismaInterface
