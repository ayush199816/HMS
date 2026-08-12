// Date formatting utilities with IST (Asia/Kolkata) timezone

const TIME_ZONE = 'Asia/Kolkata';
const OFFSET = '+05:30';

const getParts = (date, options) => {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, ...options }).formatToParts(new Date(date));
};

const findPart = (parts, type) => parts.find(p => p.type === type)?.value;

export const formatDateTimeIST = (date) => {
  if (!date) return 'N/A';
  const parts = getParts(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const day = findPart(parts, 'day');
  const month = findPart(parts, 'month');
  const year = findPart(parts, 'year');
  const hour = findPart(parts, 'hour');
  const minute = findPart(parts, 'minute');
  return `${day}-${month}-${year} ${hour}:${minute}`;
};

export const formatDateIST = (date) => {
  if (!date) return 'N/A';
  const parts = getParts(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  return `${findPart(parts, 'day')}-${findPart(parts, 'month')}-${findPart(parts, 'year')}`;
};

export const formatTimeIST = (date) => {
  if (!date) return 'N/A';
  const parts = getParts(date, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return `${findPart(parts, 'hour')}:${findPart(parts, 'minute')}`;
};

// Returns current IST date-time as YYYY-MM-DDTHH:mm (suitable for datetime-local inputs)
export const toISTDateTimeLocal = (date = new Date()) => {
  const parts = getParts(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const day = findPart(parts, 'day');
  const month = findPart(parts, 'month');
  const year = findPart(parts, 'year');
  const hour = findPart(parts, 'hour');
  const minute = findPart(parts, 'minute');
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

// Appends the IST offset to a datetime-local value (YYYY-MM-DDTHH:mm) so the backend stores the correct UTC time
export const appendISTOffset = (dateTimeLocal) => {
  if (!dateTimeLocal) return dateTimeLocal;
  if (dateTimeLocal.includes('+') || dateTimeLocal.includes('Z')) return dateTimeLocal;
  return `${dateTimeLocal}:00${OFFSET}`;
};

const dateUtils = {
  formatDateTimeIST,
  formatDateIST,
  formatTimeIST,
  toISTDateTimeLocal,
  appendISTOffset
};

export default dateUtils;
