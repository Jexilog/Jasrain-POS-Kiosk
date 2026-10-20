import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { generateQueueNumber } from '../utils/generateQueueNumber';

const QueueContext = createContext();
const STORAGE_KEY = 'jasrain_print_queue';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.queue)) return saved;
  } catch (e) {
    /* ignore corrupted storage */
  }
  return { queue: [], counter: 0 };
}

export function QueueProvider({ children }) {
  const [queue, setQueue] = useState(() => load().queue);
  // A ref keeps numbers unique even if two jobs are added in the same tick
  const counterRef = useRef(load().counter);

  // Save to localStorage so a refresh doesn't wipe the queue
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ queue, counter: counterRef.current })
      );
    } catch (e) {
      /* storage full or blocked */
    }
  }, [queue]);

  // Keep the kiosk tab and the staff tab in sync (same computer)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      const fresh = load();
      counterRef.current = Math.max(counterRef.current, fresh.counter);
      setQueue(fresh.queue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Derived, so it can never get out of sync with the queue
  const currentQueue =
    queue.find((item) => item.status === 'Printing')?.queueNumber ?? null;

  const addQueue = (printRequest) => {
    counterRef.current += 1;
    const newQueue = {
      id: Date.now() + counterRef.current,
      queueNumber: generateQueueNumber(counterRef.current),
      ...printRequest,
      status: 'Waiting',
      createdAt: new Date().toISOString(),
    };
    setQueue((list) => [...list, newQueue]);
    return newQueue;
  };

  const setStatus = (queueNumber, status) =>
    setQueue((list) =>
      list.map((item) =>
        item.queueNumber === queueNumber
          ? {
              ...item,
              status,
              ...(status === 'Completed' ? { completedAt: new Date().toISOString() } : {}),
            }
          : item
      )
    );

  // Staff handed the customer their change
  const giveChange = (queueNumber) =>
    setQueue((list) => list.map((item) => (item.queueNumber === queueNumber ? { ...item, changeGiven: true } : item)));

  // Call the next waiting customer
  const nextQueue = () => {
    const next = queue.find((item) => item.status === 'Waiting');
    if (next) setStatus(next.queueNumber, 'Printing');
  };

  const startQueue = (queueNumber) => setStatus(queueNumber, 'Printing');
  const completeQueue = (queueNumber) => setStatus(queueNumber, 'Completed');

  const removeQueue = (queueNumber) =>
    setQueue((list) => list.filter((item) => item.queueNumber !== queueNumber));

  return (
    <QueueContext.Provider
      value={{
        queue,
        currentQueue,
        addQueue,
        nextQueue,
        startQueue,
        completeQueue,
        giveChange,
        removeQueue,
      }}
    >
      {children}
    </QueueContext.Provider>
  );
}

export function useQueueContext() {
  const context = useContext(QueueContext);
  if (!context) throw new Error('useQueueContext must be used inside QueueProvider');
  return context;
}