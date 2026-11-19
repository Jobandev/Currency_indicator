// Transactional test double. Integration tests separately target Firebase emulators.
import { randomUUID } from 'node:crypto';
export const records = new Map<string, any>();
class Ref {
  constructor(public path: string) {}
  get id() {
    return this.path.split('/').at(-1)!;
  }
  async get() {
    return snap(this);
  }
  async set(data: any, options?: any) {
    records.set(
      this.path,
      options?.merge ? { ...records.get(this.path), ...data } : structuredClone(data),
    );
  }
  async update(data: any) {
    if (!records.has(this.path)) throw new Error('Missing document');
    await this.set(data, { merge: true });
  }
  async delete() {
    records.delete(this.path);
  }
}
function snap(ref: Ref) {
  return {
    id: ref.id,
    ref,
    exists: records.has(ref.path),
    data: () => (records.has(ref.path) ? structuredClone(records.get(ref.path)) : undefined),
  };
}
class Query {
  filters: any[] = [];
  sort = '';
  direction = 'asc';
  cursor = '';
  max = Infinity;
  constructor(public name: string) {}
  doc(id = randomUUID()) {
    return new Ref(this.name + '/' + id);
  }
  where(field: string, op: string, value: any) {
    const q = this.clone();
    q.filters.push([field, op, value]);
    return q;
  }
  orderBy(field: string, direction = 'asc') {
    const q = this.clone();
    q.sort = field;
    q.direction = direction;
    return q;
  }
  startAfter(cursor: string) {
    const q = this.clone();
    q.cursor = cursor;
    return q;
  }
  limit(n: number) {
    const q = this.clone();
    q.max = n;
    return q;
  }
  clone() {
    const q = new Query(this.name);
    Object.assign(q, this);
    q.filters = [...this.filters];
    return q;
  }
  async get() {
    let docs = [...records.keys()]
      .filter((p) => p.startsWith(this.name + '/'))
      .map((p) => snap(new Ref(p)))
      .filter((d) =>
        this.filters.every(([f, op, v]) =>
          op === '=='
            ? d.data()[f] === v
            : op === 'in'
              ? v.includes(d.data()[f])
              : op === '>='
                ? d.data()[f] >= v
                : d.data()[f] <= v,
        ),
      );
    if (this.sort)
      docs.sort((a, b) => {
        const av = this.sort === '__name__' ? a.id : a.data()[this.sort],
          bv = this.sort === '__name__' ? b.id : b.data()[this.sort];
        return (av < bv ? -1 : av > bv ? 1 : 0) * (this.direction === 'desc' ? -1 : 1);
      });
    if (this.cursor) docs = docs.filter((d) => d.id > this.cursor);
    docs = docs.slice(0, this.max);
    return { docs, size: docs.length, empty: !docs.length };
  }
}
let tail: Promise<any> = Promise.resolve();
export const fakeDb = {
  collection: (name: string) => new Query(name),
  runTransaction: async (fn: any) => {
    let done!: () => void;
    const previous = tail;
    tail = new Promise((resolve) => {
      done = resolve;
    });
    await previous;
    const before = structuredClone(records);
    try {
      return await fn({
        get: (r: any) => r.get(),
        set: (r: Ref, d: any, o: any) => r.set(d, o),
        update: (r: Ref, d: any) => r.update(d),
        create: (r: Ref, d: any) => {
          if (records.has(r.path)) throw new Error('Already exists');
          return r.set(d);
        },
        delete: (r: Ref) => r.delete(),
      });
    } catch (e) {
      records.clear();
      for (const [k, v] of before) records.set(k, v);
      throw e;
    } finally {
      done();
    }
  },
  batch: () => {
    const tasks: any[] = [];
    return {
      set: (r: Ref, d: any) => tasks.push(() => r.set(d)),
      delete: (r: Ref) => tasks.push(() => r.delete()),
      commit: async () => {
        for (const task of tasks) await task();
      },
    };
  },
};
