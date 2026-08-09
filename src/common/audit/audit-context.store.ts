import { AsyncLocalStorage } from 'async_hooks';
import { AuditContext } from './audit-context';

const storage = new AsyncLocalStorage<AuditContext>();

export const AuditContextStore = {
  run<T>(context: AuditContext, fn: () => T) {
    return storage.run(context, fn);
  },
  get() {
    return storage.getStore();
  },
  set(context: AuditContext) {
    storage.enterWith(context);
  },
  merge(partial: AuditContext) {
    const current = storage.getStore() ?? {};
    storage.enterWith({ ...current, ...partial });
  },
};
