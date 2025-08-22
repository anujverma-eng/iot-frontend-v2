import { useNavigate } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  icon: string;
  action: () => void;
}

export const useBreadcrumbNavigation = () => {
  const navigate = useNavigate();

  const getSmartBackNavigation = (): BreadcrumbItem => {
    // Check if there's a referrer or previous history
    const referrer = document.referrer;
    const currentDomain = window.location.origin;
    
    // If coming from within our app, provide context-aware navigation
    if (referrer.startsWith(currentDomain)) {
      const referrerPath = new URL(referrer).pathname;
      
      // Analytics/Sensors page
      if (referrerPath.includes('/dashboard/sensors')) {
        return { 
          label: 'Analytics', 
          icon: 'lucide:bar-chart-3',
          action: () => navigate(-1)
        };
      } 
      // Gateways page
      else if (referrerPath.includes('/dashboard/gateways')) {
        return { 
          label: 'Gateways', 
          icon: 'lucide:router',
          action: () => navigate(-1)
        };
      } 
      // Panel page
      else if (referrerPath.includes('/dashboard/panel')) {
        return { 
          label: 'Panel', 
          icon: 'lucide:layout-dashboard',
          action: () => navigate(-1)
        };
      } 
      // Dashboard home
      else if (referrerPath.includes('/dashboard/home')) {
        return { 
          label: 'Dashboard', 
          icon: 'lucide:home',
          action: () => navigate(-1)
        };
      }
      // Compare page
      else if (referrerPath.includes('/compare')) {
        return { 
          label: 'Compare', 
          icon: 'lucide:git-compare',
          action: () => navigate(-1)
        };
      }
    }
    
    // Fallback logic
    // Check if browser has history to go back to
    if (window.history.length > 1) {
      return { 
        label: 'Back', 
        icon: 'lucide:arrow-left',
        action: () => navigate(-1)
      };
    } else {
      // No history available, go to dashboard home
      return { 
        label: 'Dashboard', 
        icon: 'lucide:home',
        action: () => navigate('/dashboard/home')
      };
    }
  };

  const getPageBreadcrumb = (currentPage: string, currentIcon: string): BreadcrumbItem[] => {
    const backNavigation = getSmartBackNavigation();
    
    return [
      backNavigation,
      {
        label: currentPage,
        icon: currentIcon,
        action: () => {} // Current page, no action
      }
    ];
  };

  return {
    getSmartBackNavigation,
    getPageBreadcrumb
  };
};
