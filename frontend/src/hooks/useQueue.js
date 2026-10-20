import { useQueueContext } from '../context/QueueContext';

export function useQueue() {
  const {
    queue,
    currentQueue,
    addQueue,
    nextQueue,
    completeQueue,
    removeQueue,
  } = useQueueContext();

  const waitingQueue = queue.filter(
    (item) => item.status === 'Waiting'
  );

  const printingQueue = queue.filter(
    (item) => item.status === 'Printing'
  );

  const completedQueue = queue.filter(
    (item) => item.status === 'Completed'
  );

  return {
    queue,
    currentQueue,
    waitingQueue,
    printingQueue,
    completedQueue,
    addQueue,
    nextQueue,
    completeQueue,
    removeQueue,
  };
}
