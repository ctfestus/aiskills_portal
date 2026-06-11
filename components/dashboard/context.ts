'use client';

import { createContext } from 'react';

// True when the current user is a staff/instructor (limited permissions) rather than an owner/admin.
// Shared across dashboard sections; provided once in app/dashboard/page.tsx.
export const IsStaffContext = createContext(false);
