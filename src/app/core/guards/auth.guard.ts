import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/AuthService/auth.service';
import { QuizService } from '../services/QuizService/quiz.service'; 
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

// The function signature remains the same, now ensuring all paths return a boolean/observable
export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> | boolean => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const quizService = inject(QuizService); 

  // 1. If already logged in, allow access immediately
  if (authService.isLoggedIn()) {
    return true;
  } 

  // --- 2. If NOT logged in, process redirection ---
  if (state.url.includes('/play/')) {
    const quizCode = route.paramMap.get('code');
    const returnUrl = state.url;

    if (!quizCode) {
        router.navigate(['/home']);
        return false;
    }

    // Call service to check creator type asynchronously (returns Observable<boolean>)
    return quizService.getQuizCreatorTypeByCode(quizCode).pipe(
      map(creatorType => {
        if (creatorType === 'GENERAL') {
          // General User Quiz -> Redirect to General Login
          router.navigate(['/auth/general'], { queryParams: { returnUrl } });
        } else {
          // Institutional/Faculty Quiz -> Redirect to Student Login
          router.navigate(['/auth/student'], { queryParams: { returnUrl } });
        }
        return false; // MUST return false inside the map to deny access until login
      })
    );
  } 
  
  // 3. Default redirect for other protected pages (e.g., /dashboard/general)
  router.navigate(['/auth/general'], { queryParams: { returnUrl: state.url } });
  return false; // Final return statement for synchronous paths
};