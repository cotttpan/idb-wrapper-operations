import * as assert from 'assert';
import * as op from '../src/index';
import { IDBWrapper, IDBWrapperOptions, SchemaBuilder } from '@cotto/idb-wrapper';

//
// ─── OPTIONS ────────────────────────────────────────────────────────────────────
//
export const options: IDBWrapperOptions = {};

if (process.env.TEST_ENV === 'node') {
    options.IDBFactory = require('fake-indexeddb');
    options.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');
}

//
// ─── MODEL ──────────────────────────────────────────────────────────────────────
//
export function record(id: number) {
    return { id };
}

//
// ─── SCHEMA ─────────────────────────────────────────────────────────────────────
//
export const schema = new SchemaBuilder()
    .define(1)
    .addStore('store', { keyPath: 'id', autoIncrement: true });

//
// ─── DB ─────────────────────────────────────────────────────────────────────────
//
const db = new IDBWrapper('SampleDB', options)
    .open(schema);

after(() => db.delete());

//
// ─── HELPER ─────────────────────────────────────────────────────────────────────
//
const getCount = db.transaction('store', 'r', op.count('store'));


//
// ─── TEST ─────────────────────────────────────────────────────────────────────
//
describe('set', () => {
    it('set single record', async () => {
        const t = op.set('store', record(1));
        const id = await db.transaction('store', 'rw', t).execute(null);
        assert(id === 1);
    });

    it('set single record from input', async () => {
        const t = op.set<{ id: number }>('store');
        const id = await db.transaction('store', 'rw', t).execute(record(2));
        assert(id === 2);
    });
});

describe('batch.set', () => {
    it('set multi records', async () => {
        const t = op.batch.set<{ id: number }>('store', [record(3), record(4)]);
        const ids = await db.transaction('store', 'rw', t).execute(null);
        assert.deepEqual(ids, [3, 4]);
    });

    it('set multi records from input', async () => {
        const t = op.batch.set<{ id: number }>('store');
        const ids = await db.transaction('store', 'rw', t).execute([record(5), record(6), record(7), record(8)]);
        assert.deepEqual(ids, [5, 6, 7, 8]);
    });
});


describe('count', () => {
    it('return record count', async () => {
        const t = op.count('store');
        const r = await db.transaction('store', 'r', t).execute(null);
        assert(r === 8);
    });
});


describe('get', () => {
    it('get single record by id', async () => {
        const t = op.get('store', 1);
        const r = await db.transaction('store', 'r', t).execute(null);
        assert.deepEqual(r, record(1));
    });

    it('get single record by id from input', async () => {
        const t = op.get('store');
        const r = await db.transaction('store', 'r', t).execute(2);
        assert.deepEqual(r, record(2));
    });
});


describe('getAll', () => {
    it('get all record', async () => {
        const t = op.getAll('store');
        const r = await db.transaction('store', 'r', t).execute(null);
        assert(r.length === 8);
        assert.deepEqual(r[0], record(1));
    });
});


describe('getByRange', () => {
    const selector = (range: typeof IDBKeyRange) => range.bound(1, 3);

    it('get by keyrange', async () => {
        const t = op.getByRange('store', selector);
        const r = await db.transaction('store', 'r', t).execute(null);
        assert(r.length === 3);
    });

    it('get by keyrange from input', async () => {
        const t = op.getByRange('store');
        const r = await db.transaction('store', 'r', t).execute(selector);
        assert(r.length === 3);
    });
});

describe('del', () => {

    it('delete single record', async () => {
        const t = op.del('store', 1);

        const c1 = await getCount.execute(null);
        const id = await db.transaction('store', 'rw', t).execute(null);
        const c2 = await getCount.execute(null);

        assert(id === 1);
        assert(c1 - c2 === 1);
    });

    it('delete single record from input', async () => {
        const t = op.del('store');
        const c1 = await getCount.execute(null);
        const id = await db.transaction('store', 'rw', t).execute(2);
        const c2 = await getCount.execute(null);

        assert(id === 2);
        assert(c1 - c2 === 1);
    });
});

describe('batch.del', () => {
    it('delete multi records', async () => {
        const t = op.batch.del('store', [3, 4]);

        const c1 = await getCount.execute(null);
        const ids = await db.transaction('store', 'rw', t).execute(null);
        const c2 = await getCount.execute(null);

        assert.deepEqual(ids, [3, 4]);
        assert(c1 - c2 === 2);
    });

    it('delete multi records from input', async () => {
        const t = op.batch.del('store');

        const c1 = await getCount.execute(null);
        const ids = await db.transaction('store', 'rw', t).execute([5, 6]);
        const c2 = await getCount.execute(null);

        assert.deepEqual(ids, [5, 6]);
        assert(c1 - c2 === 2);
    });

});


describe('clear', () => {
    it('clear store records', async () => {
        const t = op.clear('store');

        const c1 = await getCount.execute(null);
        const r = await db.transaction('store', 'rw', t).execute(null);
        const c2 = await getCount.execute(null);

        assert(r === undefined);
        assert(c1 > 0);
        assert(c2 === 0);
    });
});
