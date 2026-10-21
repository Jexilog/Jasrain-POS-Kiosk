import React, { createContext, useCallback, useContext, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../api';
import { usePolling } from '../hooks/usePolling';
import { useAuth } from './AuthContext';

const QueueContext = createContext();

// Staff and admin get every print job. The kiosk only gets the waiting and printing
// ones (queue number and status), which is enough for the "now serving" strip.
export function QueueProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [queue, setQueue] = useState([]);

  const refreshQueue = useCallback(async () => {
    try {
      setQueue(await api.get(isAuthenticated ? '/print-jobs' : '/print-jobs/board'));
    } catch (e) {
      /* keep the old list */
    }
  }, [isAuthenticated]);

  usePolling(refreshQueue, 4000, String(isAuthenticated));

  // Derived, so it can never get out of sync with the queue
  const currentQueue = queue.find((item) => item.status === 'Printing')?.queueNumber ?? null;

  // The server makes the queue number and works out the price.
  // Throws if the job could not be saved.
  const addQueue = async (printRequest) => {
    const job = await api.post('/print-jobs', {
      fileName: printRequest.fileName,
      fileSize: printRequest.fileSize,
      fileType: printRequest.fileType,
      pages: printRequest.pages,
      copies: printRequest.copies,
      color: printRequest.color,
      paperSize: printRequest.paperSize,
      payment: printRequest.payment,
      cashReceived: printRequest.cashReceived,
    });
    refreshQueue();
    return job;
  };

  // runs a staff action, shows any error, then reloads the list
  const act = async (request) => {
    try {
      await request();
    } catch (e) {
      toast.error(e.message);
    }
    refreshQueue();
  };

  const idOf = (queueNumber) => queue.find((item) => item.queueNumber === queueNumber)?.id;

  const setStatus = (queueNumber, status) => {
    const id = idOf(queueNumber);
    if (id) act(() => api.patch(`/print-jobs/${id}/status`, { status }));
  };

  // Staff handed the customer their change
  const giveChange = (queueNumber) => {
    const id = idOf(queueNumber);
    if (id) act(() => api.post(`/print-jobs/${id}/give-change`));
  };

  // Call the next waiting customer
  const nextQueue = () => {
    const next = queue.find((item) => item.status === 'Waiting');
    if (next) setStatus(next.queueNumber, 'Printing');
  };

  const startQueue = (queueNumber) => setStatus(queueNumber, 'Printing');
  const completeQueue = (queueNumber) => setStatus(queueNumber, 'Completed');

  const removeQueue = (queueNumber) => {
    const id = idOf(queueNumber);
    if (id) act(() => api.del(`/print-jobs/${id}`));
  };

  return (
    <QueueContext.Provider
      value={{
        queue,
        currentQueue,
        refreshQueue,
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
