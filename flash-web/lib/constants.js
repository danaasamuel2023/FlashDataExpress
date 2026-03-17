export const NETWORKS = {
  YELLO: { label: 'MTN', color: '#FFCC00', textColor: '#000', bg: 'bg-mtn' },
  TELECEL: { label: 'Telecel', color: '#E60000', textColor: '#FFF', bg: 'bg-telecel' },
  AT_PREMIUM: { label: 'AirtelTigo', color: '#0066CC', textColor: '#FFF', bg: 'bg-at' }
};

export const ORDER_STATUS = {
  pending: { label: 'Pending', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  processing: { label: 'Processing', color: 'text-blue-600', bg: 'bg-blue-50' },
  completed: { label: 'Completed', color: 'text-green-600', bg: 'bg-green-50' },
  failed: { label: 'Failed', color: 'text-red-600', bg: 'bg-red-50' },
  refunded: { label: 'Refunded', color: 'text-gray-600', bg: 'bg-gray-50' }
};

export const formatCurrency = (amount) => `GH₵${(amount || 0).toFixed(2)}`;

export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};
