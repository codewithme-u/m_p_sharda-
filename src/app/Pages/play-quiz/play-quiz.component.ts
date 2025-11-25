// src/app/Pages/play-quiz/play-quiz.component.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/AuthService/auth.service';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../../environments/environment';

declare var bootstrap: any;

@Component({
  selector: 'app-play-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './play-quiz.component.html',
  styleUrls: ['./play-quiz.component.css']
})
export class PlayQuizComponent implements OnInit, OnDestroy {
  quizCode: string = '';
  questions: any[] = [];
  currentQuestionIndex = 0;
  selectedOptions: { [key: number]: string } = {};

  isSubmitted = false;
  score = 0;
  loading = true;
  errorMessage = '';
  errorTitle = 'Error';

  // PROCTORING & TIMER STATES
  quizStarted = false;
  timeLeft: number = 3600;
  intervalId: any;

  proctoringViolations: number = 0;
  maxViolations = 3;
  isProctoringActive = false;

  isViolating: boolean = false;
  violationTimer: any;
  gracePeriodSeconds: number = 5;

  // token-derived (in-memory only)
  roleType: string | null = null;
  userEmail: string | null = null;
  issuedAt: number | null = null;   // seconds
  expiresAt: number | null = null;  // seconds

  // store bound listeners so we can remove them properly
  private boundVisibilityHandler = this.handleVisibilityChange.bind(this);
  private boundFullscreenHandler = this.handleFullscreenChange.bind(this);

  // base urls built from environment.apiUrl
  private readonly baseApiRoot: string;
  private readonly quizzesUrl: string;
  private readonly questionsUrl: string;
  private readonly resultsUrl: string;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router,
    private authService: AuthService
  ) {
    const apiRoot = environment?.apiUrl && environment.apiUrl.trim().length
      ? environment.apiUrl.replace(/\/$/, '')
      : '';
    this.baseApiRoot = apiRoot;
    this.quizzesUrl = apiRoot ? `${apiRoot}/api/quizzes` : '/api/quizzes';
    this.questionsUrl = apiRoot ? `${apiRoot}/api/questions` : '/api/questions';
    this.resultsUrl = apiRoot ? `${apiRoot}/api/results` : '/api/results';
  }

  ngOnInit(): void {
    this.quizCode = this.route.snapshot.paramMap.get('code') || '';
    this.decodeTokenForRole();   // decode for routing/logic only (no raw token stored)
    this.loadQuizData();

    // Register proctoring listeners (use stored bound functions so removal works)
    document.addEventListener('visibilitychange', this.boundVisibilityHandler);
    document.addEventListener('fullscreenchange', this.boundFullscreenHandler);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.violationTimer) {
      clearTimeout(this.violationTimer);
    }
    this.exitFullscreen();

    document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
    document.removeEventListener('fullscreenchange', this.boundFullscreenHandler);
  }

  // -------------------------
  // JWT decode helpers (in-memory only)
  // -------------------------
  private decodeTokenForRole(): void {
    try {
      const token = this.authService.getToken() || localStorage.getItem('token');
      if (!token) {
        this.roleType = null;
        this.userEmail = null;
        this.issuedAt = null;
        this.expiresAt = null;
        return;
      }

      const decoded: any = jwtDecode(token);

      if (decoded) {
        if (decoded.roles) {
          if (Array.isArray(decoded.roles) && decoded.roles.length > 0) {
            this.roleType = decoded.roles[0];
          } else if (typeof decoded.roles === 'string') {
            this.roleType = decoded.roles;
          }
        } else if (decoded.role) {
          this.roleType = decoded.role;
        } else {
          this.roleType = null;
        }

        this.userEmail = decoded.sub || decoded.email || null;
        this.issuedAt = decoded.iat ? Number(decoded.iat) : null;
        this.expiresAt = decoded.exp ? Number(decoded.exp) : null;
      }
    } catch (e) {
      console.error('Failed to decode token (no UI exposure):', e);
      this.roleType = null;
      this.userEmail = null;
      this.issuedAt = null;
      this.expiresAt = null;
    }
  }

  formatUnixSecondsToLocal(seconds: number | null): string {
    if (!seconds) return '—';
    const d = new Date(seconds * 1000);
    return d.toLocaleString();
  }

  // -------------------------
  // Question navigation
  // -------------------------
  selectOption(questionId: number, option: string) {
    this.selectedOptions[questionId] = option;
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
    }
  }

  prevQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
    }
  }

  // -------------------------
  // Proctoring + Timer
  // -------------------------
  startQuiz() {
    this.enterFullscreen();
    this.isProctoringActive = true;
    if (!this.timeLeft || this.timeLeft <= 0) this.timeLeft = 3600;
    this.quizStarted = true;

    this.intervalId = setInterval(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
      } else {
        this.autoSubmit();
      }
    }, 1000);
  }

  private enterFullscreen() {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if ((element as any).mozRequestFullScreen) {
      (element as any).mozRequestFullScreen();
    } else if ((element as any).webkitRequestFullscreen) {
      (element as any).webkitRequestFullscreen();
    } else if ((element as any).msRequestFullscreen) {
      (element as any).msRequestFullscreen();
    }
  }

  private exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    }
  }

  private handleViolation(message: string, isCritical = false) {
    if (this.isSubmitted || !this.quizStarted || !this.isProctoringActive) return;

    clearTimeout(this.violationTimer);

    if (isCritical) {
      this.autoSubmit(true);
      return;
    }

    if (this.proctoringViolations >= this.maxViolations) {
      this.autoSubmit(true);
      return;
    }

    if (!this.isViolating) {
      this.isViolating = true;
      console.warn(`GRACE PERIOD STARTED: ${message}`);
      this.violationTimer = setTimeout(() => {
        if (this.isViolating) {
          this.proctoringViolations++;
          console.warn(`VIOLATION COUNTED (#${this.proctoringViolations}): User failed to recover.`);
          if (this.proctoringViolations >= this.maxViolations) {
            this.autoSubmit(true);
          } else {
            this.isViolating = false;
          }
        }
      }, this.gracePeriodSeconds * 1000);
    }
  }

  private resetViolationState() {
    if (this.violationTimer) {
      clearTimeout(this.violationTimer);
    }
    this.isViolating = false;
  }

  // NOTE: these are now instance methods referenced by bound listeners above
  handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      this.handleViolation("Leaving the quiz window/tab.");
    } else {
      this.resetViolationState();
    }
  }

  handleFullscreenChange() {
    if (this.quizStarted && !document.fullscreenElement) {
      this.handleViolation("Exiting fullscreen mode.", true);
    } else {
      this.resetViolationState();
    }
  }

  // -------------------------
  // Data loading + error handling
  // -------------------------
  private makeHeaders(): { headers?: HttpHeaders } {
    const token = this.authService.getToken() || localStorage.getItem('token');
    if (token) {
      return {
        headers: new HttpHeaders({
          'Authorization': `Bearer ${token}`
        })
      };
    }
    return {};
  }

  loadQuizData() {
    this.loading = true;
    this.errorMessage = '';

    const quizByCodeUrl = `${this.quizzesUrl}/code/${this.quizCode}`;

    this.http.get<any>(quizByCodeUrl, this.makeHeaders()).subscribe({
      next: (quiz) => {
        if (quiz && (quiz.active === false || quiz.active === 'false')) {
          this.loading = false;
          this.errorTitle = 'Access Denied';
          this.errorMessage = 'This quiz is currently deactivated by the instructor. Please contact your instructor.';
          return;
        }

        if (quiz && quiz.timeLimit && Number(quiz.timeLimit) > 0) {
          this.timeLeft = Number(quiz.timeLimit) * 60;
        } else if (quiz && quiz.questionsCount) {
          this.timeLeft = Number(quiz.questionsCount) * 180;
        } else {
          this.timeLeft = 3600;
        }

        if (quiz && quiz.id != null) {
          const qUrl = `${this.questionsUrl}/quiz/${quiz.id}`;
          this.http.get<any[]>(qUrl, this.makeHeaders()).subscribe({
            next: qs => {
              this.questions = qs || [];
              this.loading = false;
            },
            error: (qErr) => {
              console.error('Failed to load questions', qErr);
              this.loading = false;
              this.errorTitle = 'Error';
              this.errorMessage = 'Failed to load quiz questions.';
            }
          });
        } else {
          this.loading = false;
          this.errorTitle = 'Error';
          this.errorMessage = 'Invalid quiz data returned from server.';
        }
      },
      error: (err) => {
        this.loading = false;
        const reason = err?.error?.reason || null;
        if (reason === 'DEACTIVATED' || err.status === 403) {
          this.errorTitle = 'Access Denied';
          this.errorMessage = err?.error?.message || 'This quiz is not active or you are not permitted to access it.';
        } else if (err.status === 404) {
          this.errorTitle = 'Not Found';
          this.errorMessage = 'The quiz code is incorrect or the quiz has been deleted.';
        } else {
          this.errorTitle = 'Error';
          this.errorMessage = err?.error?.message || 'Something went wrong. Please try again later.';
        }
      }
    });
  }

  // -------------------------
  // Auto submit & manual submit
  // -------------------------
  autoSubmit(penalty = false) {
    if (this.isSubmitted) return;
    clearInterval(this.intervalId);
    this.exitFullscreen();
    this.isProctoringActive = false;

    const message = penalty
      ? "Quiz auto-submitted due to excessive proctoring violations."
      : "Time expired. Quiz auto-submitted.";

    alert(message);

    this.submitQuiz(true);
  }

  submitQuiz(isAutoSubmit = false) {
    if (this.isSubmitted) return;
    if (!isAutoSubmit && !confirm("Are you sure you want to submit?")) return;

    clearInterval(this.intervalId);
    this.exitFullscreen();
    this.isProctoringActive = false;

    const payload = this.selectedOptions;
    const submitUrl = `${this.resultsUrl}/submit/${this.quizCode}`;

    this.http.post(submitUrl, payload, { ...this.makeHeaders(), responseType: 'text' as 'json' }).subscribe({
      next: () => {
        this.isSubmitted = true;
        this.score = 0;
        this.questions.forEach(q => {
          if (q.type === 'MCQ' && q.correctAnswer && this.selectedOptions[q.id] === q.correctAnswer) {
            this.score++;
          }
        });
      },
      error: (err) => {
        console.error('Submit error:', err);
        // some servers return status 200 with error? keep your old behavior but handle normally
        if (err && err.status === 200) {
          this.isSubmitted = true;
        } else {
          alert("Failed to submit quiz. Please try again.");
        }
      }
    });
  }

  // -------------------------
  // Utilities
  // -------------------------
  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const minStr = String(minutes).padStart(2, '0');
    const secStr = String(remainingSeconds).padStart(2, '0');
    return `${minStr}:${secStr}`;
  }

  // Role-aware navigation for "Go to Dashboard"
  goHome() {
    const role = (this.roleType || '').toUpperCase();

    if (role.includes('ADMIN')) {
      this.router.navigate(['/dashboard/admin']);
    } else if (role.includes('TEACHER') || role.includes('FACULTY')) {
      this.router.navigate(['/dashboard/teacher']);
    } else if (role.includes('STUDENT')) {
      this.router.navigate(['/dashboard/student']);
    } else {
      // fallback: attempt to decode token on-the-fly
      const token = this.authService.getToken() || localStorage.getItem('token');
      if (!token) {
        this.router.navigate(['/home']);
        return;
      }
      try {
        const decodedToken: any = jwtDecode(token);
        const roles: string[] = decodedToken.roles || [];
        if (roles.includes('ADMIN')) {
          this.router.navigate(['/dashboard/admin']);
        } else if (roles.includes('TEACHER')) {
          this.router.navigate(['/dashboard/teacher']);
        } else if (roles.includes('STUDENT')) {
          this.router.navigate(['/dashboard/student']);
        } else {
          this.router.navigate(['/dashboard/general']);
        }
      } catch (e) {
        console.error("Failed to decode token for dashboard redirect:", e);
        this.router.navigate(['/home']);
      }
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.quizStarted && !this.isSubmitted) {
      $event.returnValue = true;
    }
  }
}
