import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useSessionSecurity() {
  const { admin, signOut } = useAuth();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!admin) return;

    // Detect DevTools opening - logout immediately
    const detectDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        console.clear();
        signOut();
        window.location.href = '/login';
      }
    };

    // Check for DevTools on resize
    window.addEventListener('resize', detectDevTools);

    // Check devtools via debugger timing
    const checkDevTools = () => {
      const start = performance.now();
      // This gets slower when DevTools is open
      for (let i = 0; i < 100; i++) {
        console.log(i);
        console.clear();
      }
      const end = performance.now();
      if (end - start > 100) {
        signOut();
        window.location.href = '/login';
      }
    };

    // Disable right-click
    const disableRightClick = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable F12 and other dev keys
    const disableDevKeys = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        signOut();
        window.location.href = '/login';
        return false;
      }
      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
        e.preventDefault();
        signOut();
        window.location.href = '/login';
        return false;
      }
      // Ctrl+U (view source)
      if (e.ctrlKey && e.key.toUpperCase() === 'U') {
        e.preventDefault();
        return false;
      }
    };

    // Validate session against database - single session enforcement
    const validateSession = async () => {
      if (!admin?.session_token) return;

      try {
        const { data } = await supabase
          .from('admins')
          .select('session_token')
          .eq('id', admin.id)
          .single();

        // If session token doesn't match, someone else logged in
        if (data && data.session_token !== admin.session_token) {
          signOut();
          window.location.href = '/login?reason=session_expired';
        }
      } catch (error) {
        console.error('Session validation error:', error);
      }
    };

    // Add event listeners
    document.addEventListener('contextmenu', disableRightClick);
    document.addEventListener('keydown', disableDevKeys);

    // Run initial check
    detectDevTools();

    // Check session every 5 seconds
    checkIntervalRef.current = setInterval(validateSession, 5000);

    return () => {
      window.removeEventListener('resize', detectDevTools);
      document.removeEventListener('contextmenu', disableRightClick);
      document.removeEventListener('keydown', disableDevKeys);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [admin, signOut]);
}
