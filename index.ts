import { z } from 'zod'
import type { DatabaseSchema, TableInterface } from 'asasvirtuais/interface'

export interface PrismaInterfaceOptions {
    modelNameMapping?: Record<string, string> | ((tableName: string) => string)
}

function buildOperators(value: Record<string, any>): any {
    const result: any = {}
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

export function buildWhere(query: any): any {
    if (!query || typeof query !== 'object') return undefined

    const where: any = {}

    for (const [key, value] of Object.entries(query)) {
        // Skip pagination/projection — handled separately by list()
        if (key === '$limit' || key === '$skip' || key === '$sort' || key === '$select') {
            continue
        }

        // Logical operators → recurse into each sub-query
        if (key === '$or' && Array.isArray(value)) {
            where.OR = value.map(sub => buildWhere(sub))
            continue
        }
        if (key === '$and' && Array.isArray(value)) {
            where.AND = value.map(sub => buildWhere(sub))
            continue
        }

        // Field-level comparison operators like { priority: { $gt: 5 } }
        if (isOperatorObject(value)) {
            where[key] = buildOperators(value as Record<string, any>)
            continue
        }

        // Direct equality match like { done: false }
        where[key] = value
    }

    return Object.keys(where).length > 0 ? where : undefined
}

export function prismaInterface<Schema extends DatabaseSchema>(
    schema: Schema,
    prisma: any,
    options?: PrismaInterfaceOptions
): TableInterface<z.infer<Schema[keyof Schema]['readable']>, z.infer<Schema[keyof Schema]['writable']>> {

    const getModel = (table: string) => {
        if (!table) throw new Error('Table name must be provided.')

        let modelKey: string | undefined

        if (options?.modelNameMapping) {
            if (typeof options.modelNameMapping === 'function') {
                modelKey = options.modelNameMapping(table)
            } else if (typeof options.modelNameMapping === 'object') {
                modelKey = options.modelNameMapping[table]
            }
        }

        if (!modelKey) {
            if (table in prisma) {
                modelKey = table
            } else {
                const singular = table.endsWith('s') ? table.slice(0, -1) : table
                const candidates = [table, singular]
                modelKey = Object.keys(prisma).find(k =>
                    candidates.some(c => c.toLowerCase() === k.toLowerCase())
                )
            }
        }

        const finalModelKey = modelKey || table
        const model = prisma[finalModelKey]
        if (!model) {
            throw new Error(`Prisma model '${finalModelKey}' (mapped from table '${table}') not found on prisma client.`)
        }
        return model
    }

    type GenericReadable = z.infer<Schema[keyof Schema]['readable']>
    type GenericWritable = z.infer<Schema[keyof Schema]['writable']>

    const methods = {
        async find({ table, id }) {
            if (!table) throw new Error('Table name must be provided.')
            const model = getModel(table)
            const record = await model.findUnique({ where: { id } })
            if (!record) {
                throw new Error(`Record with id ${id} not found in ${table}`)
            }
            return record as GenericReadable
        },

        async list({ table, query }) {
            if (!table) throw new Error('Table name must be provided.')
            const model = getModel(table)
            const args: any = {}

            if (query) {
                const { $limit, $skip, $sort, $select, ...filters } = query

                const where = buildWhere(filters)
                if (where) args.where = where

                if ($limit !== undefined) args.take = $limit
                if ($skip  !== undefined) args.skip = $skip

                if ($sort && typeof $sort === 'object') {
                    args.orderBy = Object.entries($sort).map(([field, dir]) => ({
                        [field]: dir === -1 ? 'desc' : 'asc'
                    }))
                }

                if ($select && Array.isArray($select)) {
                    const select: any = {}
                    for (const field of $select) select[field as string] = true
                    args.select = select
                }
            }

            return await model.findMany(args) as GenericReadable[]
        },

        async create({ table, data }) {
            if (!table) throw new Error('Table name must be provided.')
            const model = getModel(table)
            const record = await model.create({
                data
            })
            return record as GenericReadable
        },

        async update({ table, id, data }) {
            if (!table) throw new Error('Table name must be provided.')
            const model = getModel(table)
            const record = await model.update({
                where: { id },
                data
            })
            return record as GenericReadable
        },

        async remove({ table, id }) {
            if (!table) throw new Error('Table name must be provided.')
            const model = getModel(table)
            const record = await model.delete({
                where: { id }
            })
            return record as GenericReadable
        },
    } as TableInterface<GenericReadable, GenericWritable>

    return methods
}

export default prismaInterface
