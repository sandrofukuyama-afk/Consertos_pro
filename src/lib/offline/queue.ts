"use client";

export type OfflineQueueName = "measurements" | "board-measurements";

export type OfflineQueueRecord<TPayload> = {
  id: string;
  queue: OfflineQueueName;
  payload: TPayload;
  createdAt: string;
};

const DATABASE_NAME = "consertospro-offline";
const STORE_NAME = "pending-sync";
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
        store.createIndex("queue", "queue", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir IndexedDB."));
  });
}

export async function enqueueOfflineRecord<TPayload>(
  queue: OfflineQueueName,
  payload: TPayload,
) {
  const database = await openDatabase();
  const record: OfflineQueueRecord<TPayload> = {
    id: crypto.randomUUID(),
    queue,
    payload,
    createdAt: new Date().toISOString(),
  };

  return new Promise<OfflineQueueRecord<TPayload>>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(record);

    request.onsuccess = () => resolve(record);
    request.onerror = () =>
      reject(request.error ?? new Error("Falha ao gravar item na fila offline."));
  });
}

export async function listOfflineRecords<TPayload>(queue: OfflineQueueName) {
  const database = await openDatabase();

  return new Promise<Array<OfflineQueueRecord<TPayload>>>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("queue");
    const request = index.getAll(queue);

    request.onsuccess = () =>
      resolve((request.result as Array<OfflineQueueRecord<TPayload>> | undefined) ?? []);
    request.onerror = () => reject(request.error ?? new Error("Falha ao listar fila offline."));
  });
}

export async function removeOfflineRecord(id: string) {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Falha ao remover item offline."));
  });
}
