// src/app/Pages/dashboard/student-dashboard/student-dashboard.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/AuthService/auth.service';
import { UserService } from '../../../core/services/UserService/user.service';
import { InstitutionService } from '../../../core/services/InstitutionService/institution.service';
import { QuizService } from '../../../core/services/QuizService/quiz.service';
import { QuizHistory } from '../../../../../INTERFACE/quiz-history';
import { InstitutionDataType } from '../../../../../INTERFACE/institution';
import { Quiz } from '../../../../../INTERFACE/quiz';

import { Subject, interval, of, combineLatest } from 'rxjs';
import { takeUntil, startWith, switchMap, catchError } from 'rxjs/operators';

declare var bootstrap: any;

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-dashboard.component.html',
  styleUrls: ['./student-dashboard.component.css']
})
export class StudentDashboardComponent implements OnInit, OnDestroy {
  // UI state
  currentView: 'dashboard' | 'results' | 'settings' = 'dashboard';

  // profile & institution (explicit safe defaults)
  currentUser: {
    id?: number;
    name?: string;
    email?: string;
    profileImageUrl?: string | null;
    userType?: string;
    institutionId?: number | null;
  } = {
    name: 'Student',
    email: '',
    profileImageUrl: null,
    userType: 'GENERAL',
    institutionId: null
  };

  institutionDetails: InstitutionDataType = {
    id: 0,
    instituteName: 'My Institution',
    instituteImage: null,
    instituteLocation: ''
  };

  // quiz / history state
  examCode: string = '';
  historyList: QuizHistory[] = [];
  filteredHistory: QuizHistory[] = [];
  stats = { totalTests: 0, avgScore: 0, passed: 0, failed: 0 };

  // quizzes
  activeQuizzes: Quiz[] = [];
  upcomingQuizzes: Quiz[] = [];

  // review modal payload
  reviewData: any = null;

  // profile editing
  passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
  selectedProfileImage: File | null = null;
  imagePreview: string | null = null;

  // filters/search
  historySearch: string = '';

  // lifecycle / polling
  private destroy$ = new Subject<void>();

  constructor(
    private auth: AuthService,
    public router: Router,
    private userService: UserService,
    private institutionService: InstitutionService,
    private quizService: QuizService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // initial load (will also be refreshed by poll immediately)
    this.loadUserProfile();
    this.loadAvailableQuizzes();
    this.loadHistory();

    // subscribe to explicit refresh triggers from services (if emitted elsewhere)
    this.quizService.refreshNeeded$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadAvailableQuizzes();
        this.loadHistory();
      });

    // Combined polling: refresh profile, quizzes, history every 15s (start immediately)
    interval(15000)
      .pipe(
        startWith(0),
        takeUntil(this.destroy$),
        switchMap(() =>
          combineLatest([
            this.userService.getMe().pipe(catchError(() => of(null))),
            this.quizService.getAll().pipe(catchError(() => of([] as Quiz[]))),
            this.quizService.getHistory().pipe(catchError(() => of([] as QuizHistory[])))
          ])
        )
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe(([user, quizzes, history]) => {
        // apply updates only if values present (protect against nulls from catchError)
        if (user && typeof user === 'object') {
          this.applyIncomingUser(user);
        }

        if (Array.isArray(quizzes)) {
          this.applyIncomingQuizzes(quizzes);
        }

        if (Array.isArray(history)) {
          this.applyIncomingHistory(history);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================
  // PROFILE & INSTITUTION
  // ============================
  private applyIncomingUser(data: any) {
    const incoming = (data && typeof data === 'object') ? data : {};
    // merge into currentUser but keep defaults for missing keys
    this.currentUser = { ...this.currentUser, ...incoming };

    // defensive: ensure strings (avoid .startsWith on undefined)
    if (this.currentUser.profileImageUrl && typeof this.currentUser.profileImageUrl === 'string' &&
        !this.currentUser.profileImageUrl.startsWith('http')) {
      this.currentUser.profileImageUrl = 'http://localhost:8080/' + this.currentUser.profileImageUrl;
    }

    const instId = Number(this.currentUser.institutionId);
    if (instId) {
      this.loadInstitution(instId);
    }
  }

  loadUserProfile() {
    this.userService.getMe()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => this.applyIncomingUser(data),
        error: (err) => console.error('Failed to load profile', err)
      });
  }

  loadInstitution(id: number) {
    if (!id) return;
    this.institutionService.getInstituteById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          const incoming = (data && typeof data === 'object') ? data : {};
          this.institutionDetails = { ...this.institutionDetails, ...incoming };

          if (this.institutionDetails.instituteImage && typeof this.institutionDetails.instituteImage === 'string' &&
              !this.institutionDetails.instituteImage.startsWith('http')) {
            this.institutionDetails.instituteImage = 'http://localhost:8080/' + this.institutionDetails.instituteImage;
          }
        },
        error: (err) => console.error('Failed to load institution', err)
      });
  }

  onProfileImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input?.files && input.files[0]) {
      this.selectedProfileImage = input.files[0];
      const reader = new FileReader();
      reader.onload = () => this.imagePreview = reader.result as string;
      reader.readAsDataURL(this.selectedProfileImage);
    }
  }

  updateProfile() {
    const formData = new FormData();
    formData.append('name', this.currentUser.name || '');
    if (this.selectedProfileImage) {
      formData.append('profileImage', this.selectedProfileImage);
    }
    this.userService.updateProfile(formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          alert('Profile saved!');
          this.imagePreview = null;
          this.selectedProfileImage = null;
          // Immediately refresh profile after successful update
          this.loadUserProfile();
        },
        error: (err) => {
          console.error('Update failed', err);
          alert(err?.error || 'Profile update failed');
        }
      });
  }

  changePassword() {
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    this.userService.changePassword(this.passwordData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          alert('Password changed!');
          this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
        },
        error: (err) => {
          console.error('Password change failed', err);
          alert(err?.error || 'Failed to change password');
        }
      });
  }

  // ============================
  // QUIZZES (active / upcoming)
  // ============================
  private applyIncomingQuizzes(data: Quiz[]) {
    const now = new Date();
    const upcoming: Quiz[] = [];
    const active: Quiz[] = [];

    (data || []).forEach(q => {
      const scheduled = (q as any)?.scheduledDate ? new Date((q as any).scheduledDate) : null;
      if ((q as any)?.active) {
        if (scheduled && scheduled > now) {
          upcoming.push(q);
        } else {
          active.push(q);
        }
      }
    });

    upcoming.sort((a, b) => {
      const da = (a as any)?.scheduledDate ? new Date((a as any).scheduledDate).getTime() : 0;
      const db = (b as any)?.scheduledDate ? new Date((b as any).scheduledDate).getTime() : 0;
      return da - db;
    });

    // update only when changed to minimize UI churn
    this.activeQuizzes = active;
    this.upcomingQuizzes = upcoming;
  }

  loadAvailableQuizzes() {
    this.quizService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: Quiz[]) => this.applyIncomingQuizzes(data || []),
        error: (err) => console.error('Failed to load quizzes', err)
      });
  }

  copyLink(code: string) {
    if (!code) return;
    const link = `http://localhost:4200/play/${code}`;
    navigator.clipboard.writeText(link).then(() => alert('Exam link copied to clipboard'));
  }

  // ============================
  // HISTORY / RESULTS
  // ============================

  // helper: sort history list by dateAttempted descending (latest first)
  private sortHistoryByDate(list: QuizHistory[]) {
    return list.sort((a, b) => {
      const ta = a?.dateAttempted ? new Date(a.dateAttempted).getTime() : 0;
      const tb = b?.dateAttempted ? new Date(b.dateAttempted).getTime() : 0;
      return tb - ta; // latest first
    });
  }

  // apply incoming history and keep it sorted newest-first
  private applyIncomingHistory(data: QuizHistory[]) {
    this.historyList = Array.isArray(data) ? data.slice() : [];
    // sort newest first
    this.sortHistoryByDate(this.historyList);
    // update filteredHistory to reflect sorted order (latest first)
    this.filteredHistory = [...this.historyList];
    this.calculateStats();
  }

  loadHistory() {
    this.quizService.getHistory()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => this.applyIncomingHistory(data || []),
        error: (err) => console.error('Failed to load history', err)
      });
  }

  calculateStats() {
    if (!this.historyList || this.historyList.length === 0) {
      this.stats = { totalTests: 0, avgScore: 0, passed: 0, failed: 0 };
      return;
    }
    this.stats.totalTests = this.historyList.length;
    let totalPct = 0;
    this.stats.passed = 0;
    this.stats.failed = 0;

    this.historyList.forEach(h => {
      const pct = h.totalQuestions ? (h.score / h.totalQuestions) * 100 : 0;
      totalPct += pct;
      if (pct >= 50) this.stats.passed++; else this.stats.failed++;
    });

    this.stats.avgScore = Math.round(totalPct / this.stats.totalTests);
  }

  // filter uses already-sorted historyList so filteredHistory keeps newest-first ordering
  filterHistory() {
    const source = [...this.historyList]; // already sorted newest-first
    if (!this.historySearch || !this.historySearch.trim()) {
      this.filteredHistory = source;
      return;
    }
    const term = this.historySearch.toLowerCase();
    this.filteredHistory = source.filter(h =>
      (h.quizTitle || '').toLowerCase().includes(term) ||
      (h.quizCode || '').toLowerCase().includes(term)
    );
  }

  openReview(resultId: number) {
    if (!resultId) return;
    this.reviewData = null;
    this.http.get<any>(`http://localhost:8080/api/results/review/${resultId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.reviewData = data;
          const modalEl = document.getElementById('reviewModal');
          if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
          }
        },
        error: (err) => {
          console.error('Failed to load review', err);
          alert('Could not load review details.');
        }
      });
  }

  // ============================
  // NAV & UTILS
  // ============================
  switchView(view: 'dashboard' | 'results' | 'settings') {
    this.currentView = view;
    window.scrollTo(0,0);
  }

  joinExam() {
    if (!this.examCode || !this.examCode.trim()) {
      alert('Please enter an exam code');
      return;
    }
    this.router.navigate(['/play', this.examCode.trim().toUpperCase()]);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/home']);
  }

  getPercentage(score: number, total: number): number {
    return total === 0 ? 0 : Math.round((score / total) * 100);
  }

  getAvatarColor(name: string): string {
    const colors = ['bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info', 'bg-dark'];
    if (!name || name.length === 0) return 'bg-primary';
    return colors[name.charCodeAt(0) % colors.length];
  }

  formatDateShort(s: any): string {
    if (!s) return '';
    try {
      const d = new Date(s);
      return d.toLocaleDateString();
    } catch {
      return String(s);
    }
  }

  // small helper: compute a progress width percentage for UI (example usage)
  getProgressWidth(totalTests: number): number {
    const width = totalTests ? (totalTests / 10) * 100 : 0;
    return width > 100 ? 100 : width;
  }
}








// // src/app/Pages/dashboard/student-dashboard/student-dashboard.component.ts
// import { Component, OnInit, OnDestroy } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { Router } from '@angular/router';
// import { HttpClient } from '@angular/common/http';
// import { AuthService } from '../../../core/services/AuthService/auth.service';
// import { UserService } from '../../../core/services/UserService/user.service';
// import { InstitutionService } from '../../../core/services/InstitutionService/institution.service';
// import { QuizService } from '../../../core/services/QuizService/quiz.service';
// import { QuizHistory } from '../../../../../INTERFACE/quiz-history';
// import { InstitutionDataType } from '../../../../../INTERFACE/institution';
// import { Quiz } from '../../../../../INTERFACE/quiz';

// import { Subject, interval, of, combineLatest } from 'rxjs';
// import { takeUntil, startWith, switchMap, catchError } from 'rxjs/operators';

// declare var bootstrap: any;

// @Component({
//   selector: 'app-student-dashboard',
//   standalone: true,
//   imports: [CommonModule, FormsModule],
//   templateUrl: './student-dashboard.component.html',
//   styleUrls: ['./student-dashboard.component.css']
// })
// export class StudentDashboardComponent implements OnInit, OnDestroy {
//   // UI state
//   currentView: 'dashboard' | 'results' | 'settings' = 'dashboard';

//   // profile & institution (explicit safe defaults)
//   currentUser: {
//     id?: number;
//     name?: string;
//     email?: string;
//     profileImageUrl?: string | null;
//     userType?: string;
//     institutionId?: number | null;
//   } = {
//     name: 'Student',
//     email: '',
//     profileImageUrl: null,
//     userType: 'GENERAL',
//     institutionId: null
//   };

//   institutionDetails: InstitutionDataType = {
//     id: 0,
//     instituteName: 'My Institution',
//     instituteImage: null,
//     instituteLocation: ''
//   };

//   // quiz / history state
//   examCode: string = '';
//   historyList: QuizHistory[] = [];
//   filteredHistory: QuizHistory[] = [];
//   stats = { totalTests: 0, avgScore: 0, passed: 0, failed: 0 };

//   // quizzes
//   activeQuizzes: Quiz[] = [];
//   upcomingQuizzes: Quiz[] = [];

//   // review modal payload
//   reviewData: any = null;

//   // profile editing
//   passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//   selectedProfileImage: File | null = null;
//   imagePreview: string | null = null;

//   // filters/search
//   historySearch: string = '';

//   // lifecycle / polling
//   private destroy$ = new Subject<void>();

//   constructor(
//     private auth: AuthService,
//     public router: Router,
//     private userService: UserService,
//     private institutionService: InstitutionService,
//     private quizService: QuizService,
//     private http: HttpClient
//   ) {}

//   ngOnInit(): void {
//     // initial load (will also be refreshed by poll immediately)
//     this.loadUserProfile();
//     this.loadAvailableQuizzes();
//     this.loadHistory();

//     // subscribe to explicit refresh triggers from services (if emitted elsewhere)
//     this.quizService.refreshNeeded$
//       .pipe(takeUntil(this.destroy$))
//       .subscribe(() => {
//         this.loadAvailableQuizzes();
//         this.loadHistory();
//       });

//     // Combined polling: refresh profile, quizzes, history every 15s (start immediately)
//     interval(15000)
//       .pipe(
//         startWith(0),
//         takeUntil(this.destroy$),
//         switchMap(() =>
//           combineLatest([
//             this.userService.getMe().pipe(catchError(() => of(null))),
//             this.quizService.getAll().pipe(catchError(() => of([] as Quiz[]))),
//             this.quizService.getHistory().pipe(catchError(() => of([] as QuizHistory[])))
//           ])
//         )
//       )
//       .pipe(takeUntil(this.destroy$))
//       .subscribe(([user, quizzes, history]) => {
//         // apply updates only if values present (protect against nulls from catchError)
//         if (user && typeof user === 'object') {
//           this.applyIncomingUser(user);
//         }

//         if (Array.isArray(quizzes)) {
//           this.applyIncomingQuizzes(quizzes);
//         }

//         if (Array.isArray(history)) {
//           this.applyIncomingHistory(history);
//         }
//       });
//   }

//   ngOnDestroy(): void {
//     this.destroy$.next();
//     this.destroy$.complete();
//   }

//   // ============================
//   // PROFILE & INSTITUTION
//   // ============================
//   private applyIncomingUser(data: any) {
//     const incoming = (data && typeof data === 'object') ? data : {};
//     // merge into currentUser but keep defaults for missing keys
//     this.currentUser = { ...this.currentUser, ...incoming };

//     // defensive: ensure strings (avoid .startsWith on undefined)
//     if (this.currentUser.profileImageUrl && typeof this.currentUser.profileImageUrl === 'string' &&
//         !this.currentUser.profileImageUrl.startsWith('http')) {
//       this.currentUser.profileImageUrl = 'http://localhost:8080/' + this.currentUser.profileImageUrl;
//     }

//     const instId = Number(this.currentUser.institutionId);
//     if (instId) {
//       this.loadInstitution(instId);
//     }
//   }

//   loadUserProfile() {
//     this.userService.getMe()
//       .pipe(takeUntil(this.destroy$))
//       .subscribe({
//         next: (data) => this.applyIncomingUser(data),
//         error: (err) => console.error('Failed to load profile', err)
//       });
//   }

//   loadInstitution(id: number) {
//     if (!id) return;
//     this.institutionService.getInstituteById(id)
//       .pipe(takeUntil(this.destroy$))
//       .subscribe({
//         next: (data) => {
//           const incoming = (data && typeof data === 'object') ? data : {};
//           this.institutionDetails = { ...this.institutionDetails, ...incoming };

//           if (this.institutionDetails.instituteImage && typeof this.institutionDetails.instituteImage === 'string' &&
//               !this.institutionDetails.instituteImage.startsWith('http')) {
//             this.institutionDetails.instituteImage = 'http://localhost:8080/' + this.institutionDetails.instituteImage;
//           }
//         },
//         error: (err) => console.error('Failed to load institution', err)
//       });
//   }

//   onProfileImageSelected(event: Event) {
//     const input = event.target as HTMLInputElement;
//     if (input?.files && input.files[0]) {
//       this.selectedProfileImage = input.files[0];
//       const reader = new FileReader();
//       reader.onload = () => this.imagePreview = reader.result as string;
//       reader.readAsDataURL(this.selectedProfileImage);
//     }
//   }

//   updateProfile() {
//     const formData = new FormData();
//     formData.append('name', this.currentUser.name || '');
//     if (this.selectedProfileImage) {
//       formData.append('profileImage', this.selectedProfileImage);
//     }
//     this.userService.updateProfile(formData)
//       .pipe(takeUntil(this.destroy$))
//       .subscribe({
//         next: () => {
//           alert('Profile saved!');
//           this.imagePreview = null;
//           this.selectedProfileImage = null;
//           // Immediately refresh profile after successful update
//           this.loadUserProfile();
//         },
//         error: (err) => {
//           console.error('Update failed', err);
//           alert(err?.error || 'Profile update failed');
//         }
//       });
//   }

//   changePassword() {
//     if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
//       alert('Passwords do not match');
//       return;
//     }
//     this.userService.changePassword(this.passwordData)
//       .pipe(takeUntil(this.destroy$))
//       .subscribe({
//         next: () => {
//           alert('Password changed!');
//           this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//         },
//         error: (err) => {
//           console.error('Password change failed', err);
//           alert(err?.error || 'Failed to change password');
//         }
//       });
//   }

//   // ============================
//   // QUIZZES (active / upcoming)
//   // ============================
//   private applyIncomingQuizzes(data: Quiz[]) {
//     const now = new Date();
//     const upcoming: Quiz[] = [];
//     const active: Quiz[] = [];

//     (data || []).forEach(q => {
//       const scheduled = (q as any)?.scheduledDate ? new Date((q as any).scheduledDate) : null;
//       if ((q as any)?.active) {
//         if (scheduled && scheduled > now) {
//           upcoming.push(q);
//         } else {
//           active.push(q);
//         }
//       }
//     });

//     upcoming.sort((a, b) => {
//       const da = (a as any)?.scheduledDate ? new Date((a as any).scheduledDate).getTime() : 0;
//       const db = (b as any)?.scheduledDate ? new Date((b as any).scheduledDate).getTime() : 0;
//       return da - db;
//     });

//     // update only when changed to minimize UI churn
//     this.activeQuizzes = active;
//     this.upcomingQuizzes = upcoming;
//   }

//   loadAvailableQuizzes() {
//     this.quizService.getAll()
//       .pipe(takeUntil(this.destroy$))
//       .subscribe({
//         next: (data: Quiz[]) => this.applyIncomingQuizzes(data || []),
//         error: (err) => console.error('Failed to load quizzes', err)
//       });
//   }

//   copyLink(code: string) {
//     if (!code) return;
//     const link = `http://localhost:4200/play/${code}`;
//     navigator.clipboard.writeText(link).then(() => alert('Exam link copied to clipboard'));
//   }

//   // ============================
//   // HISTORY / RESULTS
//   // ============================
//   private applyIncomingHistory(data: QuizHistory[]) {
//     this.historyList = data || [];
//     this.filteredHistory = [...this.historyList].reverse(); // latest first
//     this.calculateStats();
//   }

//   loadHistory() {
//     this.quizService.getHistory()
//       .pipe(takeUntil(this.destroy$))
//       .subscribe({
//         next: (data) => this.applyIncomingHistory(data || []),
//         error: (err) => console.error('Failed to load history', err)
//       });
//   }

//   calculateStats() {
//     if (!this.historyList || this.historyList.length === 0) {
//       this.stats = { totalTests: 0, avgScore: 0, passed: 0, failed: 0 };
//       return;
//     }
//     this.stats.totalTests = this.historyList.length;
//     let totalPct = 0;
//     this.stats.passed = 0;
//     this.stats.failed = 0;

//     this.historyList.forEach(h => {
//       const pct = h.totalQuestions ? (h.score / h.totalQuestions) * 100 : 0;
//       totalPct += pct;
//       if (pct >= 50) this.stats.passed++; else this.stats.failed++;
//     });

//     this.stats.avgScore = Math.round(totalPct / this.stats.totalTests);
//   }

//   filterHistory() {
//     if (!this.historySearch) {
//       this.filteredHistory = [...this.historyList].reverse();
//       return;
//     }
//     const term = this.historySearch.toLowerCase();
//     this.filteredHistory = this.historyList.filter(h =>
//       (h.quizTitle || '').toLowerCase().includes(term) ||
//       (h.quizCode || '').toLowerCase().includes(term)
//     ).reverse();
//   }

//   openReview(resultId: number) {
//     if (!resultId) return;
//     this.reviewData = null;
//     this.http.get<any>(`http://localhost:8080/api/results/review/${resultId}`)
//       .pipe(takeUntil(this.destroy$))
//       .subscribe({
//         next: (data) => {
//           this.reviewData = data;
//           const modalEl = document.getElementById('reviewModal');
//           if (modalEl) {
//             const modal = new bootstrap.Modal(modalEl);
//             modal.show();
//           }
//         },
//         error: (err) => {
//           console.error('Failed to load review', err);
//           alert('Could not load review details.');
//         }
//       });
//   }

//   // ============================
//   // NAV & UTILS
//   // ============================
//   switchView(view: 'dashboard' | 'results' | 'settings') {
//     this.currentView = view;
//     window.scrollTo(0,0);
//   }

//   joinExam() {
//     if (!this.examCode || !this.examCode.trim()) {
//       alert('Please enter an exam code');
//       return;
//     }
//     this.router.navigate(['/play', this.examCode.trim().toUpperCase()]);
//   }

//   logout() {
//     this.auth.logout();
//     this.router.navigate(['/home']);
//   }

//   getPercentage(score: number, total: number): number {
//     return total === 0 ? 0 : Math.round((score / total) * 100);
//   }

//   getAvatarColor(name: string): string {
//     const colors = ['bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info', 'bg-dark'];
//     if (!name || name.length === 0) return 'bg-primary';
//     return colors[name.charCodeAt(0) % colors.length];
//   }

//   formatDateShort(s: any): string {
//     if (!s) return '';
//     try {
//       const d = new Date(s);
//       return d.toLocaleDateString();
//     } catch {
//       return String(s);
//     }
//   }

//   // small helper: compute a progress width percentage for UI (example usage)
//   getProgressWidth(totalTests: number): number {
//     const width = totalTests ? (totalTests / 10) * 100 : 0;
//     return width > 100 ? 100 : width;
//   }
// }









// // src/app/Pages/dashboard/student-dashboard/student-dashboard.component.ts
// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { Router } from '@angular/router';
// import { HttpClient } from '@angular/common/http';
// import { AuthService } from '../../../core/services/AuthService/auth.service';
// import { UserService } from '../../../core/services/UserService/user.service';
// import { InstitutionService } from '../../../core/services/InstitutionService/institution.service';
// import { QuizService } from '../../../core/services/QuizService/quiz.service';
// import { QuizHistory } from '../../../../../INTERFACE/quiz-history';
// import { InstitutionDataType } from '../../../../../INTERFACE/institution';
// import { Quiz } from '../../../../../INTERFACE/quiz';

// declare var bootstrap: any;

// @Component({
//   selector: 'app-student-dashboard',
//   standalone: true,
//   imports: [CommonModule, FormsModule],
//   templateUrl: './student-dashboard.component.html',
//   styleUrls: ['./student-dashboard.component.css']
// })
// export class StudentDashboardComponent implements OnInit {
//   // UI state
//   currentView: 'dashboard' | 'results' | 'settings' = 'dashboard';

//   // profile & institution (explicit safe defaults)
//   currentUser: {
//     id?: number;
//     name?: string;
//     email?: string;
//     profileImageUrl?: string | null;
//     userType?: string;
//     institutionId?: number | null;
//   } = {
//     name: 'Student',
//     email: '',
//     profileImageUrl: null,
//     userType: 'GENERAL',
//     institutionId: null
//   };

//   institutionDetails: InstitutionDataType = {
//     id: 0,
//     instituteName: 'My Institution',
//     instituteImage: null,
//     instituteLocation: ''
//   };

//   // quiz / history state
//   examCode: string = '';
//   historyList: QuizHistory[] = [];
//   filteredHistory: QuizHistory[] = [];
//   stats = { totalTests: 0, avgScore: 0, passed: 0, failed: 0 };

//   // quizzes
//   activeQuizzes: Quiz[] = [];
//   upcomingQuizzes: Quiz[] = [];

//   // review modal payload
//   reviewData: any = null;

//   // profile editing
//   passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//   selectedProfileImage: File | null = null;
//   imagePreview: string | null = null;

//   // filters/search
//   historySearch: string = '';

//   constructor(
//     private auth: AuthService,
//     public router: Router,
//     private userService: UserService,
//     private institutionService: InstitutionService,
//     private quizService: QuizService,
//     private http: HttpClient
//   ) {}

//   ngOnInit(): void {
//     this.loadUserProfile();
//     this.loadHistory();
//     this.loadAvailableQuizzes();

//     // refresh quizzes/history when other parts of app change them
//     this.quizService.refreshNeeded$.subscribe(() => {
//       this.loadAvailableQuizzes();
//       this.loadHistory();
//     });
//   }

//   // ============================
//   // PROFILE & INSTITUTION
//   // ============================
//   loadUserProfile() {
//     this.userService.getMe().subscribe({
//       next: (data) => {
//         // merge with defaults so template never breaks
//         const incoming = (data && typeof data === 'object') ? data : {};
//         this.currentUser = {
//           ...this.currentUser,
//           ...incoming
//         };

//         // defensive: ensure strings (avoid .startsWith on undefined)
//         if (this.currentUser.profileImageUrl && typeof this.currentUser.profileImageUrl === 'string' &&
//             !this.currentUser.profileImageUrl.startsWith('http')) {
//           this.currentUser.profileImageUrl = 'http://localhost:8080/' + this.currentUser.profileImageUrl;
//         }

//         // If institutionId present and numeric, fetch details
//         const instId = Number(this.currentUser.institutionId);
//         if (instId) {
//           this.loadInstitution(instId);
//         }
//       },
//       error: (err) => {
//         console.error('Failed to load profile', err);
//       }
//     });
//   }

//   loadInstitution(id: number) {
//     if (!id) return;
//     this.institutionService.getInstituteById(id).subscribe({
//       next: (data) => {
//         const incoming = (data && typeof data === 'object') ? data : {};
//         this.institutionDetails = { ...this.institutionDetails, ...incoming };

//         // fix image url if backend returns relative path
//         if (this.institutionDetails.instituteImage && typeof this.institutionDetails.instituteImage === 'string' &&
//             !this.institutionDetails.instituteImage.startsWith('http')) {
//           this.institutionDetails.instituteImage = 'http://localhost:8080/' + this.institutionDetails.instituteImage;
//         }
//       },
//       error: (err) => console.error('Failed to load institution', err)
//     });
//   }

//   onProfileImageSelected(event: Event) {
//     const input = event.target as HTMLInputElement;
//     if (input?.files && input.files[0]) {
//       this.selectedProfileImage = input.files[0];
//       const reader = new FileReader();
//       reader.onload = () => this.imagePreview = reader.result as string;
//       reader.readAsDataURL(this.selectedProfileImage);
//     }
//   }

//   updateProfile() {
//     const formData = new FormData();
//     formData.append('name', this.currentUser.name || '');
//     if (this.selectedProfileImage) {
//       formData.append('profileImage', this.selectedProfileImage);
//     }
//     this.userService.updateProfile(formData).subscribe({
//       next: () => {
//         alert('Profile saved!');
//         this.imagePreview = null;
//         this.selectedProfileImage = null;
//         this.loadUserProfile();
//       },
//       error: (err) => {
//         console.error('Update failed', err);
//         alert(err?.error || 'Profile update failed');
//       }
//     });
//   }

//   changePassword() {
//     if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
//       alert('Passwords do not match');
//       return;
//     }
//     this.userService.changePassword(this.passwordData).subscribe({
//       next: () => {
//         alert('Password changed!');
//         this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//       },
//       error: (err) => {
//         console.error('Password change failed', err);
//         alert(err?.error || 'Failed to change password');
//       }
//     });
//   }

//   // ============================
//   // QUIZZES (active / upcoming)
//   // ============================
//   loadAvailableQuizzes() {
//     this.quizService.getAll().subscribe({
//       next: (data: Quiz[]) => {
//         const now = new Date();
//         const upcoming: Quiz[] = [];
//         const active: Quiz[] = [];

//         (data || []).forEach(q => {
//           // backend might include scheduledDate in a field; handle safely with optional access
//           const scheduled = (q as any)?.scheduledDate ? new Date((q as any).scheduledDate) : null;

//           if ((q as any)?.active) {
//             if (scheduled && scheduled > now) {
//               upcoming.push(q);
//             } else {
//               active.push(q);
//             }
//           }
//         });

//         // sort upcoming by scheduledDate
//         upcoming.sort((a, b) => {
//           const da = (a as any)?.scheduledDate ? new Date((a as any).scheduledDate).getTime() : 0;
//           const db = (b as any)?.scheduledDate ? new Date((b as any).scheduledDate).getTime() : 0;
//           return da - db;
//         });

//         this.activeQuizzes = active;
//         this.upcomingQuizzes = upcoming;
//       },
//       error: (err) => console.error('Failed to load quizzes', err)
//     });
//   }

//   copyLink(code: string) {
//     if (!code) return;
//     const link = `http://localhost:4200/play/${code}`;
//     navigator.clipboard.writeText(link).then(() => alert('Exam link copied to clipboard'));
//   }

//   // ============================
//   // HISTORY / RESULTS
//   // ============================
//   loadHistory() {
//     this.quizService.getHistory().subscribe({
//       next: (data) => {
//         this.historyList = data || [];
//         this.filteredHistory = [...this.historyList].reverse(); // latest first
//         this.calculateStats();
//       },
//       error: (err) => console.error('Failed to load history', err)
//     });
//   }

//   calculateStats() {
//     if (!this.historyList || this.historyList.length === 0) {
//       this.stats = { totalTests: 0, avgScore: 0, passed: 0, failed: 0 };
//       return;
//     }
//     this.stats.totalTests = this.historyList.length;
//     let totalPct = 0;
//     this.stats.passed = 0;
//     this.stats.failed = 0;

//     this.historyList.forEach(h => {
//       const pct = h.totalQuestions ? (h.score / h.totalQuestions) * 100 : 0;
//       totalPct += pct;
//       if (pct >= 50) this.stats.passed++; else this.stats.failed++;
//     });

//     this.stats.avgScore = Math.round(totalPct / this.stats.totalTests);
//   }

//   filterHistory() {
//     if (!this.historySearch) {
//       this.filteredHistory = [...this.historyList].reverse();
//       return;
//     }
//     const term = this.historySearch.toLowerCase();
//     this.filteredHistory = this.historyList.filter(h =>
//       (h.quizTitle || '').toLowerCase().includes(term) ||
//       (h.quizCode || '').toLowerCase().includes(term)
//     ).reverse();
//   }

//   openReview(resultId: number) {
//     if (!resultId) return;
//     this.reviewData = null;
//     this.http.get<any>(`http://localhost:8080/api/results/review/${resultId}`).subscribe({
//       next: (data) => {
//         this.reviewData = data;
//         const modalEl = document.getElementById('reviewModal');
//         if (modalEl) {
//           const modal = new bootstrap.Modal(modalEl);
//           modal.show();
//         }
//       },
//       error: (err) => {
//         console.error('Failed to load review', err);
//         alert('Could not load review details.');
//       }
//     });
//   }

//   // ============================
//   // NAV & UTILS
//   // ============================
//   switchView(view: 'dashboard' | 'results' | 'settings') {
//     this.currentView = view;
//     window.scrollTo(0,0);
//   }

//   joinExam() {
//     if (!this.examCode || !this.examCode.trim()) {
//       alert('Please enter an exam code');
//       return;
//     }
//     this.router.navigate(['/play', this.examCode.trim().toUpperCase()]);
//   }

//   logout() {
//     this.auth.logout();
//     this.router.navigate(['/home']);
//   }

//   getPercentage(score: number, total: number): number {
//     return total === 0 ? 0 : Math.round((score / total) * 100);
//   }

//   getAvatarColor(name: string): string {
//     const colors = ['bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info', 'bg-dark'];
//     if (!name || name.length === 0) return 'bg-primary';
//     return colors[name.charCodeAt(0) % colors.length];
//   }

//   formatDateShort(s: any): string {
//     if (!s) return '';
//     try {
//       const d = new Date(s);
//       return d.toLocaleDateString();
//     } catch {
//       return String(s);
//     }
//   }

//   // small helper: compute a progress width percentage for UI (example usage)
//   getProgressWidth(totalTests: number): number {
//     const width = totalTests ? (totalTests / 10) * 100 : 0;
//     return width > 100 ? 100 : width;
//   }
// }




// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { Router, RouterLink } from '@angular/router';
// import { HttpClient } from '@angular/common/http';
// import { AuthService } from '../../../core/services/AuthService/auth.service';
// import { UserService } from '../../../core/services/UserService/user.service';
// import { InstitutionService } from '../../../core/services/InstitutionService/institution.service';
// import { QuizService } from '../../../core/services/QuizService/quiz.service';
// import { QuizHistory } from '../../../../../INTERFACE/quiz-history';
// import { InstitutionDataType } from '../../../../../INTERFACE/institution';
// import { Quiz } from '../../../../../INTERFACE/quiz';

// declare var bootstrap: any;

// @Component({
//   selector: 'app-student-dashboard',
//   standalone: true,
//   imports: [CommonModule, FormsModule],
//   templateUrl: './student-dashboard.component.html',
//   styleUrls: ['./student-dashboard.component.css']
// })
// export class StudentDashboardComponent implements OnInit {
//   // UI state
//   currentView: 'dashboard' | 'results' | 'settings' = 'dashboard';

//   // profile & institution
//   currentUser: any = { name: 'Student', email: '', profileImageUrl: null, userType: 'GENERAL', institutionId: null };
//   institutionDetails: InstitutionDataType = { id: 0, instituteName: 'My Institution', instituteImage: null, instituteLocation: '' };

//   // quiz / history state
//   examCode: string = '';
//   historyList: QuizHistory[] = [];
//   filteredHistory: QuizHistory[] = [];
//   stats = { totalTests: 0, avgScore: 0, passed: 0, failed: 0 };

//   // quizzes
//   activeQuizzes: Quiz[] = [];
//   upcomingQuizzes: Quiz[] = [];

//   // review modal payload
//   reviewData: any = null;

//   // profile editing
//   passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//   selectedProfileImage: File | null = null;
//   imagePreview: string | null = null;

//   // filters/search
//   historySearch: string = '';

//   constructor(
//     private auth: AuthService,
//     public router: Router,
//     private userService: UserService,
//     private institutionService: InstitutionService,
//     private quizService: QuizService,
//     private http: HttpClient
//   ) {}

//   ngOnInit(): void {
//     this.loadUserProfile();
//     this.loadHistory();
//     this.loadAvailableQuizzes();

//     // refresh quizzes/history when other parts of app change them
//     this.quizService.refreshNeeded$.subscribe(() => {
//       this.loadAvailableQuizzes();
//       this.loadHistory();
//     });
//   }

//   // ============================
//   // PROFILE & INSTITUTION
//   // ============================
//   loadUserProfile() {
//     this.userService.getMe().subscribe({
//       next: (data) => {
//         // merge with defaults so template never breaks
//         this.currentUser = { ...this.currentUser, ...(data || {}) };

//         // fix image url if backend returns relative path
//         if (this.currentUser.profileImageUrl && !this.currentUser.profileImageUrl.startsWith('http')) {
//           this.currentUser.profileImageUrl = 'http://localhost:8080/' + this.currentUser.profileImageUrl;
//         }

//         if (this.currentUser.institutionId) {
//           this.loadInstitution(this.currentUser.institutionId);
//         }
//       },
//       error: (err) => {
//         console.error('Failed to load profile', err);
//       }
//     });
//   }

//   loadInstitution(id: number) {
//     this.institutionService.getInstituteById(id).subscribe({
//       next: (data) => {
//         this.institutionDetails = { ...this.institutionDetails, ...(data || {}) };
//         if (this.institutionDetails.instituteImage && !this.institutionDetails.instituteImage.startsWith('http')) {
//           this.institutionDetails.instituteImage = 'http://localhost:8080/' + this.institutionDetails.instituteImage;
//         }
//       },
//       error: (err) => console.error('Failed to load institution', err)
//     });
//   }

//   onProfileImageSelected(event: Event) {
//     const input = event.target as HTMLInputElement;
//     if (input.files && input.files[0]) {
//       this.selectedProfileImage = input.files[0];
//       const reader = new FileReader();
//       reader.onload = () => this.imagePreview = reader.result as string;
//       reader.readAsDataURL(this.selectedProfileImage);
//     }
//   }

//   updateProfile() {
//     const formData = new FormData();
//     formData.append('name', this.currentUser.name || '');
//     if (this.selectedProfileImage) {
//       formData.append('profileImage', this.selectedProfileImage);
//     }
//     this.userService.updateProfile(formData).subscribe({
//       next: () => {
//         alert('Profile saved!');
//         this.imagePreview = null;
//         this.selectedProfileImage = null;
//         this.loadUserProfile();
//       },
//       error: (err) => {
//         console.error('Update failed', err);
//         alert(err?.error || 'Profile update failed');
//       }
//     });
//   }

//   changePassword() {
//     if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
//       alert('Passwords do not match');
//       return;
//     }
//     this.userService.changePassword(this.passwordData).subscribe({
//       next: () => {
//         alert('Password changed!');
//         this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//       },
//       error: (err) => {
//         console.error('Password change failed', err);
//         alert(err?.error || 'Failed to change password');
//       }
//     });
//   }

//   // ============================
//   // QUIZZES (active / upcoming)
//   // ============================
//   loadAvailableQuizzes() {
//     this.quizService.getAll().subscribe({
//       next: (data: Quiz[]) => {
//         const now = new Date();
//         const upcoming: Quiz[] = [];
//         const active: Quiz[] = [];

//         (data || []).forEach(q => {
//           // backend might include scheduledDate in a field; handle safely with optional access
//           const scheduled = (q as any).scheduledDate ? new Date((q as any).scheduledDate) : null;

//           if (q.active) {
//             if (scheduled && scheduled > now) {
//               upcoming.push(q);
//             } else {
//               active.push(q);
//             }
//           }
//         });

//         // sort upcoming by scheduledDate
//         upcoming.sort((a, b) => {
//           const da = (a as any).scheduledDate ? new Date((a as any).scheduledDate).getTime() : 0;
//           const db = (b as any).scheduledDate ? new Date((b as any).scheduledDate).getTime() : 0;
//           return da - db;
//         });

//         this.activeQuizzes = active;
//         this.upcomingQuizzes = upcoming;
//       },
//       error: (err) => console.error('Failed to load quizzes', err)
//     });
//   }

//   copyLink(code: string) {
//     const link = `http://localhost:4200/play/${code}`;
//     navigator.clipboard.writeText(link).then(() => alert('Exam link copied to clipboard'));
//   }

//   // ============================
//   // HISTORY / RESULTS
//   // ============================
//   loadHistory() {
//     this.quizService.getHistory().subscribe({
//       next: (data) => {
//         this.historyList = data || [];
//         this.filteredHistory = [...this.historyList].reverse(); // latest first
//         this.calculateStats();
//       },
//       error: (err) => console.error('Failed to load history', err)
//     });
//   }

//   calculateStats() {
//     if (!this.historyList || this.historyList.length === 0) {
//       this.stats = { totalTests: 0, avgScore: 0, passed: 0, failed: 0 };
//       return;
//     }
//     this.stats.totalTests = this.historyList.length;
//     let totalPct = 0;
//     this.stats.passed = 0;
//     this.stats.failed = 0;

//     this.historyList.forEach(h => {
//       const pct = h.totalQuestions ? (h.score / h.totalQuestions) * 100 : 0;
//       totalPct += pct;
//       if (pct >= 50) this.stats.passed++; else this.stats.failed++;
//     });

//     this.stats.avgScore = Math.round(totalPct / this.stats.totalTests);
//   }

//   filterHistory() {
//     if (!this.historySearch) {
//       this.filteredHistory = [...this.historyList].reverse();
//       return;
//     }
//     const term = this.historySearch.toLowerCase();
//     this.filteredHistory = this.historyList.filter(h =>
//       (h.quizTitle || '').toLowerCase().includes(term) ||
//       (h.quizCode || '').toLowerCase().includes(term)
//     ).reverse();
//   }

//   openReview(resultId: number) {
//     this.reviewData = null;
//     this.http.get<any>(`http://localhost:8080/api/results/review/${resultId}`).subscribe({
//       next: (data) => {
//         this.reviewData = data;
//         const modal = new bootstrap.Modal(document.getElementById('reviewModal'));
//         modal.show();
//       },
//       error: (err) => {
//         console.error('Failed to load review', err);
//         alert('Could not load review details.');
//       }
//     });
//   }

//   // ============================
//   // NAV & UTILS
//   // ============================
//   switchView(view: 'dashboard' | 'results' | 'settings') {
//     this.currentView = view;
//     window.scrollTo(0,0);
//   }

//   joinExam() {
//     if (!this.examCode || !this.examCode.trim()) {
//       alert('Please enter an exam code');
//       return;
//     }
//     this.router.navigate(['/play', this.examCode.trim().toUpperCase()]);
//   }

//   logout() {
//     this.auth.logout();
//     this.router.navigate(['/home']);
//   }

//   getPercentage(score: number, total: number): number {
//     return total === 0 ? 0 : Math.round((score / total) * 100);
//   }

//   getAvatarColor(name: string): string {
//     const colors = ['bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info', 'bg-dark'];
//     if (!name || name.length === 0) return 'bg-primary';
//     return colors[name.charCodeAt(0) % colors.length];
//   }

//   formatDateShort(s: any): string {
//     if (!s) return '';
//     try {
//       const d = new Date(s);
//       return d.toLocaleDateString();
//     } catch {
//       return String(s);
//     }
//   }

//   // small helper: compute a progress width percentage for UI (example usage)
//   getProgressWidth(totalTests: number): number {
//     const width = totalTests ? (totalTests / 10) * 100 : 0;
//     return width > 100 ? 100 : width;
//   }
// }






// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { Router, RouterLink } from '@angular/router';
// import { HttpClient } from '@angular/common/http'; // ✅ Import HttpClient
// import { AuthService } from '../../../core/services/AuthService/auth.service';
// import { UserService } from '../../../core/services/UserService/user.service';
// import { InstitutionService } from '../../../core/services/InstitutionService/institution.service';
// import { QuizService } from '../../../core/services/QuizService/quiz.service';
// import { QuizHistory } from '../../../../../INTERFACE/quiz-history';
// import { InstitutionDataType } from '../../../../../INTERFACE/institution';

// declare var bootstrap: any; // ✅ Declare bootstrap for Modal

// @Component({
//   selector: 'app-student-dashboard',
//   standalone: true,
//   imports: [CommonModule, FormsModule],
//   templateUrl: './student-dashboard.component.html',
//   styleUrl: './student-dashboard.component.css'
// })
// export class StudentDashboardComponent implements OnInit {

//   currentView: 'dashboard' | 'results' = 'dashboard';

//   currentUser: any = { name: 'Student', email: '', institutionId: null, profileImageUrl: null };
//   institutionDetails: InstitutionDataType = { id: 0, instituteName: 'My Institute', instituteImage: null };

//   examCode: string = '';
//   historyList: QuizHistory[] = [];
//   stats = { totalTests: 0, avgScore: 0, passed: 0, failed: 0 };

//   // ✅ Review Data Container
//   reviewData: any = null;

//   constructor(
//     private auth: AuthService,
//     private router: Router,
//     private userService: UserService,
//     private institutionService: InstitutionService,
//     private quizService: QuizService,
//     private http: HttpClient // ✅ Inject HttpClient
//   ) {}

//   ngOnInit(): void {
//     this.loadUserProfile();
//     this.loadHistory();
//   }

//   loadUserProfile() {
//     this.userService.getMe().subscribe({
//       next: (data) => {
//         this.currentUser = data;
//         // Fix User Image
//         if (this.currentUser.profileImageUrl && !this.currentUser.profileImageUrl.startsWith('http')) {
//           this.currentUser.profileImageUrl = 'http://localhost:8080/' + this.currentUser.profileImageUrl;
//         }

//         // Load Institution
//         if (this.currentUser.institutionId) {
//           this.loadInstitution(this.currentUser.institutionId);
//         }
//       },
//       error: (err) => console.error('Profile load failed', err)
//     });
//   }

//   loadInstitution(id: number) {
//     this.institutionService.getInstituteById(id).subscribe({
//       next: (data) => {
//         this.institutionDetails = data;
//         // Fix Institution Image
//         if (this.institutionDetails.instituteImage && !this.institutionDetails.instituteImage.startsWith('http')) {
//           this.institutionDetails.instituteImage = 'http://localhost:8080/' + this.institutionDetails.instituteImage;
//         }
//       }
//     });
//   }

//   loadHistory() {
//     this.quizService.getHistory().subscribe({
//       next: (data) => {
//         this.historyList = data;
//         this.calculateStats();
//       },
//       error: (err) => console.error('History load failed', err)
//     });
//   }

//   // ✅ NEW: Open Review Modal
//   openReview(resultId: number) {
//     // Show loading or clear previous data if needed
//     this.reviewData = null; 

//     this.http.get<any>(`http://localhost:8080/api/results/review/${resultId}`).subscribe({
//       next: (data) => {
//         this.reviewData = data;
//         const modal = new bootstrap.Modal(document.getElementById('reviewModal'));
//         modal.show();
//       },
//       error: (err) => {
//         console.error("Failed to load review", err);
//         alert("Could not load review details. " + (err.error || "Server Error"));
//       }
//     });
//   }

//   calculateStats() {
//     if (this.historyList.length === 0) return;
//     this.stats.totalTests = this.historyList.length;
//     let totalPct = 0;
//     this.stats.passed = 0;
//     this.stats.failed = 0;

//     this.historyList.forEach(h => {
//       const pct = (h.score / h.totalQuestions) * 100;
//       totalPct += pct;
//       if (pct >= 50) this.stats.passed++; else this.stats.failed++;
//     });
//     this.stats.avgScore = Math.round(totalPct / this.stats.totalTests);
//   }

//   getPercentage(score: number, total: number): number {
//     return total === 0 ? 0 : Math.round((score / total) * 100);
//   }

//   switchView(view: 'dashboard' | 'results') {
//     this.currentView = view;
//     window.scrollTo(0, 0);
//   }

//   joinExam() {
//     if (!this.examCode.trim()) {
//       alert('Please enter exam code');
//       return;
//     }
//     this.router.navigate(['/play', this.examCode]);
//   }

//   logout() {
//     this.auth.logout();
//     this.router.navigate(['/home']);
//   }
// }