import { TrxContext, TrxTask } from '@cotto/idb-wrapper';
import { bundle, afterOnce } from '@cotto/utils.ts';

export interface RangeSelector {
    (range: typeof IDBKeyRange): IDBKeyRange;
}

/**
 * get a record count
 *
 * @export
 * @param {string} storeName
 * @returns {TrxTask<any, number>}
 */
export function count(storeName: string): TrxTask<any, number> {
    return function countTask(_, ctx) {
        const store = ctx.trx.objectStore(storeName);
        const req = store.count();
        req.onsuccess = justResult(ctx);
        req.onerror = justError(ctx);
    };
}

/**
 * get a single record
 *
 * @export
 * @template T
 * @template any
 * @param {string} storeName
 * @returns {TrxTask<number, T>}
 */
export function get<T = any>(storeName: string): TrxTask<number, T>;
export function get<T = any>(storeName: string, key: number): TrxTask<any, T>;
export function get<T = any>(storeName: string, key?: number): TrxTask<any, T> {
    return function getTask(value, ctx) {
        key && (value = key);


        if (!value) {
            const error = new TypeError(`Missing the key of record at TrxProcessor[${ctx.index}]`);
            return ctx.next(error);
        }

        const store = ctx.trx.objectStore(storeName);
        const req = store.get(value);
        req.onsuccess = justResult(ctx);
        req.onerror = justError(ctx);
    };
}

/**
 * get all record
 *
 * @export
 * @template T
 * @template any
 * @param {string} storeName
 * @returns {TrxTask<any, T[]>}
 */
export function getAll<T = any>(storeName: string): TrxTask<any, T[]> {
    return function getAllTask(_, ctx) {
        const store = ctx.trx.objectStore(storeName);
        const req = store.openCursor();
        req.onsuccess = cursorResult(ctx);
        req.onerror = justError(ctx);
    };
}

/**
 * get records by IDBKeyRange
 *
 * @export
 * @template T
 * @template any
 * @param {string} storeName
 * @returns {TrxTask<RangeSelector, T[]>}
 */
export function getByRange<T = any>(storeName: string): TrxTask<RangeSelector, T[]>;
export function getByRange<T = any>(storeName: string, selector: RangeSelector): TrxTask<any, T[]>;
export function getByRange<T = any>(storeName: string, selector?: RangeSelector): TrxTask<any, T[]> {
    return function getByRangeTask(fn, ctx) {
        selector && (fn = selector);

        if (typeof fn !== 'function') {
            ctx.next(new TypeError('invalid range selector'));
        }

        const store = ctx.trx.objectStore(storeName);
        const req = store.openCursor(fn(ctx.range));
        req.onsuccess = cursorResult(ctx);
        req.onerror = justError(ctx);
    };
}


/**
 * set a single record
 *
 * @export
 * @template T
 * @template any
 * @param {string} storeName
 * @returns {TrxTask<T, number>}
 */
export function set<T = any>(storeName: string): TrxTask<T, number>;
export function set<T = any>(storeName: string, record: T): TrxTask<any, number>;
export function set<T = any>(storeName: string, record?: T): TrxTask<any, number> {
    return function task(value, ctx) {
        record && (value = record);
        const store = ctx.trx.objectStore(storeName);
        const req = store.put(value);
        req.onsuccess = justResult(ctx);
        req.onerror = justError(ctx);
    };
}

/**
 * delete a single record
 *
 * @export
 * @param {string} storeName
 * @returns {TrxTask<number, number>}
 */
export function del(storeName: string): TrxTask<number, number>;
export function del(storeName: string, key: number): TrxTask<any, number>;
export function del(storeName: string, key?: number): TrxTask<any, number> {
    return function task(value, ctx) {
        key && (value = key);
        const store = ctx.trx.objectStore(storeName);
        const req = store.delete(value);
        req.onsuccess = function (this: IDBRequest) {
            ctx.next(value);
        };
        req.onerror = justError(ctx);
    };
}

/**
 * clear a store records
 *
 * @export
 * @param {string} storeName
 * @returns {TrxTask<any, void>}
 */
export function clear(storeName: string): TrxTask<any, void> {
    return function task(_, ctx) {
        const store = ctx.trx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = justResult(ctx);
        req.onerror = justError(ctx);
    };
}

export namespace batch {
    /* tslint:disable:no-shadowed-variable */

    /**
     * set multi records
     *
     * @export
     * @template T
     * @template any
     * @param {string} storeName
     * @returns {TrxTask<T[], number[]>}
     */
    export function set<T = any>(storeName: string): TrxTask<T[], number[]>;
    export function set<T = any>(storeName: string, records: T[]): TrxTask<any, number[]>;
    export function set<T = any>(storeName: string, records?: T[]): TrxTask<any, number[]> {
        return taskFactory('set', storeName, records);
    }

    /**
     * delete multi records
     *
     * @export
     * @param {string} storeName
     * @returns {TrxTask<any, number[]>}
     */
    export function del(storeName: string): TrxTask<number[], number[]>;
    export function del(storeName: string, keys: number[]): TrxTask<any, number[]>;
    export function del(storeName: string, keys?: any[]): TrxTask<number[], number[]> {
        return taskFactory('del', storeName, keys);
    }

    function taskFactory(mode: 'set' | 'del', storeName: string, items?: any[]) {
        return function ($items: any[], ctx: TrxContext<any[]>) {
            $items = items || $items || [];
            const result: any[] = [];
            const store = ctx.trx.objectStore(storeName);
            const end = afterOnce($items.length, ctx.next.bind(ctx, mode === 'set' ? result : $items));
            const push = (e: Event) => result.push((e.target as IDBRequest).result);
            const onsuccess = bundle(push, end);
            const onerror = justError(ctx);

            $items.forEach((v: any) => {
                const req = mode === 'set' ? store.put(v) : store.delete(v);
                req.onsuccess = onsuccess;
                req.onerror = onerror;
            });
        };
    }
    /* tslint:enable:no-shadowed-variable */
}


// ============================================================================
// helpers
// ============================================================================
function justResult(ctx: TrxContext<any>) {
    return function (this: IDBRequest) {
        return ctx.next(this.result);
    };
}

function justError(ctx: TrxContext<any>) {
    return function (this: IDBRequest) {
        return ctx.next(this.error);
    };
}

function cursorResult(ctx: TrxContext<any>) {
    const result: any[] = [];

    return function (this: IDBRequest) {
        const cursor: IDBCursorWithValue = this.result;
        if (cursor) {
            result.push(cursor.value);
            cursor.continue();
        } else {
            ctx.next(result);
        }
    };
}
