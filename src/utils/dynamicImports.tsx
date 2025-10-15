import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Loading component for dynamic imports
export const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Utility to wrap lazy-loaded components with Suspense
export const withSuspense = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return (props: P) => (
    <Suspense fallback={<LoadingSpinner />}>
      <Component {...props} />
    </Suspense>
  );
};

// Dynamic imports for heavy components
export const PDFButton = lazy(() => import('@/components/common/PDFButton'));
export const Charts = lazy(() => import('@/components/analytics/Charts'));
export const FirebaseAuth = lazy(() => import('@/components/auth/FirebaseAuth'));
export const FirebaseStorage = lazy(() => import('@/components/auth/FirebaseStorage'));
export const FirebaseFirestore = lazy(() => import('@/components/auth/FirebaseFirestore'));

// UI component dynamic imports
export const Dialog = lazy(() => import('@/components/ui/dialog'));
export const Select = lazy(() => import('@/components/ui/select'));
export const DropdownMenu = lazy(() => import('@/components/ui/dropdown-menu'));
export const Tabs = lazy(() => import('@/components/ui/tabs'));
export const Accordion = lazy(() => import('@/components/ui/accordion'));
export const Table = lazy(() => import('@/components/ui/table'));
export const Card = lazy(() => import('@/components/ui/card'));
export const Button = lazy(() => import('@/components/ui/button'));
export const Input = lazy(() => import('@/components/ui/input'));
export const Textarea = lazy(() => import('@/components/ui/textarea'));
export const Checkbox = lazy(() => import('@/components/ui/checkbox'));
export const RadioGroup = lazy(() => import('@/components/ui/radio-group'));
export const Avatar = lazy(() => import('@/components/ui/avatar'));
export const Badge = lazy(() => import('@/components/ui/badge'));
export const Label = lazy(() => import('@/components/ui/label'));
export const Alert = lazy(() => import('@/components/ui/alert'));
export const ScrollArea = lazy(() => import('@/components/ui/scroll-area'));
export const Pagination = lazy(() => import('@/components/ui/pagination'));
export const Chart = lazy(() => import('@/components/ui/chart'));
export const Carousel = lazy(() => import('@/components/ui/carousel'));
export const Command = lazy(() => import('@/components/ui/command'));
export const ContextMenu = lazy(() => import('@/components/ui/context-menu'));
export const AlertDialog = lazy(() => import('@/components/ui/alert-dialog'));
export const Sheet = lazy(() => import('@/components/ui/sheet'));
export const Sidebar = lazy(() => import('@/components/ui/sidebar'));
export const Menubar = lazy(() => import('@/components/ui/menubar'));
export const NavigationMenu = lazy(() => import('@/components/ui/navigation-menu'));
export const DataTable = lazy(() => import('@/components/ui/data-table')); 