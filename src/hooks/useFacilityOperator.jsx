import { useMemo } from 'react';

const useFacilityOperator = (hasPermission) => {
  return useMemo(() => {
    return hasPermission && !hasPermission('manage-batches');
  }, [hasPermission]);
};

export default useFacilityOperator;