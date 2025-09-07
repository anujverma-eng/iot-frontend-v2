// src/utils/orgContext.ts
let currentOrgId: string | null = null;

export const orgContext = {
  get: () => currentOrgId,
  set: (id: string | null) => { 
    currentOrgId = id; 
  },
  clear: () => { 
    currentOrgId = null; 
  }
};
